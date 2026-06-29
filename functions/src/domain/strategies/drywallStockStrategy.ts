import { FieldValue } from "firebase-admin/firestore";
import * as admin from 'firebase-admin';

export interface DrywallProductionIncrementParams {
  sku: string;
  quantity: number;
  newBalance: number;
  newAverageCost: number;
  newTotalWeight: number; // For inventory_stock
  reference: string;
  operatorId: string;
  description?: string;
  userEmail?: string;
}

export interface DrywallStockStrategy {
  stockCollection: string;
  movementsCollection: string; // Wait, drywall uses kardex_movements, which is shared, but we can configure it
  getStockRef(sku: string, db: admin.firestore.Firestore): admin.firestore.DocumentReference;
  extractQuantity(snap: admin.firestore.DocumentSnapshot): number;
  extractAvgCost(snap: admin.firestore.DocumentSnapshot): number;
  extractTotalWeight(snap: admin.firestore.DocumentSnapshot): number;
  writeProductionIncrement(params: DrywallProductionIncrementParams, snap: admin.firestore.DocumentSnapshot | null, tx: admin.firestore.Transaction, db: admin.firestore.Firestore): void;
}

export const drywallStockStrategy: DrywallStockStrategy = {
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

  writeProductionIncrement({ sku, quantity, newBalance, newAverageCost, newTotalWeight, reference, operatorId, description, userEmail }, snap, tx, db) {
    const stockRef = db.collection('inventory_stock').doc(sku);

    // 1. Escribir inventory_stock
    tx.set(
      stockRef,
      {
        totalQuantity: newBalance,
        totalWeight: newTotalWeight,
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
