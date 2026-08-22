import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { resolveSaleQuotationLink } from "../domain/annulment/saleQuotationLink";
import { canAnnulSale, type AnnulBlockReason } from "../domain/annulment/canAnnulSale";
import { resolveSaleTwinPath } from "../domain/annulment/resolveSaleTwinPath";
import { buildAnnulmentCascade, type StockEffect } from "../domain/annulment/buildAnnulmentCascade";
import { translateCascadeFields } from "../utils/translateCascadeFields";
import { getStockStrategy } from "../domain/strategies";
import { hasActiveProductionForQuote, type ActiveProductionLog } from "../utils/hasActiveProductionForQuote";

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
  // `self` (el doc ES la cotizacion, status QUOTATION) tambien se chequea: hasta
  // v6.52.1 este gate era solo `linked` y dejaba anular una cotizacion con produccion
  // viva. La query vive en `hasActiveProductionForQuote` (utils/) para que el futuro
  // callable de edicion consuma el MISMO pre-check sin importar desde un callable.
  let activeLogs: ActiveProductionLog[] = [];
  if (link.mode === "linked" || link.mode === "self") {
    activeLogs = (await hasActiveProductionForQuote(link.quotationId, db)).allLogs;
  }

  const canResult = canAnnulSale({ sale: saleLinkInput, activeProductionLogs: activeLogs });
  if (!canResult.allowed) {
    throw new HttpsError(
      BLOCK_REASON_HTTPS[canResult.reason],
      blockReasonMessage(canResult.reason, canResult.context),
      canResult.context,
    );
  }

  const twinPath = resolveSaleTwinPath(saleLinkInput);

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

    // Solo un doc COMPLETED descontó stock al crearse: `createQuotation` no llama a
    // ninguna strategy, y el importador atribuye el descuento a la VENTA, nunca a la
    // percha (`import/page.tsx`, saleId: sale.documentNumber). Anular un doc que nunca
    // descontó devolvia stock FANTASMA — verificado en prod: 0 movimientos de stock
    // referencian una cotizacion, sobre 1.178 movimientos barridos.
    // Allowlist POSITIVA a proposito (fail-safe): un status nuevo que llegue hasta aca
    // NO toca stock, en vez de tocarlo por omision.
    const movedStock = saleData.status === "COMPLETED";
    const items = movedStock ? ((saleData.items ?? []) as AnnulSaleItem[]) : [];

    // Efecto REAL sobre el stock, resuelto por el loop de abajo. Alimenta el audit para
    // que el detalle no mienta: hasta v6.53.1 decía "Stock devuelto." SIEMPRE, hardcodeado
    // — incluso al anular una cotización (que nunca descontó) o una NC.
    let stockEffect: StockEffect = "none";

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
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.set(db.collection("kardex_movements").doc(), {
          sku: item.sku,
          date: FieldValue.serverTimestamp(),
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

        // ── Guard de 2 NIVELES: (1) ¿es NC?  (2) dentro de NC, ¿qué hizo al importar? ──
        //
        // Anular es el replay INVERSO del import, y el import bifurca en
        // `import/page.tsx:564-583`:
        //   FACTURA/BOLETA          -> writeSaleDecrement (-qty)  => anular SUMA (+qty)
        //   NC + RETURNS_STOCK      -> writeSaleReversal  (+qty)  => anular RESTA (-qty)
        //   NC + MONEY_ONLY/UNDECIDED/ausente -> no movió nada    => anular NO toca nada
        //
        // El discriminante de nivel 1 es `documentType`, el MISMO campo que usa el
        // importador. NO se usa `totalAmount < 0` (una venta legítima podría serlo) ni
        // el prefijo del id. Nivel 2 es `ncStockAction`, persistido desde P1.
        //
        // ⚠️ Los 68 docs de prod SIN `documentType` (ventas POS nativas) caen en `else`
        // y conservan el comportamiento actual — por eso el chequeo es POSITIVO
        // (`=== "NOTA CRÉDITO"`) y no negativo (`!== "FACTURA" && !== "BOLETA"`), que
        // los habría metido en la rama NC.
        const isNC = saleData.documentType === "NOTA CRÉDITO";

        if (isNC) {
          // Allowlist POSITIVA (fail-safe, misma lógica que el gate `movedStock`): un
          // valor nuevo o ausente NO toca stock. Ausente es el caso REAL de las 6 NC
          // vivas en prod, importadas antes de que P1 persistiera el campo.
          if (saleData.ncStockAction !== "RETURNS_STOCK") {
            continue;
          }

          // Si la línea no implementa la primitiva, NO caer a writeSaleReversal: eso
          // INFLARÍA el stock, que es exactamente el bug que este frente cierra.
          // Hoy es inalcanzable (las 12 NC de prod son metallic), pero si una NC de
          // otra línea llegara acá, el fail-safe es no tocar nada.
          if (!strategy.writeAnnulNCDecrement) {
            continue;
          }

          stockEffect = "withdrawn";
          strategy.writeAnnulNCDecrement(
            {
              sku: item.sku,
              quantity: item.quantity,
              newBalance: currentQty - item.quantity,
              saleId,
              customerName: saleData.customerName as string,
              sellerId: userEmail,
              frozenCost: item.baseCost ?? 0,
              ref: (saleData.metadata?.adjustedDocument as string) || undefined,
            },
            snap,
            tx,
            db,
          );
          continue;
        }

        strategy.writeSaleReversal(
          {
            sku: item.sku,
            quantity: item.quantity,
            newBalance: currentQty + item.quantity,
            saleId,
            customerName: saleData.customerName as string,
            sellerId: userEmail,
            frozenCost: item.baseCost ?? 0,
          },
          snap,
          tx,
          db,
        );
        stockEffect = "returned";
      }
    }

    // El plan se arma ACÁ y no antes de la txn (dominio puro, sin I/O — se puede llamar
    // en cualquier punto) porque `stockEffect` recién se conoce después del loop, y el
    // audit tiene que describir lo que REALMENTE pasó. De paso lee de `saleData`, que es
    // la re-lectura bajo lock, no del `preData` pre-txn.
    const cascadePlan = buildAnnulmentCascade({
      sale: {
        id: saleId,
        documentNumber: saleData.documentNumber as string | undefined,
        relatedQuotationId: saleData.relatedQuotationId as string | undefined,
        originQuoteId: saleData.originQuoteId as string | undefined,
      },
      twinPath,
      userEmail,
      reason,
      stockEffect,
    });

    for (const write of cascadePlan.writes) {
      const targetRef = db.doc(write.docPath);
      const translated = translateCascadeFields(write.fields, FieldValue, Timestamp);
      tx.update(targetRef, translated);
    }

    const auditRef = db.collection("audit_logs").doc();
    tx.set(auditRef, {
      action: "VOID_SALE",
      entityId: saleId,
      userEmail,
      details: cascadePlan.auditDetails,
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  return { success: true };
});
