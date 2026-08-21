import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { buildQuotationDoc, type InputSaleItem } from "../domain/quotation/buildQuotationDoc";
import { isImportedQuotation } from "../domain/quotation/isImportedQuotation";
import { hasActiveProductionForQuote } from "../utils/hasActiveProductionForQuote";
import { getStockStrategy } from "../domain/strategies";

/**
 * `editQuotation` — edición server-side de una cotización NATIVA en estado QUOTATION.
 *
 * Decisiones lockeadas que este callable implementa:
 *   D1      solo cotización NATIVA en `QUOTATION` (una percha importada NO se edita).
 *   D3/D8   TODO lo del doc `sales` pasa por acá (los maestros `customers`/`contacts` NO
 *           son asunto de este callable — solo los campos de cliente DENORMALIZADOS
 *           dentro del propio doc).
 *   D4/D10  bloqueo TOTAL si hay `production_log` ACTIVE: con producción viva no se edita
 *           nada, ni siquiera metadata.
 *   D9/Q2b  `baseCost` se recomputa server-side SOLO si el WAC vivo del SKU es > 0; si es
 *           0 o negativo se PRESERVA el del ítem (append-only sobre el costo).
 *   D13     queda `QUOTATION` in-place, sin ningún efecto de stock.
 *   Q3      el form manda el ítem COMPLETO; acá solo se recomputa `baseCost`.
 *   Q5      los totales los calcula el builder (profit por ítem sobre `unitValue`).
 *
 * ── LOS 2 INVARIANTES QUE NO SE PUEDEN VIOLAR ──
 *
 * T1 — NUNCA se reenvían totales del cliente al builder. El input del builder se ENUMERA
 *      campo por campo (nunca un spread de `request.data`), así que un `totalAmount`
 *      inyectado no tiene por dónde llegar. `firestore.rules` protege esos campos contra
 *      escritura client-side justamente porque son el snapshot financiero.
 *
 * T2 — NUNCA se hace `set()` del output del builder sobre el doc existente. El builder
 *      emite un doc de CREACIÓN (19 claves) que pisaría `productionStatus` (CONFIRMED ->
 *      PENDING, o sea que la cotización saldría de la cola de producción), `timestamp`,
 *      `isFulfilled`, `confirmedBy`, `confirmedForProductionAt`, `convertedToId`,
 *      `costSyncedAt` y `annulledSaleRef`. En su lugar: `update()` con un mapa EXPLÍCITO
 *      de los 14 campos que la edición cambia legítimamente. Todo lo que no está en el
 *      mapa se preserva por construcción — esa es la propiedad que hace segura la
 *      operación.
 */

export interface EditQuotationItem {
  sku: string;
  productName?: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  unitValue?: number;
  baseCost?: number;
  businessLine?: string;
  unitWeight?: number;
  calculatedWeight?: number;
  unitOfMeasure?: string;
  isCoil?: boolean;
  weightSnapshot?: unknown;
  piecesCount?: number;
  pieceLengthM?: number;
  flags?: string[];
  profit?: number;
}

/**
 * NOTA (T1): este tipo NO declara `totalAmount`/`totalCost`/`totalProfit`/`totalWeight`,
 * y tampoco `status`/`productionStatus`/`sellerId`/`paymentStatus`/`timestamp`. No es solo
 * omisión de tipo: el handler enumera qué le pasa al builder, así que aunque el cliente los
 * mande en el JSON, no llegan a ningún lado.
 */
export interface EditQuotationData {
  quotationId: string;
  items: EditQuotationItem[];
  customerName?: string;
  customerDocument?: string;
  documentNumber?: string;
  contactName?: string;
  contactPhone?: string;
  customerAddress?: string;
}

/** Las 5 líneas que `getStockStrategy` sabe resolver. Cualquier otra cosa lanza. */
const KNOWN_LINES = new Set(["drywall", "roofing", "metallic-roofing", "trading", "services"]);

