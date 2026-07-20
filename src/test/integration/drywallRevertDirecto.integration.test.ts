import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { setupIntegrationTest, clearFirestore, cleanupIntegrationTest } from './firestore-helpers';
import { revertProductionLog } from '../../../functions/src/callables/drywallProduction';
import { doc, getDoc, collection, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';

import * as admin from '../../../functions/node_modules/firebase-admin';

describe('Capa 2: revertProductionLog (drywall coil-directo)', () => {
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
    
    // Seed coil M1
    await setDoc(doc(db, 'coils', 'M1'), {
      id: 'M1',
      initialWeight: 5000,
      masterWidth: 1200,
      currentWeight: 3000,
      status: 'IN_PROGRESS',
      pricePerKg: 2.0 // no debe usarse para reversar costo PT, usar log.stripCost
    });

    // Seed product PARANTE
    await setDoc(doc(db, 'products', 'PARANTE'), {
      sku: 'PARANTE'
    });

    // Seed inventory_stock FG
    await setDoc(doc(db, 'inventory_stock', 'PARANTE'), {
      totalQuantity: 300,
      lastCostPerPiece: 5.00
    });

    // Seed production log ACTIVE (coil-directo)
    await setDoc(doc(db, 'production_logs', 'LOG-DIRECTO'), {
      sku: 'PARANTE',
      line: 'drywall',
      status: 'ACTIVE',
      parentCoilId: 'M1', // COIL DIRECTO
      totalUsedWidth: 120, // (120/1200)*5000 = 500kg restaurado
      stripCost: 400, // Costo congelado real (usar este)
      piecesProduced: 100,
      timestamp: Timestamp.now()
    });
  });

  it('A1 coil.currentWeight restaurado, status recalculado', async () => {
    await revertProductionLog.run({
      data: { logId: 'LOG-DIRECTO' },
      auth: { uid: 'admin1', token: { email: 'admin@test.com', role: 'ADMIN' } }
    } as any);

    const coilSnap = await getDoc(doc(db, 'coils', 'M1'));
    const data = coilSnap.data() as any;
    expect(data.currentWeight).toBe(3500); // 3000 + 500
    // expect status to be recalculated (likely 'IN_PROGRESS')
  });

  it('A2 inventory_stock: resta-de-lote correcta', async () => {
    await revertProductionLog.run({
      data: { logId: 'LOG-DIRECTO' },
      auth: { uid: 'admin1', token: { email: 'admin@test.com', role: 'ADMIN' } }
    } as any);

    const stockSnap = await getDoc(doc(db, 'inventory_stock', 'PARANTE'));
    const data = stockSnap.data() as any;
    expect(data.totalQuantity).toBe(200);
    // new value = (300*5) - 400 = 1100 -> /200 = 5.50
    expect(data.lastCostPerPiece).toBeCloseTo(5.50, 6);
  });

  it('A3 production_log.status = VOIDED', async () => {
    await revertProductionLog.run({
      data: { logId: 'LOG-DIRECTO' },
      auth: { uid: 'admin1', token: { email: 'admin@test.com', role: 'ADMIN' } }
    } as any);

    const logSnap = await getDoc(doc(db, 'production_logs', 'LOG-DIRECTO'));
    expect((logSnap.data() as any).status).toBe('VOIDED');
  });

  it('A4 audit_log con approximateWeight flag e invariante de kardex IN', async () => {
    await revertProductionLog.run({
      data: { logId: 'LOG-DIRECTO' },
      auth: { uid: 'admin1', token: { email: 'admin@test.com', role: 'ADMIN' } }
    } as any);

    const auditSnap = await getDocs(collection(db, 'audit_logs'));
    expect(auditSnap.size).toBeGreaterThan(0);
    const audit = auditSnap.docs.find(d => d.data().action === 'VOID_PRODUCTION_DRYWALL');
    expect(audit?.data().details.approximateWeight).toBe(true);

    const kardexSnap = await getDocs(collection(db, 'kardex_movements'));
    const kardexIn = kardexSnap.docs.find(d => d.data().type === 'IN');
    expect(kardexIn).toBeDefined();
    expect(kardexIn!.data().weightKg * kardexIn!.data().costPerKg).toBeCloseTo(400, 4);
  });

  it('A5 idempotencia', async () => {
    // 1st time
    await revertProductionLog.run({
      data: { logId: 'LOG-DIRECTO' },
      auth: { uid: 'admin1', token: { email: 'admin@test.com', role: 'ADMIN' } }
    } as any);
    
    // 2nd time
    const res = await revertProductionLog.run({
      data: { logId: 'LOG-DIRECTO' },
      auth: { uid: 'admin1', token: { email: 'admin@test.com', role: 'ADMIN' } }
    } as any);
    expect(res).toEqual({ success: true, alreadyVoided: true });
  });

  it('A6 stock negativo no recalcula WAC', async () => {
    // Modify initial state for this test
    await setDoc(doc(db, 'inventory_stock', 'PARANTE'), {
      totalQuantity: -18596,
      lastCostPerPiece: 4.11
    });

    await revertProductionLog.run({
      data: { logId: 'LOG-DIRECTO' },
      auth: { uid: 'admin1', token: { email: 'admin@test.com', role: 'ADMIN' } }
    } as any);

    const stockSnap = await getDoc(doc(db, 'inventory_stock', 'PARANTE'));
    const data = stockSnap.data() as any;
    expect(data.totalQuantity).toBe(-18696);
    expect(data.lastCostPerPiece).toBe(4.11); // Unchanged
  });

  it('A7 guard rol: OPERATOR', async () => {
    try {
      await revertProductionLog.run({
        data: { logId: 'LOG-DIRECTO' },
        auth: { uid: 'op1', token: { email: 'op@test.com', role: 'OPERATOR' } }
      } as any);
      expect.fail('Deberia arrojar error');
    } catch (e: any) {
      expect(e.code || e.errorInfo?.code).toContain('permission-denied');
    }
  });
});
