import { FieldValue } from "firebase-admin/firestore";
import * as admin from 'firebase-admin';
import type { StockStrategy, ProductionIncrementParams } from "./types";

/**
 * @deprecated usar `ProductionIncrementParams` (./types.ts) directamente — este
 * alias queda solo por si algo externo lo importa por nombre; `newTotalWeight`
 * ahora vive en el tipo compartido (antes duplicado acá con firma distinta, lo
 * que chocaba con StockStrategy.writeProductionIncrement al unificar el objeto).
 */
export type DrywallProductionIncrementParams = ProductionIncrementParams;

export interface DrywallStockStrategy {
  stockCollection: string;
  movementsCollection: string; // Wait, drywall uses kardex_movements, which is shared, but we can configure it
  getStockRef(sku: string, db: admin.firestore.Firestore): admin.firestore.DocumentReference;
  extractQuantity(snap: admin.firestore.DocumentSnapshot): number;
  extractAvgCost(snap: admin.firestore.DocumentSnapshot): number;
  extractTotalWeight(snap: admin.firestore.DocumentSnapshot): number;
  writeProductionIncrement(params: ProductionIncrementParams, snap: admin.firestore.DocumentSnapshot | null, tx: admin.firestore.Transaction, db: admin.firestore.Firestore): void;
}

export const drywallStockStrategy: DrywallStockStrategy & StockStrategy = {
  stockCollection: 'inventory_stock',
  movementsCollection: 'kardex_movements', // Not metallic_roofing_stock_movements! Drywall uses kardex_movements

  getStockRef(sku, db) {
    return db.collection('inventory_stock').doc(sku);
  },

  extractQuantity(snap) {
    if (!snap.exists) return 0;
    return (snap.data()?.totalQuantity as number) ?? 0;
  },

  extractAvgCost(snap) {
    if (!snap.exists) return 0;
    // En drywall, el WAC (costo promedio) se guarda en lastCostPerPiece.
    return (snap.data()?.lastCostPerPiece as number) ?? 0;
  },

  extractTotalWeight(snap) {
    if (!snap.exists) return 0;
    return (snap.data()?.totalWeight as number) ?? 0;
  },

  // writeSaleDecrement/writeSaleReversal agregados aditivamente (copia server-side
  // de src/core/sales/strategies/index.ts drywallStockStrategy) para satisfacer
  // StockStrategy — necesarios recién ahora por el callable annulSale. No tocan
  // writeProductionIncrement ni los consumidores existentes (production.ts,
  // drywallProduction.ts), que siguen usando DrywallStockStrategy sin cambios.
  writeSaleDecrement({ sku, quantity, newBalance, saleId, customerName, sellerId }, snap, tx, db) {
    const stockRef = db.collection('inventory_stock').doc(sku);

    if (snap?.exists) {
      tx.update(stockRef, { totalQuantity: newBalance, lastUpdate: FieldValue.serverTimestamp() });
    } else {
      tx.set(stockRef, { sku, totalQuantity: newBalance, totalWeight: 0, lastUpdate: FieldValue.serverTimestamp() });
    }

    tx.set(db.collection('kardex_movements').doc(), {
      sku,
      date: FieldValue.serverTimestamp(),
      type: 'OUT',
      quantity,
      balance: newBalance,
      reference: saleId,
      description: `Venta a ${customerName}`,
      user: sellerId,
    });
  },

  writeSaleReversal({ sku, quantity, newBalance, saleId, customerName, sellerId, motivo, ref }, snap, tx, db) {
    const stockRef = db.collection('inventory_stock').doc(sku);

    if (snap?.exists) {
      tx.update(stockRef, { totalQuantity: newBalance, lastUpdate: FieldValue.serverTimestamp() });
    } else {
      tx.set(stockRef, { sku, totalQuantity: newBalance, totalWeight: 0, lastUpdate: FieldValue.serverTimestamp() });
    }

    tx.set(db.collection('kardex_movements').doc(), {
      sku,
      date: FieldValue.serverTimestamp(),
      type: 'IN',
      quantity,
      balance: newBalance,
      reference: ref || saleId,
      description: motivo || `Anulación de Venta: ${customerName}`,
      user: sellerId,
    });
  },

  writeProductionIncrement({ sku, quantity, newBalance, newAverageCost, newTotalWeight, reference, operatorId, description, userEmail }, snap, tx, db) {
    const stockRef = db.collection('inventory_stock').doc(sku);

    // 1. Escribir inventory_stock
    tx.set(
      stockRef,
      {
        totalQuantity: newBalance,
        totalWeight: newTotalWeight ?? 0,
        lastCostPerPiece: newAverageCost,
        lastUpdate: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // 2. Escribir kardex_movements (drywall usa kardex_movements en vez de *_stock_movements)
    tx.set(db.collection('kardex_movements').doc(), {
      sku,
      date: FieldValue.serverTimestamp(),
      type: 'IN',
      quantity,
      balance: newBalance,
      reference,
      description: description || 'Producción desde Fleje Tercerizado',
      user: userEmail || operatorId,
    });
  },
};