/**
 * ¿Se puede recomputar el `baseCost` de este ítem contra un WAC vivo?
 *
 *  - `isCoil`: NO. Una bobina es un ítem físico único, no un pool con WAC — su `baseCost`
 *    es `pricePerKg` (S/ por KG) y su `quantity` son kilos. Recomputarlo contra la
 *    colección de stock mezclaría unidades. (El selector de bobina emite
 *    `businessLine: "drywall"` + `isCoil: true`, así que sin este guard iría a leer
 *    `inventory_stock/{coilId}`, que es la colección equivocada.)
 *  - línea desconocida / vacía: NO. `getStockStrategy('')` LANZA un Error genérico, no un
 *    HttpsError. El builder en cambio tolera esos ítems (les pone `bl:''` + flag
 *    'linea no resuelta'), así que acá también se toleran: preservar es fail-safe.
 *  - sku vacío o 'GENERIC': NO. No hay doc de stock que leer.
 */
function isRecomputable(item: EditQuotationItem): boolean {
  if (item.isCoil) return false;
  if (!item.sku || item.sku === "GENERIC") return false;
  return KNOWN_LINES.has(item.businessLine ?? "");
}

export const editQuotation = onCall<EditQuotationData>(async (request) => {
  // ── Guard 1: auth ────────────────────────────────────────────────────────
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login requerido");
  }
  const userEmail = request.auth.token.email;
  if (!userEmail) {
    throw new HttpsError("unauthenticated", "Email requerido en el token");
  }

  // ── Guard 2: rol — ADMIN-only (D-Q6). annulSale acepta SUPERVISOR; esto NO. ──
  if (request.auth.token.role !== "ADMIN") {
    throw new HttpsError("permission-denied", "Solo ADMIN puede editar cotizaciones.");
  }

  // ── Guard 3: input ───────────────────────────────────────────────────────
  const data = request.data ?? ({} as EditQuotationData);
  const quotationId = data.quotationId;
  if (!quotationId || typeof quotationId !== "string" || quotationId.trim() === "") {
    throw new HttpsError("invalid-argument", "quotationId es obligatorio.");
  }
  const items = data.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpsError("invalid-argument", "La cotización debe tener al menos un ítem.");
  }

  const db = admin.firestore();
  const quoteRef = db.collection("sales").doc(quotationId);

  // ── PRE-TXN ──────────────────────────────────────────────────────────────
  // Firestore no admite queries dentro de una transacción, así que el pre-check de
  // producción (que es una query) va ANTES de abrir la txn — mismo patrón que annulSale.
  const preSnap = await quoteRef.get();
  if (!preSnap.exists) {
    throw new HttpsError("not-found", "La cotización no existe.");
  }
  const preData = preSnap.data()!;

  // ── Guard 4: estado ──
  if (preData.status !== "QUOTATION") {
    throw new HttpsError(
      "failed-precondition",
      `Solo se puede editar una cotización vigente (estado actual: ${preData.status ?? "desconocido"}).`,
    );
  }

  // ── Guard 5: origen (D1) ──
  if (isImportedQuotation(preData)) {
    throw new HttpsError(
      "failed-precondition",
      "Una cotización importada no se edita: es el espejo de una factura ya emitida. " +
        "Editarla desincronizaría la venta gemela.",
      { quotationId },
    );
  }

  // ── Guard 6: producción activa (D4/D10) ──
  const production = await hasActiveProductionForQuote(quotationId, db);
  if (production.hasActive) {
    throw new HttpsError(
      "failed-precondition",
      `No se puede editar la cotización ${quotationId}: tiene producción activa. Anulá la producción primero.`,
      { quotationId, activeLogIds: production.activeLogIds },
    );
  }

  // ── TXN ──────────────────────────────────────────────────────────────────
  await db.runTransaction(async (tx) => {
    // Re-lock + re-validar (defensa contra carrera entre el pre-check y la txn).
    // La producción NO se re-chequea acá: una txn no corre queries. Misma limitación
    // aceptada que en annulSale/#9-B.2b.
    const snap = await tx.get(quoteRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "La cotización no existe.");
    }
    if (snap.data()!.status !== "QUOTATION") {
      throw new HttpsError("failed-precondition", "La cotización dejó de estar vigente.");
    }

    // ── LECTURAS (todas antes de cualquier escritura, exigencia de Firestore) ──
    // Clave compuesta `línea:sku` para no colisionar entre líneas que compartan SKU.
    const stockSnapshots = new Map<string, admin.firestore.DocumentSnapshot>();
    for (const item of items) {
      if (!isRecomputable(item)) continue;
      const line = item.businessLine as string;
      const key = `${line}:${item.sku}`;
      if (!stockSnapshots.has(key)) {
        const strategy = getStockStrategy(line);
        stockSnapshots.set(key, await tx.get(strategy.getStockRef(item.sku, db)));
      }
    }

    // ── Q2(b): resolver baseCost por ítem, ANTES de construir ──
    // Una sola pasada del builder: NO es idempotente en las flags (`itemFlags` arranca de
    // `rawItem.flags`), así que construir -> recomputar -> construir dejaría pegada una
    // flag 'sin costo' de la primera pasada aunque el costo ya fuera > 0.
    const resolvedItems: InputSaleItem[] = items.map((item) => {
      let baseCost = item.baseCost ?? 0;

      if (isRecomputable(item)) {
        const line = item.businessLine as string;
        const strategy = getStockStrategy(line);
        const snapshot = stockSnapshots.get(`${line}:${item.sku}`);
        const liveWac = snapshot ? strategy.extractAvgCost(snapshot) : 0;
        // Solo pisa si hay un WAC vivo REAL. 7 de 18 SKUs de metallic en prod están en 0
        // y hay cantidades negativas: sin este guard, editar metería basura en el costo.
        if (liveWac > 0) baseCost = liveWac;
      }

      // Se enumeran los campos (nada de spread): el ítem que llega del cliente no puede
      // colar claves que el builder no conoce.
      const resolved: InputSaleItem = {
        sku: item.sku,
        productName: item.productName ?? item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitValue: item.unitValue,
        baseCost,
        businessLine: item.businessLine,
        unitWeight: item.unitWeight,
        calculatedWeight: item.calculatedWeight,
        unitOfMeasure: item.unitOfMeasure,
        isCoil: item.isCoil,
        flags: item.flags,
      };
      if (item.weightSnapshot) resolved.weightSnapshot = item.weightSnapshot;
      if (item.piecesCount !== undefined) resolved.piecesCount = item.piecesCount;
      if (item.pieceLengthM !== undefined) resolved.pieceLengthM = item.pieceLengthM;
      return resolved;
    });

    // ── Builder (E1) — T1: se enumeran los campos, NO se reenvían totales del cliente ──
    // El `timestamp` que se le pasa es el ORIGINAL y su salida se descarta (no se escribe);
    // se lo pasa solo para que el objeto sea coherente si alguien lo loguea.
    const built = buildQuotationDoc(
      {
        customerName: data.customerName,
        customerDocument: data.customerDocument,
        documentNumber: data.documentNumber,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        customerAddress: data.customerAddress,
        items: resolvedItems,
      },
      preData.timestamp,
    );

    // ── T2: update SELECTIVO. 14 campos; los otros 5 del builder (status,
    // productionStatus, paymentStatus, sellerId, timestamp) y TODO el ciclo de vida
    // quedan intactos por no estar acá. ──
    tx.update(quoteRef, {
      // Campos de cliente denormalizados (editables)
      customerName: built.customerName,
      customerDocument: built.customerDocument,
      documentNumber: built.documentNumber,
      contactName: built.contactName,
      contactPhone: built.contactPhone,
      customerAddress: built.customerAddress,
      // Contenido
      items: built.items,
      // Derivados por el builder
      businessLines: built.businessLines,
      skus: built.skus,
      totalAmount: built.totalAmount,
      totalCost: built.totalCost,
      totalProfit: built.totalProfit,
      totalWeight: built.totalWeight,
      allFlags: built.allFlags,
      // Trazabilidad de la edición
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userEmail,
    });

    const auditRef = db.collection("audit_logs").doc();
    tx.set(auditRef, {
      action: "EDIT_QUOTATION",
      entityId: quotationId,
      userEmail,
      details:
        `Cotización ${quotationId} editada. ${built.items.length} ítem(s), ` +
        `total S/ ${built.totalAmount.toFixed(2)}.`,
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  const after = await quoteRef.get();
  const afterData = after.data()!;
  return {
    success: true,
    quotationId,
    itemCount: (afterData.items ?? []).length,
    totalAmount: afterData.totalAmount,
  };
});
