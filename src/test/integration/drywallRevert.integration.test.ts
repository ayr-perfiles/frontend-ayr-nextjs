import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { setupIntegrationTest, clearFirestore, cleanupIntegrationTest } from './firestore-helpers';
import { revertProductionLog } from '../../../functions/src/callables/drywallProduction';
import { doc, getDoc, collection, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';

import * as admin from '../../../functions/node_modules/firebase-admin';

describe('Capa 2: revertProductionLog (drywall strips_stock)', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: TEST_PROJECT_ID });
    }
  });

  afterAll(async () => {
    await cleanupIntegrationTest(null, db);
  });

  beforeEach(async () => {
    await clearFirestore(db);
    
    // Seed strips_stock w121
    await setDoc(doc(db, 'strips_stock', '121'), {
      widthMm: 121,
      totalStrips: 12,
      totalWeight: 1300,
      avgCostPerKg: 6
    });

    // Seed product PARANTE
    await setDoc(doc(db, 'products', 'PARANTE'), {
      sku: 'PARANTE',
      stripWidth: 121,
      standardWeight: 0.5
    });

    // Seed inventory_stock FG
    await setDoc(doc(db, 'inventory_stock', 'PARANTE'), {
      totalQuantity: 100,
      totalWeight: 50,
      lastCostPerPiece: 22
    });

    // Seed production log ACTIVE (T1)
    await setDoc(doc(db, 'production_logs', 'LOG-TARGET'), {
      sku: 'PARANTE',
      line: 'drywall',
      status: 'ACTIVE',
      totalUsedWidth: 121,
      stripsUsed: 2,
      consumedWeightKg: 200,
      consumedCostPEN: 1000,
      piecesProduced: 40,
      costPerPiece: 25,
      timestamp: Timestamp.now()
    });

    // Seed OTRO production_log ACTIVE para probar lookup
    await setDoc(doc(db, 'production_logs', 'LOG-NOISE'), {
      sku: 'PARANTE',
      line: 'drywall',
      status: 'ACTIVE',
      piecesProduced: 10,
      averageCostAfter: 999,
      timestamp: Timestamp.fromDate(new Date(Date.now() - 10000))
    });
  });

  it('A1 strips_stock w121', async () => {
    await revertProductionLog.run({
      data: { logId: 'LOG-TARGET' },
      auth: { uid: 'admin1', token: { email: 'admin@test.com', role: 'ADMIN' } }
    } as any);

    const ssSnap = await getDoc(doc(db, 'strips_stock', '121'));
    const data = ssSnap.data() as any;
    expect(data.totalStrips).toBe(14);
    expect(data.totalWeight).toBeCloseTo(1500, 4);
    expect(data.avgCostPerKg).toBeCloseTo(5.8667, 4);
  });

  it('A2 inventory_stock FG', async () => {
    await revertProductionLog.run({
      data: { logId: 'LOG-TARGET' },
      auth: { uid: 'admin1', token: { email: 'admin@test.com', role: 'ADMIN' } }
    } as any);

    const stockSnap = await getDoc(doc(db, 'inventory_stock', 'PARANTE'));
    const data = stockSnap.data() as any;
    expect(data.totalQuantity).toBe(60);
    expect(data.lastCostPerPiece).toBeCloseTo(20.00, 2);
  });

  it('A3 production_log.status = VOIDED', async () => {
    await revertProductionLog.run({
      data: { logId: 'LOG-TARGET' },
      auth: { uid: 'admin1', token: { email: 'admin@test.com', role: 'ADMIN' } }
    } as any);

    const logSnap = await getDoc(doc(db, 'production_logs', 'LOG-TARGET'));
    expect((logSnap.data() as any).status).toBe('VOIDED');
  });

  it('A4 strips_movements nuevo (costo congelado)', async () => {
    await revertProductionLog.run({
      data: { logId: 'LOG-TARGET' },
      auth: { uid: 'admin1', token: { email: 'admin@test.com', role: 'ADMIN' } }
    } as any);

    const movsSnap = await getDocs(collection(db, 'strips_movements'));
    expect(movsSnap.size).toBeGreaterThan(0);
    const mov = movsSnap.docs[0].data() as any;
    expect(mov.costPerKg).toBeCloseTo(5.00, 2);
  });

  it('A6 idempotencia', async () => {
    await revertProductionLog.run({
      data: { logId: 'LOG-TARGET' },
      auth: { uid: 'admin1', token: { email: 'admin@test.com', role: 'ADMIN' } }
    } as any);
    
    // Segunda llamada
    const res = await revertProductionLog.run({
      data: { logId: 'LOG-TARGET' },
      auth: { uid: 'admin1', token: { email: 'admin@test.com', role: 'ADMIN' } }
    } as any);
    expect(res).toEqual({ success: true, alreadyVoided: true });
  });

  it('A7 guard rol', async () => {
    try {
      await revertProductionLog.run({
        data: { logId: 'LOG-TARGET' },
        auth: { uid: 'op1', token: { email: 'op@test.com', role: 'OPERATOR' } }
      } as any);
      expect.fail('Deberia arrojar error');
    } catch (e: any) {
      expect(e.code || e.errorInfo?.code).toContain('permission-denied');
    }
  });
  
  it('A8 venta COMPLETED posterior bloquea reversa', async () => {
    await setDoc(doc(db, 'sales', 'SALE-POST'), {
      skus: ['PARANTE'],
      status: 'COMPLETED',
      timestamp: Timestamp.fromDate(new Date(Date.now() + 10000))
    });
    
    try {
      await revertProductionLog.run({
        data: { logId: 'LOG-TARGET' },
        auth: { uid: 'admin1', token: { email: 'admin@test.com', role: 'ADMIN' } }
      } as any);
      expect.fail('Deberia arrojar error');
    } catch (e: any) {
      expect(e.message).toMatch(/ventas posteriores/);
    }
  });
});
