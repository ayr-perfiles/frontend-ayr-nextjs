import { db } from '@/lib/firebase/clientApp';
import {
  collection,
  doc,
  DocumentReference,
  DocumentSnapshot,
  serverTimestamp,
  Transaction,
} from 'firebase/firestore';
import type { BusinessLine } from '@/types';

export type { BusinessLine };

export interface StockWriteParams {
  sku: string;
  quantity: number;
  newBalance: number;
  saleId: string;
  customerName: string;
  sellerId: string;
  /** Costo promedio unitario — usado por roofing para registrar movimiento */
  avgCost?: number;
  /** Motivo personalizado para el movimiento de stock (ej. NC FFC1-001) */
  motivo?: string;
  /** Referencia al documento original (ej. factura ajustada) */
  ref?: string;
  /** Costo base congelado al momento de la venta. Se usa en las reversas para recalcular WAC */
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
  getStockRef(sku: string): DocumentReference;
  extractQuantity(snap: DocumentSnapshot): number;
  extractAvgCost(snap: DocumentSnapshot): number;
  /** Descuenta stock al procesar o aprobar una venta */
  writeSaleDecrement(params: StockWriteParams, snap: DocumentSnapshot | null, tx: Transaction): void;
  /** Devuelve stock al anular una venta o procesar NC */
  writeSaleReversal(params: StockWriteParams, snap: DocumentSnapshot | null, tx: Transaction): void;
  /** Incrementa stock por producción */
  writeProductionIncrement(params: ProductionIncrementParams, snap: DocumentSnapshot | null, tx: Transaction): void;
}

// ─── Drywall (perfiles) ───────────────────────────────────────────────────────
// colección: inventory_stock  campo: totalQuantity
// movimientos: kardex_movements

export const drywallStockStrategy: StockStrategy = {
  stockCollection: 'inventory_stock',
  movementsCollection: 'kardex_movements',

  getStockRef(sku) {
    return doc(db, 'inventory_stock', sku);
  },

  extractQuantity(snap) {
    if (!snap.exists()) return 0;
    return (snap.data().totalQuantity as number) ?? 0;
  },

  extractAvgCost(snap) {
    if (!snap.exists()) return 0;
    return (snap.data().lastCostPerPiece as number) ?? 0;
  },

  writeSaleDecrement({ sku, quantity, newBalance, saleId, customerName, sellerId }, snap, tx) {
    const stockRef = doc(db, 'inventory_stock', sku);
    const update = { totalQuantity: newBalance, lastUpdate: serverTimestamp() };

    if (snap?.exists()) {
      tx.update(stockRef, update);
    } else {
      tx.set(stockRef, { sku, totalQuantity: newBalance, totalWeight: 0, lastUpdate: serverTimestamp() });
    }

    tx.set(doc(collection(db, 'kardex_movements')), {
      sku,
      date: serverTimestamp(),
      type: 'OUT',
      quantity,
      balance: newBalance,
      reference: saleId,
      description: `Venta a ${customerName}`,
      user: sellerId,
    });
  },

  writeSaleReversal({ sku, quantity, newBalance, saleId, customerName, sellerId, motivo, ref }, snap, tx) {
    const stockRef = doc(db, 'inventory_stock', sku);

    if (snap?.exists()) {
      tx.update(stockRef, { totalQuantity: newBalance, lastUpdate: serverTimestamp() });
    } else {
      tx.set(stockRef, { sku, totalQuantity: newBalance, totalWeight: 0, lastUpdate: serverTimestamp() });
    }

    tx.set(doc(collection(db, 'kardex_movements')), {
      sku,
      date: serverTimestamp(),
      type: 'IN',
      quantity,
      balance: newBalance,
      reference: ref || saleId,
      description: motivo || `Anulación de Venta: ${customerName}`,
      user: sellerId,
    });
  },

  writeProductionIncrement({ sku, quantity, newBalance, newAverageCost, newWeight, reference, operatorId, description }, snap, tx) {
    const stockRef = doc(db, 'inventory_stock', sku);
    const currentWeightStock = snap?.exists() ? (snap.data().totalWeight || 0) : 0;

    tx.set(
      stockRef,
      {
        sku,
        totalQuantity: newBalance,
        totalWeight: currentWeightStock + (newWeight || 0),
        lastCostPerPiece: Number(newAverageCost.toFixed(6)),
        lastUpdate: serverTimestamp(),
      },
      { merge: true },
    );

    tx.set(doc(collection(db, 'kardex_movements')), {
      sku,
      date: serverTimestamp(),
      type: 'IN',
      quantity,
      balance: newBalance,
      reference,
      description: description || 'Ingreso por Producción',
      user: operatorId,
    });
  },
};


