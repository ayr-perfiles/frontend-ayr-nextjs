import {
  collection,
  doc,
  serverTimestamp,
  type DocumentSnapshot,
  type Firestore,
  type Transaction,
} from "firebase/firestore";
import { getStockStrategy } from "@/core/sales/strategies";
import { buildImportWrites } from "@/core/import/salesImportLogic";
import type { ParsedSale } from "@/core/import/parseImportRows";

/**
 * Transacción de importación de UNA venta. Extraída de `handleUploadToFirebase`
 * (`src/app/admin/sales/import/page.tsx`), donde vivía inline, para que la UI y los
 * tests puedan compartir una sola implementación — frente `[IMPORT-EXTRACT]`.
 *
 * En v6.82.0 (`[IMPORT-EXTRACT]`) la extracción fue un MOVIMIENTO PURO: cuerpo verbatim
 * del inline previo, sin guard nuevo y sin tocar ningún fallback.
 *
 * En v6.83.0 (`[IMPORT-OVERWRITE]`) se agregó el guard de la percha `COT-*`, que antes se
 * escribía con un `tx.set` sin `tx.get` previo: percha `CANCELLED` o con producción ACTIVA
 * ahora aborta la transacción entera. En v6.84.0 (`[IMPORT-PERCHA-ARCHIVE]`, COLA #47) se
 * agregó la otra mitad de esa misma decisión: percha `QUOTATION` SIN producción se archiva a
 * `history` antes de pisarse, igual que `saleRef` ya hace. Ver los 2 bloques marcados más
 * abajo. Los fallbacks (`?? 0`, `?? 1200`) siguen SIN tocar — son frentes propios.
 *
 * Escribe: `sales/{documentNumber}` · `sales/{documentNumber}/history/{auto}` y un
 * `audit_logs` `SALE_REPLACED` (solo si reemplaza una VOIDED) · `sales/COT-{documentNumber}`
 * (solo si el comprobante genera percha) · `sales/COT-{documentNumber}/history/{auto}` y un
 * `audit_logs` `QUOTATION_REPLACED` (solo si la percha existente estaba `QUOTATION` sin
 * producción activa) · un `audit_logs` `SALE_IMPORTED_WITH_MANUAL_NC_ACTION` (solo si la NC
 * se resolvió a mano) · y el stock de cada ítem vía la strategy de su línea. El upsert de
 * `customers` NO entra acá: vive fuera de la transacción, en un `writeBatch` propio de la
 * página.
 */
export type SaleImportTxResult = "OMITTED" | "REPLACED" | "IMPORTED";

/** Por qué se bloqueó el pisado de una percha existente. */
export type PerchaBlockReason = "CANCELLED" | "ACTIVE_PRODUCTION";

/**
 * La importación encontró una percha `COT-*` que NO se puede pisar. Aborta la
 * transacción ENTERA (nada se commitea: ni la venta, ni el archivado a `history`,
 * ni el audit de reemplazo, ni el stock).
 *
 * El call-site del importador ya tiene un `catch` que marca la fila como `ERROR`
 * con `error.message` en el resumen de import — de ahí sale el "degrada ruidoso"
 * sin cablear nada nuevo en la UI.
 */
export class PerchaOverwriteBlockedError extends Error {
  readonly quoteId: string;
  readonly reason: PerchaBlockReason;

  constructor(quoteId: string, reason: PerchaBlockReason) {
    super(
      reason === "CANCELLED"
        ? `La percha de producción ${quoteId} ya existe y está CANCELADA. Re-importar la pisaría en silencio: se aborta la importación de este comprobante. Resolvé la percha antes de re-importar.`
        : `La percha de producción ${quoteId} ya existe y tiene producción ACTIVA. Re-importar la pisaría en silencio: se aborta la importación de este comprobante. Anulá la producción antes de re-importar.`,
    );
    this.name = "PerchaOverwriteBlockedError";
    this.quoteId = quoteId;
    this.reason = reason;
  }
}

