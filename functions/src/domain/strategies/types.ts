import * as admin from "firebase-admin";

/**
 * Interfaz compartida server-side, espejo de `StockStrategy` en
 * src/core/sales/strategies/index.ts (client SDK). Extraída acá (antes vivía
 * inline y duplicada dentro de metallicRoofingStockStrategy.ts) para que
 * roofing/trading/services la reusen sin re-declararla cada vez.
 */
export interface StockWriteParams {
  sku: string;
  quantity: number;
  newBalance: number;
  saleId: string;
  customerName: string;
  sellerId: string;
  avgCost?: number;
  motivo?: string;
  ref?: string;
  frozenCost?: number;
}

export interface ProductionIncrementParams {
  sku: string;
  quantity: number;
  newBalance: number;
  newAverageCost: number;
  newWeight?: number;
  reference: string;
  operatorId: string;
  description?: string;
  /** Solo drywall (inventory_stock guarda totalWeight, no newWeight incremental). */
  newTotalWeight?: number;
  /** Solo drywall: preferido sobre operatorId como `user` del kardex_movement si viene. */
  userEmail?: string;
}

export interface StockStrategy {
  stockCollection: string;
  movementsCollection: string;
  getStockRef(sku: string, db: admin.firestore.Firestore): admin.firestore.DocumentReference;
  extractQuantity(snap: admin.firestore.DocumentSnapshot): number;
  extractAvgCost(snap: admin.firestore.DocumentSnapshot): number;
  writeSaleDecrement(params: StockWriteParams, snap: admin.firestore.DocumentSnapshot | null, tx: admin.firestore.Transaction, db: admin.firestore.Firestore): void;
  writeSaleReversal(params: StockWriteParams, snap: admin.firestore.DocumentSnapshot | null, tx: admin.firestore.Transaction, db: admin.firestore.Firestore): void;
  writeProductionIncrement(params: ProductionIncrementParams, snap: admin.firestore.DocumentSnapshot | null, tx: admin.firestore.Transaction, db: admin.firestore.Firestore): void;
  /**
   * Anulación de una NOTA DE CRÉDITO que al importarse REPUSO stock
   * (`ncStockAction: 'RETURNS_STOCK'` ⇒ `writeSaleReversal`, +qty, movimiento ENTRADA).
   * Anularla es el replay INVERSO: saca esos mismos kilos y emite una SALIDA.
   *
   * OPCIONAL a propósito. Las 12 NC que existen en prod son 100% `metallic-roofing`
   * (verificado en el recon del frente), así que solo esa strategy la implementa —
   * declararla obligatoria forzaría 4 implementaciones muertas. El caller debe
   * chequear que exista: si una NC de otra línea apareciera, el fail-safe es NO tocar
   * stock (ver el guard en callables/sales.ts), nunca caer a `writeSaleReversal`, que
   * inflaría el inventario. Deuda nombrada en HANDOFF cuando eso ocurra.
   *
   * Igual que sus 2 hermanas, NO calcula el signo: recibe `newBalance` ya resuelto.
   */
  writeAnnulNCDecrement?(params: StockWriteParams, snap: admin.firestore.DocumentSnapshot | null, tx: admin.firestore.Transaction, db: admin.firestore.Firestore): void;
}
