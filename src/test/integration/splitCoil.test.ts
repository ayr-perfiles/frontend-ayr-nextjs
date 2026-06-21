import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = 'test-split-coil-' + Date.now();
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import {
  setupIntegrationTest,
  clearFirestore,
  cleanupIntegrationTest,
  seedCoil,
} from './firestore-helpers';
import { splitCoilAction } from '@/core/coils/services/splitCoilService';
import { db } from '@/lib/firebase/clientApp';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';

vi.unmock('@/lib/firebase/clientApp');

const OPERATOR = 'test@ayrsteel.com';

describe('splitCoilAction — slitting por ancho (Integration — Emulador)', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest(null, db);
  });

  beforeEach(async () => {
    await clearFirestore(db);
  });

  // ── spec: padre 1200mm/1000kg, corte 800mm ────────────────────────────────

  it('spec: 1200mm/1000kg → corte 800mm → hija 800mm/~667kg, padre 400mm/~333kg', async () => {
    const parentId = await seedCoil(db, {
      id: 'BOB-SLIT-001',
      masterWidth: 1200,
      currentWeight: 1000,
      initialWeight: 1000,
      pricePerKg: 3.5,
      status: 'AVAILABLE',
      thickness: 0.45,
      finish: 'ALUZINC',
    });

    const { childId } = await splitCoilAction(parentId, 800, OPERATOR);

    const parentSnap = await getDoc(doc(db, 'coils', parentId));
    const childSnap = await getDoc(doc(db, 'coils', childId));

    expect(parentSnap.exists()).toBe(true);
    expect(childSnap.exists()).toBe(true);

    const parent = parentSnap.data()!;
    const child = childSnap.data()!;

    // Padre: 1200 - 800 = 400mm, 1000 × (400/1200) ≈ 333.33kg
    expect(parent.masterWidth).toBe(400);
    expect(parent.currentWeight).toBeCloseTo(333.3333, 3);
    expect(parent.status).toBe('AVAILABLE');

    // Hija: 800mm, 1000 × (800/1200) ≈ 666.67kg
    expect(child.masterWidth).toBe(800);
    expect(child.currentWeight).toBeCloseTo(666.6667, 3);
    expect(child.initialWeight).toBeCloseTo(666.6667, 3);
    expect(child.status).toBe('AVAILABLE');
    expect(child.parentCoilId).toBe(parentId);
    expect(child.pricePerKg).toBe(3.5);   // heredado sin recalcular
    expect(child.thickness).toBe(0.45);
    expect(child.finish).toBe('ALUZINC');
    expect(child.metadata?.splitFrom).toBe(parentId);
  });

  it('peso hija + peso padre = peso original (conservación de masa)', async () => {
    const parentId = await seedCoil(db, {
      id: 'BOB-SLIT-002',
      masterWidth: 1200,
      currentWeight: 1000,
      initialWeight: 1000,
      pricePerKg: 4.0,
      status: 'AVAILABLE',
    });

    const { childId } = await splitCoilAction(parentId, 500, OPERATOR);

    const parent = (await getDoc(doc(db, 'coils', parentId))).data()!;
    const child = (await getDoc(doc(db, 'coils', childId))).data()!;

    expect(
      Number((parent.currentWeight + child.currentWeight).toFixed(4)),
    ).toBe(1000);
  });

  it('slitting genera 2 kardex con weightKg y costPerKg proporcionales', async () => {
    const parentId = await seedCoil(db, {
      id: 'BOB-SLIT-003',
      masterWidth: 1200,
      currentWeight: 1000,
      initialWeight: 1000,
      pricePerKg: 3.5,
      status: 'AVAILABLE',
    });

    const { childId } = await splitCoilAction(parentId, 800, OPERATOR);

    const kardexSnap = await getDocs(collection(db, 'kardex_movements'));
    const movements = kardexSnap.docs.map((d) => d.data());

    const parentOut = movements.find((m) => m.sku === parentId && m.type === 'OUT');
    const childIn = movements.find((m) => m.sku === childId && m.type === 'IN');

    expect(parentOut).toBeDefined();
    expect(parentOut!.weightKg).toBeCloseTo(666.6667, 3);
    expect(parentOut!.costPerKg).toBe(3.5);
    expect(parentOut!.balance).toBeCloseTo(333.3333, 3);
    expect(parentOut!.reference).toBe(childId);

    expect(childIn).toBeDefined();
    expect(childIn!.weightKg).toBeCloseTo(666.6667, 3);
    expect(childIn!.costPerKg).toBe(3.5);
    expect(childIn!.reference).toBe(parentId);
  });

  it('dos slittings consecutivos producen IDs únicos y padre actualizado', async () => {
    const parentId = await seedCoil(db, {
      id: 'BOB-SLIT-004',
      masterWidth: 1200,
      currentWeight: 1200,
      initialWeight: 1200,
      pricePerKg: 3.5,
      status: 'AVAILABLE',
    });

    // 1er corte: 400mm
    const { childId: child1 } = await splitCoilAction(parentId, 400, OPERATOR);
    // 2do corte: 400mm (padre ahora tiene 800mm)
    const { childId: child2 } = await splitCoilAction(parentId, 400, OPERATOR);

    expect(child1).not.toBe(child2);

    const c1 = (await getDoc(doc(db, 'coils', child1))).data()!;
    const c2 = (await getDoc(doc(db, 'coils', child2))).data()!;
    const padre = (await getDoc(doc(db, 'coils', parentId))).data()!;

    expect(c1.masterWidth).toBe(400);
    expect(c2.masterWidth).toBe(400);
    expect(padre.masterWidth).toBe(400);   // 1200 - 400 - 400
    expect(padre.status).toBe('AVAILABLE');
  });

  it('slitting de bobina SOLD: lanza error', async () => {
    const parentId = await seedCoil(db, {
      id: 'BOB-SLIT-005',
      masterWidth: 1200,
      currentWeight: 1000,
      initialWeight: 1000,
      pricePerKg: 3.5,
      status: 'SOLD',
    });

    await expect(splitCoilAction(parentId, 600, OPERATOR)).rejects.toThrow('DISPONIBLES');
  });

  it('ancho corte = masterWidth: lanza error', async () => {
    const parentId = await seedCoil(db, {
      id: 'BOB-SLIT-006',
      masterWidth: 1200,
      currentWeight: 1000,
      initialWeight: 1000,
      pricePerKg: 3.5,
      status: 'AVAILABLE',
    });

    await expect(splitCoilAction(parentId, 1200, OPERATOR)).rejects.toThrow('estrictamente menor');
  });

  it('bobina sin masterWidth: lanza error descriptivo', async () => {
    const parentId = await seedCoil(db, {
      id: 'BOB-SLIT-007',
      currentWeight: 1000,
      initialWeight: 1000,
      pricePerKg: 3.5,
      status: 'AVAILABLE',
      // sin masterWidth
    });

    await expect(splitCoilAction(parentId, 600, OPERATOR)).rejects.toThrow('ancho maestro');
  });

  it('bobina inexistente: lanza error', async () => {
    await expect(splitCoilAction('NO-EXISTE', 600, OPERATOR)).rejects.toThrow('no existe');
  });
});