export interface SaleImportTxDeps {
  db: Firestore;
  sale: ParsedSale;
  /** `user?.uid` del contexto de auth; cae a 'sistema' igual que el inline previo. */
  userUid?: string;
  /**
   * `user?.email` del contexto de auth. Tipado `string | null` a propósito: el `email` de
   * Firebase Auth es nullable, y en `metadata.uploadedBy` se escribe SIN fallback — pasarlo
   * como `undefined` cambiaría lo que queda persistido respecto del inline previo.
   */
  userEmail?: string | null;
  /**
   * ¿La percha `COT-{documentNumber}` tiene producción ACTIVA hoy?
   *
   * Llega por parámetro y NO se consulta acá a propósito: una transacción de
   * Firestore no corre queries, solo doc-get — el mismo motivo por el que
   * `annulSale` resuelve su query de `production_logs` PRE-txn (v6.48.6). El
   * call-site la resuelve una sola vez para todo el lote
   * (`getAllActiveFulfillmentLogs` + `bucketLogsBySourceId`), no una por fila.
   *
   * Default `false`: un caller que no la pase conserva el comportamiento previo
   * para esta rama, pero el guard de `CANCELLED` (que sí se lee del doc) sigue
   * activo igual.
   */
  hasActivePerchaProduction?: boolean;
}

