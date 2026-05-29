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
  cancelCuttingPlan,
  revertProductionLog
} from '@/modules/drywall/services/productionService';
import { doc, getDoc, collection, getDocs, setDoc } from 'firebase/firestore';

vi.unmock('@/lib/firebase/clientApp');

describe('Drywall Production (Integration)', () => {
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
    await seedFinish(testDb, { id: 'GALVANIZADO', label: 'GALVANIZADO', active: true, lines: ['drywall'] });
    
    // Seed catálogos necesarios para drywall
    await setDoc(doc(testDb, 'products', 'P38GALV'), {
      sku: 'P38GALV',
      stripWidth: 121,
      standardWeight: 0.5, // kg/m
      lengthMeters: 3.0
    });
  });

  it('saveCuttingPlan: cambia estado a IN_PROGRESS y crea plannedStrips', async () => {
    const coilId = await seedCoil(testDb, { id: 'BOB-PLAN', finish: 'GALVANIZADO' });
    
    await saveCuttingPlan(coilId, [{ sku: 'P38GALV', quantity: 2 }]);
    
    const coilSnap = await getDoc(doc(testDb, 'coils', coilId));
    const data = coilSnap.data();
    expect(data?.status).toBe('IN_PROGRESS');
    expect(data?.plannedStrips).toHaveLength(1);
    expect(data?.plannedStrips[0].pendingCount).toBe(2);
  });

  it('processSingleStrip: descuenta peso y genera stock PEPPS', async () => {
    const coilId = await seedCoil(testDb, { 
      id: 'BOB-PROD', 
      finish: 'GALVANIZADO',
      initialWeight: 1000,
      currentWeight: 1000,
      masterWidth: 1200,
      pricePerKg: 4
    });
    
    // Preparar plan
    await saveCuttingPlan(coilId, [{ sku: 'P38GALV', quantity: 1 }]);
    
    // Procesar el único fleje
    const res = await processSingleStrip(coilId, 'P38GALV', 100, 'operator-01');
    expect(res.success).toBe(true);
    
    // Verificar peso bobina: (121mm / 1200mm) * 1000kg = 100.833kg consumidos
    const coilSnap = await getDoc(doc(testDb, 'coils', coilId));
    expect(coilSnap.data()?.currentWeight).toBeLessThan(900); // ~899.17
    expect(coilSnap.data()?.status).toBe('PROCESSED'); // Porque era el último fleje
    
    // Verificar stock
    const stockSnap = await getDoc(doc(testDb, 'inventory_stock', 'P38GALV'));
    expect(stockSnap.data()?.totalQuantity).toBe(100);
    // Peso reportado: 100 pzas * 0.5kg/pza = 50kg
    expect(stockSnap.data()?.totalWeight).toBe(50);
  });

  it('revertProductionLog: devuelve peso a bobina e IN a OUT en stock', async () => {
    const coilId = await seedCoil(testDb, { 
      id: 'BOB-REVERT', 
      finish: 'GALVANIZADO',
      initialWeight: 1000,
      currentWeight: 1000,
      masterWidth: 1200,
      pricePerKg: 4
    });
    
    await saveCuttingPlan(coilId, [{ sku: 'P38GALV', quantity: 1 }]);
    await processSingleStrip(coilId, 'P38GALV', 10, 'op-1');
    
    const logsSnap = await getDocs(collection(testDb, 'production_logs'));
    const logId = logsSnap.docs[0].id;
    
    // Revertir
    await revertProductionLog(logId, 'admin@test.com');
    
    // Bobina debe volver a peso inicial (o casi, por redondeos)
    const coilSnap = await getDoc(doc(testDb, 'coils', coilId));
    expect(coilSnap.data()?.currentWeight).toBe(1000);
    expect(coilSnap.data()?.status).toBe('IN_PROGRESS');
    expect(coilSnap.data()?.plannedStrips[0].pendingCount).toBe(1);
    
    // Stock debe ser 0
    const stockSnap = await getDoc(doc(testDb, 'inventory_stock', 'P38GALV'));
    expect(stockSnap.data()?.totalQuantity).toBe(0);
    
    // Log debe estar VOIDED
    const logSnap = await getDoc(doc(testDb, 'production_logs', logId));
    expect(logSnap.data()?.status).toBe('VOIDED');
  });
});
