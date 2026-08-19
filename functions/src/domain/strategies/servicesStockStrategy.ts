import type { StockStrategy } from "./types";

/**
 * Copia server-side de servicesStockStrategy en src/core/sales/strategies/index.ts.
 * No-op: services no maneja stock físico. `getStockRef` apunta a la colección dummy
 * `_noop_stock` (regla `write:if false`, ya declarada en firestore.rules) para que
 * un `tx.get(ref)` no explote con permission-denied.
 */
export const servicesStockStrategy: StockStrategy = {
  stockCollection: '',
  movementsCollection: '',

  getStockRef(sku, db) {
    return db.collection('_noop_stock').doc(sku);
  },

  extractQuantity() {
    return Number.POSITIVE_INFINITY;
  },

  extractAvgCost() {
    return 0;
  },

  writeSaleDecrement() {
    // no-op: los servicios no descuentan inventario
  },

  writeSaleReversal() {
    // no-op: los servicios no reingresan inventario
  },

  writeProductionIncrement() {
    // no-op: los servicios no se producen en el sentido físico de stock
  },
};
