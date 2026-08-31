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
 * ⚠️ MOVIMIENTO PURO: el cuerpo es verbatim del inline previo. Lo único que cambió es
 * que `db`, `sale` y los 2 campos del usuario llegan por parámetro en vez de por closure.
 * NO se agregó el guard de `[IMPORT-OVERWRITE]` (`quoteRef` sigue sin `tx.get` previo),
 * ni se tocó ningún fallback. Cualquiera de esas cosas es un frente aparte, con su RED.
 *
 * Escribe: `sales/{documentNumber}` · `sales/{documentNumber}/history/{auto}` y un
 * `audit_logs` `SALE_REPLACED` (solo si reemplaza una VOIDED) · `sales/COT-{documentNumber}`
 * (solo si el comprobante genera percha) · un `audit_logs`
 * `SALE_IMPORTED_WITH_MANUAL_NC_ACTION` (solo si la NC se resolvió a mano) · y el stock de
 * cada ítem vía la strategy de su línea. El upsert de `customers` NO entra acá: vive fuera
 * de la transacción, en un `writeBatch` propio de la página.
 */
export type SaleImportTxResult = "OMITTED" | "REPLACED" | "IMPORTED";

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
}

export async function runSaleImportTransaction(
  tx: Transaction,
  { db, sale, userUid, userEmail }: SaleImportTxDeps,
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
  tx.set(saleRef, saleDoc);
  if (quotationDoc) {
    const quoteRef = doc(db, "sales", `COT-${sale.documentNumber}`);
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