// ─── Roofing (PVC) ────────────────────────────────────────────────────────────
// colección: roofing_stock  campo: quantity
// movimientos: roofing_stock_movements

export const roofingStockStrategy: StockStrategy = {
  stockCollection: 'roofing_stock',
  movementsCollection: 'roofing_stock_movements',

  getStockRef(sku) {
    return doc(db, 'roofing_stock', sku);
  },

  extractQuantity(snap) {
    if (!snap.exists()) return 0;
    return (snap.data().quantity as number) ?? 0;
  },

  extractAvgCost(snap) {
    if (!snap.exists()) return 0;
    return (snap.data().avgCost as number) ?? 0;
  },

  writeSaleDecrement({ sku, quantity, newBalance, saleId, customerName, sellerId }, snap, tx) {
    const stockRef = doc(db, 'roofing_stock', sku);
    const currentAvgCost = snap?.exists() ? ((snap.data().avgCost as number) ?? 0) : 0;
    const productName = snap?.exists() ? ((snap.data().productName as string) ?? sku) : sku;

    if (snap?.exists()) {
      tx.update(stockRef, {
        quantity: newBalance,
        totalValue: Number((newBalance * currentAvgCost).toFixed(2)),
        lastUpdate: serverTimestamp(),
      });
    } else {
      tx.set(stockRef, {
        sku,
        productName,
        quantity: newBalance,
        avgCost: 0,
        totalValue: 0,
        lastUpdate: serverTimestamp(),
      });
    }

    tx.set(doc(collection(db, 'roofing_stock_movements')), {
      sku,
      type: 'SALIDA',
      quantity,
      costPerUnit: currentAvgCost,
      reason: `Venta ${saleId} — ${customerName}`,
      businessLine: 'roofing',
      createdBy: sellerId,
      createdAt: serverTimestamp(),
    });
  },

  writeSaleReversal({ sku, quantity, newBalance, saleId, customerName, sellerId, motivo, ref, frozenCost }, snap, tx) {
    const stockRef = doc(db, 'roofing_stock', sku);
    const currentQty = snap?.exists() ? ((snap.data().quantity as number) ?? 0) : 0;
    const currentAvgCost = snap?.exists() ? ((snap.data().avgCost as number) ?? 0) : 0;
    const currentTotalValue = snap?.exists() ? ((snap.data().totalValue as number) ?? (currentQty * currentAvgCost)) : 0;
    const productName = snap?.exists() ? ((snap.data().productName as string) ?? sku) : sku;

    const returnedValue = quantity * (frozenCost ?? 0);
    const newTotalValue = currentTotalValue + returnedValue;
    const newAvgCost = newBalance > 0 ? newTotalValue / newBalance : 0;

    if (snap?.exists()) {
      tx.update(stockRef, {
        quantity: newBalance,
        avgCost: Number(newAvgCost.toFixed(6)),
        totalValue: Number(newTotalValue.toFixed(2)),
        lastUpdate: serverTimestamp(),
      });
    } else {
      tx.set(stockRef, {
        sku,
        productName,
        quantity: newBalance,
        avgCost: 0,
        totalValue: 0,
        lastUpdate: serverTimestamp(),
      });
    }

    tx.set(doc(collection(db, 'roofing_stock_movements')), {
      sku,
      type: 'ENTRADA',
      quantity,
      costPerUnit: frozenCost ?? 0,
      reason: motivo || `Anulación Venta ${saleId} — ${customerName}`,
      adjustedDocument: ref || null,
      businessLine: 'roofing',
      createdBy: sellerId,
      createdAt: serverTimestamp(),
    });
  },

  writeProductionIncrement({ sku, quantity, newBalance, newAverageCost, reference, operatorId, description }, snap, tx) {
    const stockRef = doc(db, 'roofing_stock', sku);
    const productName = snap?.exists() ? ((snap.data().productName as string) ?? sku) : sku;

    tx.set(
      stockRef,
      {
        sku,
        productName,
        quantity: newBalance,
        avgCost: Number(newAverageCost.toFixed(6)),
        totalValue: Number((newBalance * newAverageCost).toFixed(2)),
        lastUpdate: serverTimestamp(),
      },
      { merge: true },
    );

    tx.set(doc(collection(db, 'roofing_stock_movements')), {
      sku,
      type: 'ENTRADA',
      quantity,
      costPerUnit: newAverageCost,
      reason: description || 'Ingreso por Producción',
      businessLine: 'roofing',
      createdBy: operatorId,
      createdAt: serverTimestamp(),
    });
  },
};


