import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = `test-sales-import-${Date.now()}`;
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { 
  setupIntegrationTest, 
  clearFirestore, 
  cleanupIntegrationTest, 
  seedStock
} from './firestore-helpers';
import { getStockStrategy } from '@/core/sales/strategies';
import { doc, getDoc, collection, getDocs, writeBatch, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';

vi.unmock('@/lib/firebase/clientApp');

// Simulación de la función de importación masiva (BulkUploadSales.tsx)
// con la lógica de idempotencia requerida.
async function simulateImport(parsedSales: any[]) {
  const batches = [];
  let currentBatch = writeBatch(db);
  let opCount = 0;

  for (const sale of parsedSales) {
    // 1. Verificación de Idempotencia (documentNumber)
    const existingDoc = await getDoc(doc(db, 'sales', sale.documentNumber));
    if (existingDoc.exists()) {
      continue; // Skip if already imported
    }

    currentBatch.set(doc(db, 'sales', sale.documentNumber), {
      ...sale,
      uploadedAt: serverTimestamp(),
    });
    opCount++;

    for (const item of sale.items) {
      if (!item.isCoil) {
        const strategy = getStockStrategy(item.businessLine);
        // En una app real, aquí leeríamos el stock actual. 
        // Para el test, simplificamos asumiendo que el strategy maneja el decremento.
        const stockRef = strategy.getStockRef(item.sku);
        const snap = await getDoc(stockRef);
        const currentQty = strategy.extractQuantity(snap);
        const newBalance = currentQty - item.quantity;

        strategy.writeSaleDecrement({
          sku: item.sku,
          quantity: item.quantity,
          newBalance,
          saleId: sale.documentNumber,
          customerName: sale.customerName,
          sellerId: 'SISTEMA'
        }, snap, currentBatch as any);
        opCount += 2;
      }
    }
  }

  if (opCount > 0) await currentBatch.commit();
}

describe('Sales Import Logic (Integration)', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest(null, db);
  });

  beforeEach(async () => {
    await clearFirestore(db);
  });

  it('idempotencia: re-importar la misma factura no duplica ni descuenta stock doble', async () => {
    const sku = 'UPVC-TEST';
    await seedStock(db, 'roofing_stock', sku, { quantity: 100, avgCost: 10 });
    
    const saleData = {
      documentNumber: 'F001-000001',
      customerName: 'Cliente Test',
      items: [{
        sku,
        quantity: 10,
        businessLine: 'roofing',
        isCoil: false,
        baseCost: 10
      }]
    };

    // Primera importación
    await simulateImport([saleData]);

    const stockSnap1 = await getDoc(doc(db, 'roofing_stock', sku));
    expect(stockSnap1.data()?.quantity).toBe(90);

    // Segunda importación (misma data)
    await simulateImport([saleData]);

    const stockSnap2 = await getDoc(doc(db, 'roofing_stock', sku));
    expect(stockSnap2.data()?.quantity).toBe(90); // Se mantuvo en 90, NO bajó a 80

    const movesSnap = await getDocs(collection(db, 'roofing_stock_movements'));
    expect(movesSnap.docs).toHaveLength(1); // Solo un movimiento registrado
  });

  it('multi-línea: descuenta de las colecciones correctas via strategy', async () => {
    await seedStock(db, 'inventory_stock', 'P38', { totalQuantity: 50 }); // Drywall
    await seedStock(db, 'trading_stock', 'TUBO-1', { quantity: 20 }); // Trading

    const multiSale = {
      documentNumber: 'F001-MULTI',
      customerName: 'Multi Cliente',
      items: [
        { sku: 'P38', quantity: 5, businessLine: 'drywall', isCoil: false },
        { sku: 'TUBO-1', quantity: 2, businessLine: 'trading', isCoil: false }
      ]
    };

    await simulateImport([multiSale]);

    const snapDry = await getDoc(doc(db, 'inventory_stock', 'P38'));
    expect(snapDry.data()?.totalQuantity).toBe(45);

    const snapTrad = await getDoc(doc(db, 'trading_stock', 'TUBO-1'));
    expect(snapTrad.data()?.quantity).toBe(18);
  });

  it('services: no realiza movimientos de stock', async () => {
    const serviceSale = {
      documentNumber: 'F001-SERV',
      customerName: 'Servicios SAC',
      items: [
        { sku: 'CORTE-01', quantity: 1, businessLine: 'services', isCoil: false }
      ]
    };

    await simulateImport([serviceSale]);

    const movesSnap = await getDocs(collection(db, 'services_stock_movements'));
    expect(movesSnap.docs).toHaveLength(0); // Services strategy is NO-OP
  });
});
