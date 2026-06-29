import { FieldValue } from "firebase-admin/firestore";
import * as admin from 'firebase-admin';

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
}

export const metallicRoofingStockStrategy: StockStrategy = {
  stockCollection: 'metallic_roofing_stock',
  movementsCollection: 'metallic_roofing_stock_movements',

  getStockRef(sku, db) {
    return db.collection('metallic_roofing_stock').doc(sku);
  },

  extractQuantity(snap) {
    if (!snap.exists) return 0;
    return (snap.data()?.quantity as number) ?? 0;
  },

  extractAvgCost(snap) {
    if (!snap.exists) return 0;
    return (snap.data()?.avgCost as number) ?? 0;
  },

  writeSaleDecrement({ sku, quantity, newBalance, saleId, customerName, sellerId }, snap, tx, db) {
    const stockRef = db.collection('metallic_roofing_stock').doc(sku);
    const currentAvgCost = snap?.exists ? ((snap.data()?.avgCost as number) ?? 0) : 0;
    const productName = snap?.exists ? ((snap.data()?.productName as string) ?? sku) : sku;

    if (snap?.exists) {
      tx.update(stockRef, {
        quantity: newBalance,
        totalValue: Number((newBalance * currentAvgCost).toFixed(2)),
        lastUpdate: FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(stockRef, {
        sku,
        productName,
        quantity: newBalance,
        avgCost: 0,
        totalValue: 0,
        lastUpdate: FieldValue.serverTimestamp(),
      });
    }

    tx.set(db.collection('metallic_roofing_stock_movements').doc(), {
      sku,
      type: 'SALIDA',
      quantity,
      costPerUnit: currentAvgCost,
      reason: `Venta ${saleId} — ${customerName}`,
      businessLine: 'metallic-roofing',
      createdBy: sellerId,
      createdAt: FieldValue.serverTimestamp(),
    });
  },

  writeSaleReversal({ sku, quantity, newBalance, saleId, customerName, sellerId, motivo, ref, frozenCost }, snap, tx, db) {
    const stockRef = db.collection('metallic_roofing_stock').doc(sku);
    const currentQty = snap?.exists ? ((snap.data()?.quantity as number) ?? 0) : 0;
    const currentAvgCost = snap?.exists ? ((snap.data()?.avgCost as number) ?? 0) : 0;
    const currentTotalValue = snap?.exists ? ((snap.data()?.totalValue as number) ?? (currentQty * currentAvgCost)) : 0;
    const productName = snap?.exists ? ((snap.data()?.productName as string) ?? sku) : sku;

    const returnedValue = quantity * (frozenCost ?? 0);
    const newTotalValue = currentTotalValue + returnedValue;
    const newAvgCost = newBalance > 0 ? newTotalValue / newBalance : 0;

    if (snap?.exists) {
      tx.update(stockRef, {
        quantity: newBalance,
        avgCost: Number(newAvgCost.toFixed(6)),
        totalValue: Number(newTotalValue.toFixed(2)),
        lastUpdate: FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(stockRef, {
        sku,
        productName,
        quantity: newBalance,
        avgCost: 0,
        totalValue: 0,
        lastUpdate: FieldValue.serverTimestamp(),
      });
    }

    tx.set(db.collection('metallic_roofing_stock_movements').doc(), {
      sku,
      type: 'ENTRADA',
      quantity,
      costPerUnit: frozenCost ?? 0,
      reason: motivo || `Anulación Venta ${saleId} — ${customerName}`,
      adjustedDocument: ref || null,
      businessLine: 'metallic-roofing',
      createdBy: sellerId,
      createdAt: FieldValue.serverTimestamp(),
    });
  },

  writeProductionIncrement({ sku, quantity, newBalance, newAverageCost, reference, operatorId, description }, snap, tx, db) {
    const stockRef = db.collection('metallic_roofing_stock').doc(sku);
    const productName = snap?.exists ? ((snap.data()?.productName as string) ?? sku) : sku;

    tx.set(
      stockRef,
      {
        sku,
        productName,
        quantity: newBalance,
        avgCost: Number(newAverageCost.toFixed(6)),
        totalValue: Number((newBalance * newAverageCost).toFixed(2)),
        lastUpdate: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    tx.set(db.collection('metallic_roofing_stock_movements').doc(), {
      sku,
      type: 'ENTRADA',
      quantity,
      costPerUnit: newAverageCost,
      reason: description || 'Ingreso por Producción',
      businessLine: 'metallic-roofing',
      createdBy: operatorId,
      createdAt: FieldValue.serverTimestamp(),
    });
  },
};