// ─── Metallic-Roofing (coberturas aluzinc) ────────────────────────────────────
// colección: metallic_roofing_stock  campo: quantity
// movimientos: metallic_roofing_stock_movements

export const metallicRoofingStockStrategy: StockStrategy = {
  stockCollection: 'metallic_roofing_stock',
  movementsCollection: 'metallic_roofing_stock_movements',

  getStockRef(sku) {
    return doc(db, 'metallic_roofing_stock', sku);
  },

  extractQuantity(snap) {
    if (!snap.exists()) return 0;
    return (snap.data().quantity as number) ?? 0;
  },

  extractAvgCost(snap) {
    if (!snap.exists()) return 0;
    return (snap.data().avgCost as number) ?? 0;
  },

  writeSaleDecrement({ sku, quantity, newBalance, saleId, customerName, sellerId }, snap, tx) {
    const stockRef = doc(db, 'metallic_roofing_stock', sku);
    const currentAvgCost = snap?.exists() ? ((snap.data().avgCost as number) ?? 0) : 0;
    const productName = snap?.exists() ? ((snap.data().productName as string) ?? sku) : sku;

    if (snap?.exists()) {
      tx.update(stockRef, {
        quantity: newBalance,
        totalValue: Number((newBalance * currentAvgCost).toFixed(2)),
        lastUpdate: serverTimestamp(),
      });
    } else {
      tx.set(stockRef, {
        sku,
        productName,
        quantity: newBalance,
        avgCost: 0,
        totalValue: 0,
        lastUpdate: serverTimestamp(),
      });
    }

    tx.set(doc(collection(db, 'metallic_roofing_stock_movements')), {
      sku,
      type: 'SALIDA',
      quantity,
      costPerUnit: currentAvgCost,
      reason: `Venta ${saleId} — ${customerName}`,
      businessLine: 'metallic-roofing',
      createdBy: sellerId,
      createdAt: serverTimestamp(),
    });
  },

  writeSaleReversal({ sku, quantity, newBalance, saleId, customerName, sellerId, motivo, ref, frozenCost }, snap, tx) {
    const stockRef = doc(db, 'metallic_roofing_stock', sku);
    const currentQty = snap?.exists() ? ((snap.data().quantity as number) ?? 0) : 0;
    const currentAvgCost = snap?.exists() ? ((snap.data().avgCost as number) ?? 0) : 0;
    const currentTotalValue = snap?.exists() ? ((snap.data().totalValue as number) ?? (currentQty * currentAvgCost)) : 0;
    const productName = snap?.exists() ? ((snap.data().productName as string) ?? sku) : sku;

    const returnedValue = quantity * (frozenCost ?? 0);
    const newTotalValue = currentTotalValue + returnedValue;
    const newAvgCost = newBalance > 0 ? newTotalValue / newBalance : 0;

    if (snap?.exists()) {
      tx.update(stockRef, {
        quantity: newBalance,
        avgCost: Number(newAvgCost.toFixed(6)),
        totalValue: Number(newTotalValue.toFixed(2)),
        lastUpdate: serverTimestamp(),
      });
    } else {
      tx.set(stockRef, {
        sku,
        productName,
        quantity: newBalance,
        avgCost: 0,
        totalValue: 0,
        lastUpdate: serverTimestamp(),
      });
    }

    tx.set(doc(collection(db, 'metallic_roofing_stock_movements')), {
      sku,
      type: 'ENTRADA',
      quantity,
      costPerUnit: frozenCost ?? 0,
      reason: motivo || `Anulación Venta ${saleId} — ${customerName}`,
      adjustedDocument: ref || null,
      businessLine: 'metallic-roofing',
      createdBy: sellerId,
      createdAt: serverTimestamp(),
    });
  },

  writeProductionIncrement({ sku, quantity, newBalance, newAverageCost, reference, operatorId, description }, snap, tx) {
    const stockRef = doc(db, 'metallic_roofing_stock', sku);
    const productName = snap?.exists() ? ((snap.data().productName as string) ?? sku) : sku;

    tx.set(
      stockRef,
      {
        sku,
        productName,
        quantity: newBalance,
        avgCost: Number(newAverageCost.toFixed(6)),
        totalValue: Number((newBalance * newAverageCost).toFixed(2)),
        lastUpdate: serverTimestamp(),
      },
      { merge: true },
    );

    tx.set(doc(collection(db, 'metallic_roofing_stock_movements')), {
      sku,
      type: 'ENTRADA',
      quantity,
      costPerUnit: newAverageCost,
      reason: description || 'Ingreso por Producción',
      businessLine: 'metallic-roofing',
      createdBy: operatorId,
      createdAt: serverTimestamp(),
    });
  },
};