export async function runSaleImportTransaction(
  tx: Transaction,
  { db, sale, userUid, userEmail, hasActivePerchaProduction = false }: SaleImportTxDeps,
): Promise<SaleImportTxResult> {
  const saleRef = doc(db, "sales", sale.documentNumber);
  const existingSaleSnap = await tx.get(saleRef);
  let isReplacement = false;

  if (existingSaleSnap.exists()) {
    const existingData = existingSaleSnap.data();
    if (existingData.status === "COMPLETED") {
      return "OMITTED";
    } else if (existingData.status === "VOIDED") {
      isReplacement = true;
    } else {
      return "OMITTED";
    }
  }

  const stockRefsToRead = new Map<string, any>();
  for (const item of sale.items) {
    if (item.sku && item.sku !== "GENERIC" && !item.isCoil) {
      const strategy = getStockStrategy(item.businessLine);
      const stockRef = strategy.getStockRef(item.sku);
      stockRefsToRead.set(stockRef.path, { ref: stockRef, strategy, sku: item.sku });
    }
  }

  const stockSnaps = new Map<string, DocumentSnapshot>();
  for (const [path, info] of Array.from(stockRefsToRead.entries())) {
    const snap = await tx.get(info.ref);
    stockSnaps.set(path, snap as DocumentSnapshot);
  }

  // [IMPORT-OVERWRITE] La percha se lee ACÁ, en la fase de lecturas, aunque
  // recién más abajo se sepa si `buildImportWrites` va a emitir una: Firestore
  // exige TODOS los `tx.get` antes de cualquier `tx.set`, y el primer `tx.set`
  // (el archivado a `history` de la rama `isReplacement`) está a 3 líneas. El id
  // es determinista, así que la ref no depende de `quotationDoc`.
  const quoteId = `COT-${sale.documentNumber}`;
  const quoteRef = doc(db, "sales", quoteId);
  const existingQuoteSnap = await tx.get(quoteRef);

  if (isReplacement) {
    const existingData = existingSaleSnap.data()!;
    const historyRef = doc(collection(saleRef, "history"));
    tx.set(historyRef, {
      ...existingData,
      archivedAt: serverTimestamp(),
      archivedReason: 're-import correction',
      archivedByUserId: userUid || 'sistema',
      archivedByUserEmail: userEmail || 'sistema'
    });

    const auditRef = doc(collection(db, "audit_logs"));
    tx.set(auditRef, {
      action: 'SALE_REPLACED',
      documentNumber: sale.documentNumber,
      previousStatus: existingData.status,
      historyPath: historyRef.path,
      reason: 're-import correction',
      userId: userUid || 'sistema',
      userEmail: userEmail || 'sistema',
      timestamp: serverTimestamp(),
    });
  }

  const saleInputWithMeta = {
    ...sale,
    metadata: {
      isReplacement,
      uploadedBy: userEmail,
    },
  };
  const { saleDoc, quotationDoc } = buildImportWrites(saleInputWithMeta, serverTimestamp());

  // [IMPORT-OVERWRITE] — el guard que le faltaba a la percha. La venta (`saleRef`)
  // lo tiene desde siempre en este mismo bloque (COMPLETED -> abortar,
  // VOIDED -> archivar); `quoteRef` hacía un `tx.set` a ciegas y pisaba en
  // silencio perchas canceladas o con producción viva. Víctimas medidas en prod:
  // COT-FFA1-1255 y COT-FFA1-1250 (v6.76.0).
  //
  // Se LANZA en vez de retornar: para este punto la rama `isReplacement` ya dejó
  // stageados el `history` y el audit `SALE_REPLACED`, así que un `return` los
  // commitearía dejando la venta sin escribir. El throw aborta la transacción
  // ENTERA, que es la semántica pedida.
  //
  // [IMPORT-PERCHA-ARCHIVE] (COLA #47) — la otra mitad de la decisión de v6.76.0.
  // Percha `QUOTATION` SIN producción activa: se archiva a `history` (mismo
  // mecanismo que `saleRef` usa arriba) y RECIÉN AHÍ se pisa — nunca en silencio.
  // Alcance declarado: solo este caso. Un `blockReason` truthy sigue abortando
  // (sin tocar); cualquier otro status que no sea "QUOTATION" (no debería
  // ocurrir hoy, ver docstring de `PerchaBlockReason`) conserva el pisado ciego
  // de antes — no se inventa un tercer comportamiento sobre un caso sin RED.
  if (quotationDoc && existingQuoteSnap.exists()) {
    const existingQuote = existingQuoteSnap.data();
    const blockReason: PerchaBlockReason | null =
      existingQuote?.status === "CANCELLED"
        ? "CANCELLED"
        : hasActivePerchaProduction
          ? "ACTIVE_PRODUCTION"
          : null;

    if (blockReason) {
      throw new PerchaOverwriteBlockedError(quoteId, blockReason);
    }

    if (existingQuote?.status === "QUOTATION") {
      const quoteHistoryRef = doc(collection(quoteRef, "history"));
      tx.set(quoteHistoryRef, {
        ...existingQuote,
        archivedAt: serverTimestamp(),
        archivedReason: 're-import correction',
        archivedByUserId: userUid || 'sistema',
        archivedByUserEmail: userEmail || 'sistema',
      });

      const quoteAuditRef = doc(collection(db, "audit_logs"));
      tx.set(quoteAuditRef, {
        action: 'QUOTATION_REPLACED',
        documentNumber: quoteId,
        previousStatus: existingQuote.status,
        historyPath: quoteHistoryRef.path,
        reason: 're-import correction',
        userId: userUid || 'sistema',
        userEmail: userEmail || 'sistema',
        timestamp: serverTimestamp(),
      });
    }
  }

  tx.set(saleRef, saleDoc);
  if (quotationDoc) {
    tx.set(quoteRef, quotationDoc);
  }

  if (sale.manuallyResolvedNC) {
    const auditRef = doc(collection(db, "audit_logs"));
    tx.set(auditRef, {
      action: 'SALE_IMPORTED_WITH_MANUAL_NC_ACTION',
      entityId: sale.documentNumber,
      userEmail: userEmail || 'sistema',
      details: `El usuario decidió manualmente la acción de stock para la NC importada: ${sale.ncStockAction}`,
      timestamp: serverTimestamp(),
    });
  }

  for (const item of sale.items) {
    if (item.sku && item.sku !== "GENERIC" && !item.isCoil) {
      const strategy = getStockStrategy(item.businessLine);
      const stockRef = strategy.getStockRef(item.sku);
      const stockSnap = stockSnaps.get(stockRef.path)!;
      const currentQty = strategy.extractQuantity(stockSnap);
      const isNCWithStock = sale.documentType === 'NOTA CRÉDITO' && sale.ncStockAction === 'RETURNS_STOCK';
      const shouldMoveStock = (sale.documentType === 'FACTURA' || sale.documentType === 'BOLETA') || isNCWithStock;

      if (shouldMoveStock) {
        const newBalance = isNCWithStock ? currentQty + item.quantity : currentQty - item.quantity;
        const writeParams = {
          sku: item.sku,
          quantity: item.quantity,
          newBalance,
          saleId: sale.documentNumber,
          customerName: sale.customerName,
          sellerId: sale.sellerId || 'SISTEMA',
          avgCost: item.baseCost,
          motivo: isNCWithStock ? `NC ${sale.documentNumber}` : undefined,
          ref: sale.adjustedDocument || undefined,
          frozenCost: item.baseCost ?? 0,
        };
        if (isNCWithStock) strategy.writeSaleReversal(writeParams, stockSnap, tx);
        else strategy.writeSaleDecrement(writeParams, stockSnap, tx);
      }
    }
  }
  return isReplacement ? "REPLACED" : "IMPORTED";
}
