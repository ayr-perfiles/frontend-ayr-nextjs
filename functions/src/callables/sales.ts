import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { resolveSaleQuotationLink } from "../domain/annulment/saleQuotationLink";
import { canAnnulSale, type AnnulBlockReason } from "../domain/annulment/canAnnulSale";
import { resolveSaleTwinPath } from "../domain/annulment/resolveSaleTwinPath";
import { buildAnnulmentCascade } from "../domain/annulment/buildAnnulmentCascade";
import { translateCascadeFields } from "../utils/translateCascadeFields";
import { getStockStrategy } from "../domain/strategies";

export interface AnnulSaleData {
  saleId: string;
  reason?: string;
}

/** Shape mínimo de un item de venta que annulSale necesita leer (no el CartItem completo). */
interface AnnulSaleItem {
  sku: string;
  isCoil?: boolean;
  businessLine?: string;
  quantity: number;
  baseCost?: number;
}

const BLOCK_REASON_HTTPS: Record<AnnulBlockReason, "failed-precondition" | "not-found"> = {
  ALREADY_VOIDED: "failed-precondition",
  INVALID_STATUS: "failed-precondition",
  SALE_NOT_FOUND: "not-found",
  ACTIVE_PRODUCTION: "failed-precondition",
};

function blockReasonMessage(reason: AnnulBlockReason, context?: { quotationId?: string }): string {
  switch (reason) {
    case "ALREADY_VOIDED":
      return "Esta venta ya ha sido anulada.";
    case "INVALID_STATUS":
      return "La venta no puede anularse en su estado actual.";
    case "SALE_NOT_FOUND":
      return "La venta no existe.";
    case "ACTIVE_PRODUCTION":
      return `No se puede anular la venta: la cotización vinculada ${context?.quotationId} tiene producción activa. Anulá la producción primero.`;
  }
}

