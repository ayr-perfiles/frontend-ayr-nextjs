import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = 'test-e2e-' + Date.now();
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { 
  setupIntegrationTest, 
  clearFirestore, 
  cleanupIntegrationTest, 
  seedCoil, 
  seedFinish,
  seedStock
} from './firestore-helpers';
import { 
  saveCuttingPlan, 
  processSingleStrip, 
  revertProductionLog 
} from '@/modules/drywall/services/productionService';
import { getStockStrategy } from '@/core/sales/strategies';
import { doc, getDoc, runTransaction, collection, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';

vi.unmock('@/lib/firebase/clientApp');

describe('E2E Flows (Integration)', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest(null, db);
  });

  beforeEach(async () => {
    await clearFirestore(db);
    await seedFinish(db, { id: 'GALVANIZADO', active: true, lines: ['drywall'] });
    await seedFinish(db, { id: 'ALUZINC', active: true, lines: ['metallic-roofing'] });
    
    // Seed catálogos
    await setDoc(doc(db, 'products', 'P38'), { sku: 'P38', stripWidth: 100, standardWeight: 1 });
    await setDoc(doc(db, 'metallic_roofing_catalog', 'COB030'), { sku: 'COB030', productName: 'COB ALUZINC', unit: 'PIEZA' });
  });

  it('Ciclo completo Drywall: Producción -> Venta -> Anulación -> Revertir', async () => {
    // 1. Materia prima
    const coilId = await seedCoil(db, { id: 'BOB-E2E', finish: 'GALVANIZADO', initialWeight: 1000, currentWeight: 1000, masterWidth: 1000, pricePerKg: 10 });

    // 2. Producción
    await saveCuttingPlan(coilId, [{ sku: 'P38', quantity: 1 }]);
    await processSingleStrip(coilId, 'P38', 10, 'operator-1'); // Consume 100kg (100mm/1000mm * 1000kg)

    const stockSnapProd = await getDoc(doc(db, 'inventory_stock', 'P38'));
    expect(stockSnapProd.data()?.totalQuantity).toBe(10);

    // 3. Venta
    const strategy = getStockStrategy('drywall');
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(strategy.getStockRef('P38'));
      strategy.writeSaleDecrement({
        sku: 'P38', quantity: 4, newBalance: 6, saleId: 'SALE-1', customerName: 'Test', sellerId: 'seller-1'
      }, snap, tx);
    });

    const stockSnapSale = await getDoc(doc(db, 'inventory_stock', 'P38'));
    expect(stockSnapSale.data()?.totalQuantity).toBe(6);

    // 4. Anular Venta
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(strategy.getStockRef('P38'));
      strategy.writeSaleReversal({
        sku: 'P38', quantity: 4, newBalance: 10, saleId: 'SALE-1', customerName: 'Test', sellerId: 'seller-1'
      }, snap, tx);
    });

    const stockSnapRev = await getDoc(doc(db, 'inventory_stock', 'P38'));
    expect(stockSnapRev.data()?.totalQuantity).toBe(10);

    // 5. Revertir Producción
    const logsSnap = await getDocs(collection(db, 'production_logs'));
    await revertProductionLog(logsSnap.docs[0].id, 'admin@test.com');

    const stockSnapFinal = await getDoc(doc(db, 'inventory_stock', 'P38'));
    expect(stockSnapFinal.data()?.totalQuantity).toBe(0);

    const coilSnapFinal = await getDoc(doc(db, 'coils', coilId));
    expect(coilSnapFinal.data()?.currentWeight).toBe(1000);
  });

  it('Venta multi-línea: Descuenta de múltiples colecciones atómicamente', async () => {
    await seedStock(db, 'inventory_stock', 'P38', { totalQuantity: 100 });
    await seedStock(db, 'metallic_roofing_stock', 'COB030', { quantity: 50 });

    await runTransaction(db, async (tx) => {
      const stratDry = getStockStrategy('drywall');
      const stratMet = getStockStrategy('metallic-roofing');

      // FASE 1: LECTURAS
      const snapDry = await tx.get(stratDry.getStockRef('P38'));
      const snapMet = await tx.get(stratMet.getStockRef('COB030'));

      // FASE 2: ESCRITURAS
      stratDry.writeSaleDecrement({ sku: 'P38', quantity: 5, newBalance: 95, saleId: 'MULTI-1', customerName: 'C1', sellerId: 's1' }, snapDry, tx);
      stratMet.writeSaleDecrement({ sku: 'COB030', quantity: 2, newBalance: 48, saleId: 'MULTI-1', customerName: 'C1', sellerId: 's1' }, snapMet, tx);
    });

    const snapDryFinal = await getDoc(doc(db, 'inventory_stock', 'P38'));
    expect(snapDryFinal.data()?.totalQuantity).toBe(95);

    const snapMetFinal = await getDoc(doc(db, 'metallic_roofing_stock', 'COB030'));
    expect(snapMetFinal.data()?.quantity).toBe(48);
  });
});
