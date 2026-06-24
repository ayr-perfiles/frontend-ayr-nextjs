import { db, auth } from '@/lib/firebase/clientApp';
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
  Timestamp,
  limit,
} from 'firebase/firestore';
import type { Purchase, PurchaseFilters } from './types';
import { PurchaseSchema } from './schemas';

const PURCHASES_COL = 'purchases';
const AUDIT_COL = 'audit_logs';

const LINE_CONFIG: Record<string, { stock: string; movements: string; catalog: string }> = {
  trading: {
    stock: 'trading_stock',
    movements: 'trading_stock_movements',
    catalog: 'trading_catalog',
  },
  roofing: {
    stock: 'roofing_stock',
    movements: 'roofing_stock_movements',
    catalog: 'roofing_catalog',
  },
};

export async function registerPurchase(input: Omit<Purchase, 'status' | 'createdAt' | 'createdBy'>): Promise<string> {
  const validated = PurchaseSchema.parse(input);
  const userEmail = auth.currentUser?.email ?? 'sistema';
  
  // 1. Idempotency Check (RUC + Invoice Number)
  const q = query(
    collection(db, PURCHASES_COL),
    where('supplier.ruc', '==', validated.supplier.ruc),
    where('invoice.number', '==', validated.invoice.number),
    limit(1)
  );
  
  const existingSnap = await getDocs(q);
  if (!existingSnap.empty) {
    return existingSnap.docs[0].id; // Retornar el ID existente si ya existe
  }

  const purchaseRef = doc(collection(db, PURCHASES_COL));
  const config = LINE_CONFIG[validated.businessLine];
  
  if (!config) throw new Error(`Línea de negocio no soportada para compras: ${validated.businessLine}`);

  await runTransaction(db, async (tx) => {
    // ── ALL READS ──
    const stockRefs = validated.items.map(item => doc(db, config.stock, item.sku));
    const catalogRefs = validated.items.map(item => doc(db, config.catalog, item.sku));
    
    const [stockSnaps, catalogSnaps] = await Promise.all([
      Promise.all(stockRefs.map(ref => tx.get(ref))),
      Promise.all(catalogRefs.map(ref => tx.get(ref)))
    ]);

    // ── CALCULATIONS ──
    const stockUpdates: any[] = [];
    const movementEntries: any[] = [];
    const catalogUpdates: any[] = [];

    validated.items.forEach((item, index) => {
      const stockSnap = stockSnaps[index];
      const catalogSnap = catalogSnaps[index];

      if (!catalogSnap.exists()) {
        throw new Error(`Producto no encontrado en catálogo [${validated.businessLine}]: SKU '${item.sku}'`);
      }

      const currentQty = stockSnap.exists() ? (stockSnap.data()?.quantity ?? 0) : 0;
      const currentAvgCost = stockSnap.exists() ? (stockSnap.data()?.avgCost ?? 0) : 0;
      const productName = catalogSnap.data()?.displayName ?? item.productName;

      // Recálculo PPP (WAC)
      let newAvgCost: number;
      const newTotalQty = currentQty + item.quantity;

      if (currentQty <= 0) {
        // Si no hay stock o es negativo, el nuevo costo es el de la compra
        newAvgCost = item.unitCostPEN;
      } else {
        // Fórmula estándar: (Q1*C1 + Q2*C2) / (Q1 + Q2)
        const existingValue = currentQty * currentAvgCost;
        const incomingValue = item.quantity * item.unitCostPEN;
        newAvgCost = Number(((existingValue + incomingValue) / (currentQty + item.quantity)).toFixed(4));
      }

      const newTotalValue = Number((newTotalQty * newAvgCost).toFixed(2));

      stockUpdates.push({
        ref: stockRefs[index],
        data: {
          sku: item.sku,
          productName,
          quantity: newTotalQty,
          avgCost: newAvgCost,
          totalValue: newTotalValue,
          lastUpdate: serverTimestamp(),
        }
      });

      movementEntries.push({
        ref: doc(collection(db, config.movements)),
        data: {
          sku: item.sku,
          type: 'ENTRADA',
          quantity: item.quantity,
          costPerUnit: item.unitCostPEN,
          reason: `Compra: ${validated.supplier.name} | Factura: ${validated.invoice.number}`,
          businessLine: validated.businessLine,
          createdBy: userEmail,
          createdAt: serverTimestamp(),
        }
      });

      catalogUpdates.push({
        ref: catalogRefs[index],
        data: {
          avgCost: newAvgCost,
          updatedAt: serverTimestamp(),
        }
      });
    });

    // ── WRITES ──
    const purchaseData: Purchase = {
      ...validated,
      status: 'REGISTRADA',
      createdAt: serverTimestamp() as Timestamp,
      createdBy: userEmail,
    };

    tx.set(purchaseRef, purchaseData);
    stockUpdates.forEach(upd => tx.set(upd.ref, upd.data));
    movementEntries.forEach(mov => tx.set(mov.ref, mov.data));
    catalogUpdates.forEach(upd => tx.update(upd.ref, upd.data));
    
    tx.set(doc(collection(db, AUDIT_COL)), {
      action: 'REGISTER_PURCHASE',
      entityId: purchaseRef.id,
      userEmail,
      details: `Compra registrada de ${validated.supplier.name} (${validated.businessLine}) por factura ${validated.invoice.number}. Total PEN: ${validated.totalCostPEN}`,
      timestamp: serverTimestamp(),
    });
  });

  return purchaseRef.id;
}