export const annulSale = onCall<AnnulSaleData>(async (request) => {
  // ── Guard 1: auth ────────────────────────────────────────────────────────
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login requerido");
  }
  const userEmail = request.auth.token.email;
  if (!userEmail) {
    throw new HttpsError("unauthenticated", "Email requerido en el token");
  }

  // ── Guard 2: rol (mismo gate que la Cola de Producción, ADMIN+SUPERVISOR) ──
  const role = request.auth.token.role;
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    throw new HttpsError("permission-denied", "Solo ADMIN o SUPERVISOR pueden anular ventas.");
  }

  // ── Guard 3: input ───────────────────────────────────────────────────────
  const { saleId, reason } = request.data ?? {};
  if (!saleId || typeof saleId !== "string" || saleId.trim() === "") {
    throw new HttpsError("invalid-argument", "saleId es obligatorio.");
  }

  const db = admin.firestore();
  const saleRef = db.collection("sales").doc(saleId);

  // ── PRE-TXN: resolver link + bloqueo por producción activa ──────────────
  // Firestore no admite queries dentro de una transacción (mismo patrón que
  // produceFromCoils/voidProductionFromCoils, production.ts) — el pre-check y
  // la query de production_logs van ANTES de abrir la txn.
  const preSnap = await saleRef.get();
  if (!preSnap.exists) {
    throw new HttpsError("not-found", "La venta no existe.");
  }
  const preData = preSnap.data()!;
  const saleLinkInput = {
    id: saleId,
    status: preData.status as string | undefined,
    relatedQuotationId: preData.relatedQuotationId as string | undefined,
    originQuoteId: preData.originQuoteId as string | undefined,
  };

  const link = resolveSaleQuotationLink(saleLinkInput);
  let activeLogs: Array<{ id: string; status: string; source?: { type: string; id: string } }> = [];
  if (link.mode === "linked") {
    const logsSnap = await db.collection("production_logs").where("source.id", "==", link.quotationId).get();
    activeLogs = logsSnap.docs.map((d) => ({
      id: d.id,
      status: d.data().status as string,
      source: d.data().source as { type: string; id: string } | undefined,
    }));
  }

  const canResult = canAnnulSale({ sale: saleLinkInput, activeProductionLogs: activeLogs });
  if (!canResult.allowed) {
    throw new HttpsError(
      BLOCK_REASON_HTTPS[canResult.reason],
      blockReasonMessage(canResult.reason, canResult.context),
      canResult.context,
    );
  }

  // ── Armar el plan de cascada (dominio puro, sin I/O) ─────────────────────
  const twinPath = resolveSaleTwinPath(saleLinkInput);
  const cascadePlan = buildAnnulmentCascade({
    sale: {
      id: saleId,
      documentNumber: preData.documentNumber as string | undefined,
      relatedQuotationId: preData.relatedQuotationId as string | undefined,
      originQuoteId: preData.originQuoteId as string | undefined,
    },
    twinPath,
    userEmail,
    reason,
  });

  // ── TXN ───────────────────────────────────────────────────────────────────
  await db.runTransaction(async (tx) => {
    // Re-lock + re-validar status (defensa contra carrera entre el pre-check y la txn).
    const saleSnap = await tx.get(saleRef);
    if (!saleSnap.exists) {
      throw new HttpsError("not-found", "La venta no existe.");
    }
    const saleData = saleSnap.data()!;
    if (saleData.status === "VOIDED") {
      throw new HttpsError("failed-precondition", "Esta venta ya ha sido anulada.");
    }

    const items = (saleData.items ?? []) as AnnulSaleItem[];

    // ── LECTURAS (todas antes de cualquier escritura, exigencia de Firestore) ──
    // Port 1:1 de salesService.ts:415-436 (annulSale client-side) a Admin SDK.
    const coilSnapshots = new Map<string, admin.firestore.DocumentSnapshot>();
    const stockSnapshots = new Map<string, admin.firestore.DocumentSnapshot>();

    for (const item of items) {
      if (item.isCoil) {
        coilSnapshots.set(item.sku, await tx.get(db.collection("coils").doc(item.sku)));
      } else if (item.sku && item.sku !== "GENERIC") {
        const line = item.businessLine ?? "drywall";
        const key = `${line}:${item.sku}`;
        if (!stockSnapshots.has(key)) {
          const strategy = getStockStrategy(line);
          stockSnapshots.set(key, await tx.get(strategy.getStockRef(item.sku, db)));
        }
      }
    }

    // ── ESCRITURAS ────────────────────────────────────────────────────────────
    // Port 1:1 de salesService.ts:438-483 (branch bobinas + branch stock por línea).
    for (const item of items) {
      if (item.isCoil) {
        const coilSnap = coilSnapshots.get(item.sku);
        const coilData = coilSnap?.data();
        tx.update(db.collection("coils").doc(item.sku), {
          status: "AVAILABLE",
          soldAt: null,
          soldBy: null,
          saleReference: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.set(db.collection("kardex_movements").doc(), {
          sku: item.sku,
          date: admin.firestore.FieldValue.serverTimestamp(),
          type: "IN",
          quantity: 1,
          weightKg: (coilData?.currentWeight as number) ?? 0,
          costPerKg: (coilData?.pricePerKg as number) ?? 0,
          balance: 1,
          reference: saleId,
          description: `Anulación Venta MP: ${saleData.customerName}`,
          user: userEmail,
        });
      } else if (item.sku && item.sku !== "GENERIC") {
        const line = item.businessLine ?? "drywall";
        const strategy = getStockStrategy(line);
        const snap = stockSnapshots.get(`${line}:${item.sku}`) ?? null;
        const currentQty = snap ? strategy.extractQuantity(snap) : 0;
        const newBalance = currentQty + item.quantity;

        strategy.writeSaleReversal(
          {
            sku: item.sku,
            quantity: item.quantity,
            newBalance,
            saleId,
            customerName: saleData.customerName as string,
            sellerId: userEmail,
            frozenCost: item.baseCost ?? 0,
          },
          snap,
          tx,
          db,
        );
      }
    }

    for (const write of cascadePlan.writes) {
      const targetRef = db.doc(write.docPath);
      const translated = translateCascadeFields(write.fields, admin.firestore.FieldValue);
      tx.update(targetRef, translated);
    }

    const auditRef = db.collection("audit_logs").doc();
    tx.set(auditRef, {
      action: "VOID_SALE",
      entityId: saleId,
      userEmail,
      details: cascadePlan.auditDetails,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { success: true };
});
