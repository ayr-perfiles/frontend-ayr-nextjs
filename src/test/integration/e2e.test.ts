import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
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

vi.unmock('@/lib/firebase/clientApp');

describe('E2E Flows (Integration)', () => {
  let testApp: any;
  let testDb: any;

  beforeAll(async () => {
    const { app, db } = await setupIntegrationTest();
    testApp = app;
    testDb = db;
    process.env.NODE_ENV = 'development';
  });

  afterAll(async () => {
    await cleanupIntegrationTest(testApp, testDb);
    process.env.NODE_ENV = 'test';
  });

  beforeEach(async () => {
    await clearFirestore();
    await seedFinish(testDb, { id: 'GALVANIZADO', active: true, lines: ['drywall'] });
    await seedFinish(testDb, { id: 'ALUZINC', active: true, lines: ['metallic-roofing'] });
    
    // Seed catálogos
    await setDoc(doc(testDb, 'products', 'P38'), { sku: 'P38', stripWidth: 100, standardWeight: 1 });
    await setDoc(doc(testDb, 'metallic_roofing_catalog', 'COB030'), { sku: 'COB030', productName: 'COB ALUZINC', unit: 'PIEZA' });
  });

  it('Ciclo completo Drywall: Producción -> Venta -> Anulación -> Revertir', async () => {
    // 1. Materia prima
    const coilId = await seedCoil(testDb, { id: 'BOB-E2E', finish: 'GALVANIZADO', initialWeight: 1000, currentWeight: 1000, masterWidth: 1000, pricePerKg: 10 });

    // 2. Producción
    await saveCuttingPlan(coilId, [{ sku: 'P38', quantity: 1 }]);
    await processSingleStrip(coilId, 'P38', 10, 'operator-1'); // Consume 100kg (100mm/1000mm * 1000kg)

    const stockSnapProd = await getDoc(doc(testDb, 'inventory_stock', 'P38'));
    expect(stockSnapProd.data()?.totalQuantity).toBe(10);

    // 3. Venta
    const strategy = getStockStrategy('drywall');
    await runTransaction(testDb, async (tx) => {
      const snap = await tx.get(strategy.getStockRef('P38'));
      strategy.writeSaleDecrement({
        sku: 'P38', quantity: 4, newBalance: 6, saleId: 'SALE-1', customerName: 'Test', sellerId: 'seller-1'
      }, snap, tx);
    });

    const stockSnapSale = await getDoc(doc(testDb, 'inventory_stock', 'P38'));
    expect(stockSnapSale.data()?.totalQuantity).toBe(6);

    // 4. Anular Venta
    await runTransaction(testDb, async (tx) => {
      const snap = await tx.get(strategy.getStockRef('P38'));
      strategy.writeSaleReversal({
        sku: 'P38', quantity: 4, newBalance: 10, saleId: 'SALE-1', customerName: 'Test', sellerId: 'seller-1'
      }, snap, tx);
    });

    const stockSnapRev = await getDoc(doc(testDb, 'inventory_stock', 'P38'));
    expect(stockSnapRev.data()?.totalQuantity).toBe(10);

    // 5. Revertir Producción
    const logsSnap = await getDocs(collection(testDb, 'production_logs'));
    await revertProductionLog(logsSnap.docs[0].id, 'admin@test.com');

    const stockSnapFinal = await getDoc(doc(testDb, 'inventory_stock', 'P38'));
    expect(stockSnapFinal.data()?.totalQuantity).toBe(0);

    const coilSnapFinal = await getDoc(doc(testDb, 'coils', coilId));
    expect(coilSnapFinal.data()?.currentWeight).toBe(1000);
  });

  it('Venta multi-línea: Descuenta de múltiples colecciones atómicamente', async () => {
    await seedStock(testDb, 'inventory_stock', 'P38', { totalQuantity: 100 });
    await seedStock(testDb, 'metallic_roofing_stock', 'COB030', { quantity: 50, avgCost: 20 });

    await runTransaction(testDb, async (tx) => {
      // Item 1: Drywall
      const stratDry = getStockStrategy('drywall');
      const snapDry = await tx.get(stratDry.getStockRef('P38'));
      stratDry.writeSaleDecrement({ sku: 'P38', quantity: 5, newBalance: 95, saleId: 'MULTI-1', customerName: 'C1', sellerId: 's1' }, snapDry, tx);

      // Item 2: Metallic
      const stratMet = getStockStrategy('metallic-roofing');
      const snapMet = await tx.get(stratMet.getStockRef('COB030'));
      stratMet.writeSaleDecrement({ sku: 'COB030', quantity: 2, newBalance: 48, saleId: 'MULTI-1', customerName: 'C1', sellerId: 's1' }, snapMet, tx);
    });

    const snapDryFinal = await getDoc(doc(testDb, 'inventory_stock', 'P38'));
    expect(snapDryFinal.data()?.totalQuantity).toBe(95);

    const snapMetFinal = await getDoc(doc(testDb, 'metallic_roofing_stock', 'COB030'));
    expect(snapMetFinal.data()?.quantity).toBe(48);
  });
});
