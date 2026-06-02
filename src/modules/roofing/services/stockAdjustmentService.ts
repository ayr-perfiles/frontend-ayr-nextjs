import { db, auth } from '@/lib/firebase/clientApp';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import type { StockMovementType } from '../types';
import type { StockMovement } from './inventoryService';

const STOCK_COL = 'roofing_stock';
const MOVEMENTS_COL = 'roofing_stock_movements';
const CATALOG_COL = 'roofing_catalog';
const AUDIT_COL = 'audit_logs';

export interface AdjustStockInput {
  sku: string;
  /** ENTRY = entrada por compra/recepción, EXIT = salida por daño/devolución, ADJUSTMENT = ajuste físico */
  type: 'ENTRY' | 'EXIT' | 'ADJUSTMENT';
  /** Siempre positivo; el type define la dirección */
  quantity: number;
  /** Solo requerido para ENTRY — dispara recálculo de costo promedio ponderado */
  unitCost?: number;
  reason: string;
  performedBy: string;
}

function toMovementType(type: AdjustStockInput['type']): StockMovementType {
  const map: Record<AdjustStockInput['type'], StockMovementType> = {
    ENTRY: 'ENTRADA',
    EXIT: 'SALIDA',
    ADJUSTMENT: 'AJUSTE',
  };
  return map[type];
}

function currentUserEmail(): string {
  return auth.currentUser?.email ?? 'sistema';
}

export async function adjustStock(input: AdjustStockInput): Promise<StockMovement> {
  if (input.quantity <= 0) {
    throw new Error('La cantidad debe ser mayor a 0.');
  }
  if (!input.reason.trim()) {
    throw new Error('El motivo del ajuste es obligatorio.');
  }
  if (input.type === 'ENTRY' && (input.unitCost === undefined || input.unitCost < 0)) {
    throw new Error('El costo unitario es obligatorio para una entrada.');
  }

  const stockRef = doc(db, STOCK_COL, input.sku);
  const catalogRef = doc(db, CATALOG_COL, input.sku);
  const movementRef = doc(collection(db, MOVEMENTS_COL));
  const auditRef = doc(collection(db, AUDIT_COL));

  return runTransaction(db, async (tx) => {
    // ── ALL READS FIRST ────────────────────────────────────────────────────
    const [stockSnap, catalogSnap] = await Promise.all([
      tx.get(stockRef),
      tx.get(catalogRef),
    ]);

    if (!catalogSnap.exists()) {
      throw new Error(`Producto no encontrado: SKU '${input.sku}'.`);
    }

    const currentQty: number = stockSnap.exists() ? (stockSnap.data().quantity as number ?? 0) : 0;
    const currentAvgCost: number = stockSnap.exists() ? (stockSnap.data().avgCost as number ?? 0) : 0;
    const productName: string = catalogSnap.data().displayName as string ?? input.sku;

    // ── COMPUTE NEW BALANCE ────────────────────────────────────────────────
    const delta =
      input.type === 'ENTRY'
        ? input.quantity
        : input.type === 'EXIT'
          ? -input.quantity
          : // ADJUSTMENT: quantity is the new absolute value
            input.quantity - currentQty;

    const newQty = currentQty + delta;

    // Weighted average cost — only recalculate on ENTRY with a positive cost
    let newAvgCost = currentAvgCost;
    const unitCost = input.unitCost ?? 0;
    if (input.type === 'ENTRY' && unitCost > 0) {
      const existingValue = currentQty > 0 ? currentQty * currentAvgCost : 0;
      const incomingValue = input.quantity * unitCost;
      const totalQtyAfter = (currentQty > 0 ? currentQty : 0) + input.quantity;
      newAvgCost = Number(((existingValue + incomingValue) / totalQtyAfter).toFixed(4));
    }

    const newTotalValue = Number((newQty * newAvgCost).toFixed(2));

    const movementData = {
      sku: input.sku,
      type: toMovementType(input.type),
      quantity: input.quantity,
      costPerUnit: unitCost,
      reason: input.reason.trim(),
      businessLine: 'roofing' as const,
      createdBy: currentUserEmail(),
      createdAt: serverTimestamp(),
    };

    const auditDetails = `[${input.type}] SKU ${input.sku} | Δ${delta > 0 ? '+' : ''}${delta} piezas | Stock: ${currentQty} → ${newQty} | Motivo: ${input.reason}`;

    // ── ALL WRITES ─────────────────────────────────────────────────────────
    tx.set(stockRef, {
      sku: input.sku,
      productName,
      quantity: newQty,
      avgCost: newAvgCost,
      totalValue: newTotalValue,
      lastUpdate: serverTimestamp(),
    });

    tx.set(movementRef, movementData);

    tx.set(auditRef, {
      action: 'ADJUST_ROOFING_STOCK',
      entityId: input.sku,
      userEmail: currentUserEmail(),
      details: auditDetails,
      timestamp: serverTimestamp(),
    });

    // Update avgCost on catalog doc so catalog page shows current cost
    tx.update(catalogRef, { avgCost: newAvgCost, updatedAt: serverTimestamp() });

    return { id: movementRef.id, ...movementData, createdAt: null } as StockMovement;
  });
}
