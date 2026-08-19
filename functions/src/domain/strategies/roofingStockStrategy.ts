import { FieldValue } from "firebase-admin/firestore";
import type { StockStrategy } from "./types";

/** Copia server-side de roofingStockStrategy en src/core/sales/strategies/index.ts. */
export const roofingStockStrategy: StockStrategy = {
  stockCollection: 'roofing_stock',
  movementsCollection: 'roofing_stock_movements',

  getStockRef(sku, db) {
    return db.collection('roofing_stock').doc(sku);
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
    const stockRef = db.collection('roofing_stock').doc(sku);
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

    tx.set(db.collection('roofing_stock_movements').doc(), {
      sku,
      type: 'SALIDA',
      quantity,
      costPerUnit: currentAvgCost,
      reason: `Venta ${saleId} — ${customerName}`,
      businessLine: 'roofing',
      createdBy: sellerId,
      createdAt: FieldValue.serverTimestamp(),
    });
  },

  writeSaleReversal({ sku, quantity, newBalance, saleId, customerName, sellerId, motivo, ref, frozenCost }, snap, tx, db) {
    const stockRef = db.collection('roofing_stock').doc(sku);
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

    tx.set(db.collection('roofing_stock_movements').doc(), {
      sku,
      type: 'ENTRADA',
      quantity,
      costPerUnit: frozenCost ?? 0,
      reason: motivo || `Anulación Venta ${saleId} — ${customerName}`,
      adjustedDocument: ref || null,
      businessLine: 'roofing',
      createdBy: sellerId,
      createdAt: FieldValue.serverTimestamp(),
    });
  },

  writeProductionIncrement({ sku, quantity, newBalance, newAverageCost, reference, operatorId, description }, snap, tx, db) {
    const stockRef = db.collection('roofing_stock').doc(sku);
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

    tx.set(db.collection('roofing_stock_movements').doc(), {
      sku,
      type: 'ENTRADA',
      quantity,
      costPerUnit: newAverageCost,
      reason: description || 'Ingreso por Producción',
      businessLine: 'roofing',
      createdBy: operatorId,
      createdAt: FieldValue.serverTimestamp(),
    });
  },
};