export async function voidPurchase(id: string, reason: string): Promise<void> {
  const userEmail = auth.currentUser?.email ?? 'sistema';
  const purchaseRef = doc(db, PURCHASES_COL, id);

  await runTransaction(db, async (tx) => {
    const purchaseSnap = await tx.get(purchaseRef);
    if (!purchaseSnap.exists()) throw new Error('La compra no existe.');
    
    const purchase = purchaseSnap.data() as Purchase;
    if (purchase.status === 'ANULADA') throw new Error('La compra ya está anulada.');

    const config = LINE_CONFIG[purchase.businessLine];
    const stockRefs = purchase.items.map(item => doc(db, config.stock, item.sku));
    const stockSnaps = await Promise.all(stockRefs.map(ref => tx.get(ref)));

    // Verificar integridad del stock (no vendido por debajo de lo comprado)
    purchase.items.forEach((item, index) => {
      const stockSnap = stockSnaps[index];
      const currentQty = stockSnap.data()?.quantity ?? 0;
      if (currentQty < item.quantity) {
        const err = new Error('No se puede anular: parte ya se vendió. Corregir por ajuste.');
        (err as any).code = 'STOCK_ALREADY_SOLD';
        throw err;
      }
    });

    // Revertir
    purchase.items.forEach((item, index) => {
      const stockSnap = stockSnaps[index];
      const currentQty = stockSnap.data()?.quantity ?? 0;
      const currentAvgCost = stockSnap.data()?.avgCost ?? 0;

      const newQty = currentQty - item.quantity;
      // Re-cálculo PPP inverso para intentar volver al costo anterior
      // Nota: Esto es complejo si hubo otras compras después. 
      // Si fue la última compra, es simple. Si no, mantenemos el costo actual para no complicar el promedio histórico.
      // Siguiendo el requerimiento simplificado de "revertir entrada".
      let newAvgCost = currentAvgCost;
      if (newQty > 0) {
          const currentValue = currentQty * currentAvgCost;
          const originalValue = item.quantity * item.unitCostPEN;
          newAvgCost = Number(((currentValue - originalValue) / newQty).toFixed(4));
          if (newAvgCost < 0) newAvgCost = currentAvgCost; // Fallback por si acaso
      }

      tx.update(stockRefs[index], {
        quantity: newQty,
        avgCost: newAvgCost,
        totalValue: Number((newQty * newAvgCost).toFixed(2)),
        lastUpdate: serverTimestamp(),
      });

      tx.set(doc(collection(db, config.movements)), {
        sku: item.sku,
        type: 'SALIDA',
        quantity: item.quantity,
        costPerUnit: item.unitCostPEN,
        reason: `ANULACIÓN COMPRA: ${purchase.invoice.number}`,
        businessLine: purchase.businessLine,
        createdBy: userEmail,
        createdAt: serverTimestamp(),
      });
      
      tx.update(doc(db, config.catalog, item.sku), {
        avgCost: newAvgCost,
        updatedAt: serverTimestamp(),
      });
    });

    tx.update(purchaseRef, {
      status: 'ANULADA',
      voidReason: reason,
      voidedAt: serverTimestamp(),
      voidedBy: userEmail,
    });

    tx.set(doc(collection(db, AUDIT_COL)), {
      action: 'VOID_PURCHASE',
      entityId: id,
      userEmail,
      details: `Compra anulada: Factura ${purchase.invoice.number} de ${purchase.supplier.name}. Motivo: ${reason}`,
      timestamp: serverTimestamp(),
    });
  });
}
