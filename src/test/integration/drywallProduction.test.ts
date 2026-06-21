import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = 'test-drywall-production-' + Date.now();
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
  cancelCuttingPlan,
  revertProductionLog
} from '@/modules/drywall/services/productionService';
import { doc, getDoc, collection, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';

vi.unmock('@/lib/firebase/clientApp');

describe('Drywall Production (Integration)', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest(null, db);
  });

  beforeEach(async () => {
    await clearFirestore(db);
    await seedFinish(db, { id: 'GALVANIZADO', label: 'GALVANIZADO', active: true, lines: ['drywall'] });
    
    // Seed catálogos necesarios para drywall
    await setDoc(doc(db, 'products', 'P38GALV'), {
      sku: 'P38GALV',
      stripWidth: 121,
      standardWeight: 0.5, // kg/m
      lengthMeters: 3.0
    });
  });

  it('saveCuttingPlan: cambia estado a IN_PROGRESS y crea plannedStrips', async () => {
    const coilId = await seedCoil(db, { id: 'BOB-PLAN', finish: 'GALVANIZADO' });
    
    await saveCuttingPlan(coilId, [{ sku: 'P38GALV', quantity: 2 }]);
    
    const coilSnap = await getDoc(doc(db, 'coils', coilId));
    const data = coilSnap.data() as any;
    expect(data?.status).toBe('IN_PROGRESS');
    expect(data?.plannedStrips).toHaveLength(1);
    expect(data?.plannedStrips[0].pendingCount).toBe(2);
  });

  it('processSingleStrip: descuenta peso y genera stock PEPPS', async () => {
    const coilId = await seedCoil(db, { 
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
    const res = await processSingleStrip(coilId, 'P38GALV', 50, 'operator-01');
    expect(res.success).toBe(true);
    
    // Verificar peso bobina: (121mm / 1200mm) * 1000kg = 100.833kg consumidos
    const coilSnap = await getDoc(doc(db, 'coils', coilId));
    expect((coilSnap.data() as any)?.currentWeight).toBeLessThan(900); // ~899.17
    expect((coilSnap.data() as any)?.status).toBe('PROCESSED'); // Porque era el último fleje
    
    // Verificar stock
    const stockSnap = await getDoc(doc(db, 'inventory_stock', 'P38GALV'));
    expect((stockSnap.data() as any)?.totalQuantity).toBe(50);
    // Peso reportado: 50 pzas * 0.5 = 25kg
    expect((stockSnap.data() as any)?.totalWeight).toBe(25);
  });

  it('revertProductionLog: devuelve peso a bobina e IN a OUT en stock', async () => {
    const coilId = await seedCoil(db, { 
      id: 'BOB-REVERT', 
      finish: 'GALVANIZADO',
      initialWeight: 1000,
      currentWeight: 1000,
      masterWidth: 1200,
      pricePerKg: 4
    });
    
    await saveCuttingPlan(coilId, [{ sku: 'P38GALV', quantity: 1 }]);
    await processSingleStrip(coilId, 'P38GALV', 10, 'op-1');
    
    const logsSnap = await getDocs(collection(db, 'production_logs'));
    const logId = logsSnap.docs[0].id;
    
    // Revertir
    await revertProductionLog(logId, 'admin@test.com');
    
    // Bobina debe volver a peso inicial (o casi, por redondeos)
    const coilSnap = await getDoc(doc(db, 'coils', coilId));
    expect((coilSnap.data() as any)?.currentWeight).toBe(1000);
    expect((coilSnap.data() as any)?.status).toBe('IN_PROGRESS');
    expect((coilSnap.data() as any)?.plannedStrips[0].pendingCount).toBe(1);
    
    // Stock debe ser 0
    const stockSnap = await getDoc(doc(db, 'inventory_stock', 'P38GALV'));
    expect((stockSnap.data() as any)?.totalQuantity).toBe(0);
    
    // Log debe estar VOIDED
    const logSnap = await getDoc(doc(db, 'production_logs', logId));
    expect((logSnap.data() as any)?.status).toBe('VOIDED');
  });
});