// ─── Trading (reventa) ────────────────────────────────────────────────────────
// colección: trading_stock  campo: quantity
// movimientos: trading_stock_movements

export const tradingStockStrategy: StockStrategy = {
  stockCollection: 'trading_stock',
  movementsCollection: 'trading_stock_movements',

  getStockRef(sku) {
    return doc(db, 'trading_stock', sku);
  },

  extractQuantity(snap) {
    if (!snap.exists()) return 0;
    return (snap.data().quantity as number) ?? 0;
  },

  extractAvgCost(snap) {
    if (!snap.exists()) return 0;
    return (snap.data().avgCost as number) ?? 0;
  },

  writeSaleDecrement({ sku, quantity, newBalance, saleId, customerName, sellerId }, snap, tx) {
    const stockRef = doc(db, 'trading_stock', sku);
    const currentAvgCost = snap?.exists() ? ((snap.data().avgCost as number) ?? 0) : 0;
    const productName = snap?.exists() ? ((snap.data().productName as string) ?? sku) : sku;

    if (snap?.exists()) {
      tx.update(stockRef, {
        quantity: newBalance,
        totalValue: Number((newBalance * currentAvgCost).toFixed(2)),
        lastUpdate: serverTimestamp(),
      });
    } else {
      tx.set(stockRef, {
        sku,
        productName,
        quantity: newBalance,
        avgCost: 0,
        totalValue: 0,
        lastUpdate: serverTimestamp(),
      });
    }

    tx.set(doc(collection(db, 'trading_stock_movements')), {
      sku,
      type: 'SALIDA',
      quantity,
      costPerUnit: currentAvgCost,
      reason: `Venta ${saleId} — ${customerName}`,
      businessLine: 'trading',
      createdBy: sellerId,
      createdAt: serverTimestamp(),
    });
  },

  writeSaleReversal({ sku, quantity, newBalance, saleId, customerName, sellerId, motivo, ref, frozenCost }, snap, tx) {
    const stockRef = doc(db, 'trading_stock', sku);
    const currentQty = snap?.exists() ? ((snap.data().quantity as number) ?? 0) : 0;
    const currentAvgCost = snap?.exists() ? ((snap.data().avgCost as number) ?? 0) : 0;
    const currentTotalValue = snap?.exists() ? ((snap.data().totalValue as number) ?? (currentQty * currentAvgCost)) : 0;
    const productName = snap?.exists() ? ((snap.data().productName as string) ?? sku) : sku;

    const returnedValue = quantity * (frozenCost ?? 0);
    const newTotalValue = currentTotalValue + returnedValue;
    const newAvgCost = newBalance > 0 ? newTotalValue / newBalance : 0;

    if (snap?.exists()) {
      tx.update(stockRef, {
        quantity: newBalance,
        avgCost: Number(newAvgCost.toFixed(6)),
        totalValue: Number(newTotalValue.toFixed(2)),
        lastUpdate: serverTimestamp(),
      });
    } else {
      tx.set(stockRef, {
        sku,
        productName,
        quantity: newBalance,
        avgCost: 0,
        totalValue: 0,
        lastUpdate: serverTimestamp(),
      });
    }

    tx.set(doc(collection(db, 'trading_stock_movements')), {
      sku,
      type: 'ENTRADA',
      quantity,
      costPerUnit: frozenCost ?? 0,
      reason: motivo || `Anulación Venta ${saleId} — ${customerName}`,
      adjustedDocument: ref || null,
      businessLine: 'trading',
      createdBy: sellerId,
      createdAt: serverTimestamp(),
    });
  },

  writeProductionIncrement({ sku, quantity, newBalance, newAverageCost, reference, operatorId, description }, snap, tx) {
    const stockRef = doc(db, 'trading_stock', sku);
    const productName = snap?.exists() ? ((snap.data().productName as string) ?? sku) : sku;

    tx.set(
      stockRef,
      {
        sku,
        productName,
        quantity: newBalance,
        avgCost: Number(newAverageCost.toFixed(6)),
        totalValue: Number((newBalance * newAverageCost).toFixed(2)),
        lastUpdate: serverTimestamp(),
      },
      { merge: true },
    );

    tx.set(doc(collection(db, 'trading_stock_movements')), {
      sku,
      type: 'ENTRADA',
      quantity,
      costPerUnit: newAverageCost,
      reason: description || 'Ingreso por Compra/Ajuste',
      businessLine: 'trading',
      createdBy: operatorId,
      createdAt: serverTimestamp(),
    });
  },
};


// ─── Services (mano de obra, sin stock) — NO-OP ───────────────
// colección: ninguna
// movimientos: ninguno

export const servicesStockStrategy: StockStrategy = {
  stockCollection: '',
  movementsCollection: '',

  getStockRef(sku) {
    // Retorna una referencia dummy para no romper `tx.get(ref)`
    // Documentación: No inventar side-effects ni cambiar a null,
    // el core de ventas hará una lectura inútil que fallará gracefully.
    return doc(db, '_noop_stock', sku);
  },

  extractQuantity() {
    // Los servicios nunca se quedan sin stock
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

// ─── Registry ─────────────────────────────────────────────────────────────────

export function getStockStrategy(businessLine: BusinessLine | string): StockStrategy {
  switch (businessLine) {
    case 'drywall':
      return drywallStockStrategy;
    case 'roofing':
      return roofingStockStrategy;
    case 'metallic-roofing':
      return metallicRoofingStockStrategy;
    case 'trading':
      return tradingStockStrategy;
    case 'services':
      return servicesStockStrategy;
    default:
      throw new Error(`Línea de negocio no soportada: ${businessLine}`);
  }
}
