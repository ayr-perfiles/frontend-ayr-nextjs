import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = 'test-coil-consumption-' + Date.now();
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { 
  setupIntegrationTest, 
  clearFirestore, 
  cleanupIntegrationTest, 
  seedCoil, 
  seedFinish,
  seedStock
} from './firestore-helpers';
import { consumeCoil } from '@/core/coils/services/coilConsumptionService';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';

// Desactivar el mock global de db para usar el emulador
vi.unmock('@/lib/firebase/clientApp');

describe('coilConsumptionService.consume (Integration)', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest(null, db);
  });

  beforeEach(async () => {
    await clearFirestore(db);
    // Seed acabados base
    await seedFinish(db, { id: 'ALUZINC', label: 'ALUZINC', active: true, lines: ['metallic-roofing'] });
    await seedFinish(db, { id: 'GALVANIZADO', label: 'GALVANIZADO', active: true, lines: ['drywall'] });
  });

  it('Consumo OK: descuenta peso y actualiza stock metallic-roofing', async () => {
    const coilId = await seedCoil(db, {
      id: 'BOB-ALU-01',
      finish: 'ALUZINC',
      initialWeight: 1000,
      currentWeight: 1000,
      pricePerKg: 10
    });

    // Seed stock inicial
    await seedStock(db, 'metallic_roofing_stock', 'COB030ROJO', {
      quantity: 10,
      avgCost: 100,
      productName: 'COBERTURA ROJA'
    });

    const result = await consumeCoil({
      coilId,
      line: 'metallic-roofing',
      sku: 'COB030ROJO',
      pieces: 5,
      weightConsumed: 100,
      operatorId: 'op-01',
      additionalStockParams: {
        newAverageCost: 95 // PEPPS calculado
      }
    });

    expect(result.success).toBe(true);

    // Verificar bobina
    const coilSnap = await getDoc(doc(db, 'coils', coilId));
    expect((coilSnap.data() as any)?.currentWeight).toBe(900);
    expect((coilSnap.data() as any)?.status).toBe('IN_PROGRESS');

    // Verificar stock
    const stockSnap = await getDoc(doc(db, 'metallic_roofing_stock', 'COB030ROJO'));
    expect((stockSnap.data() as any)?.quantity).toBe(15); // 10 + 5
    expect((stockSnap.data() as any)?.avgCost).toBe(95);

    // Verificar log
    const logsSnap = await getDocs(collection(db, 'production_logs'));
    expect(logsSnap.docs).toHaveLength(1);
    expect(logsSnap.docs[0].data()).toMatchObject({
      parentCoilId: coilId,
      sku: 'COB030ROJO',
      line: 'metallic-roofing'
    });
  });

  it('Error COIL_FINISH_MISMATCH: no permite ALUZINC en drywall y hace ROLLBACK', async () => {
    const coilId = await seedCoil(db, {
      id: 'BOB-ALU-ERROR',
      finish: 'ALUZINC',
      initialWeight: 1000,
      currentWeight: 1000
    });

    // Intentar consumir para drywall (incompatible con ALUZINC)
    await expect(consumeCoil({
      coilId,
      line: 'drywall',
      sku: 'P38GALV',
      pieces: 10,
      weightConsumed: 50,
      operatorId: 'op-01'
    })).rejects.toThrow(/no es compatible con la línea drywall/);

    // Verificar que NO se escribió nada (Rollback)
    const coilSnap = await getDoc(doc(db, 'coils', coilId));
    expect((coilSnap.data() as any)?.currentWeight).toBe(1000);

    const logsSnap = await getDocs(collection(db, 'production_logs'));
    expect(logsSnap.docs).toHaveLength(0);
  });

  it('Stock negativo: permite peso negativo con warning', async () => {
    const coilId = await seedCoil(db, {
      id: 'BOB-NEG',
      finish: 'GALVANIZADO',
      initialWeight: 100,
      currentWeight: 100
    });

    const result = await consumeCoil({
      coilId,
      line: 'drywall',
      sku: 'P38',
      pieces: 10,
      weightConsumed: 150, // Más de lo que hay
      operatorId: 'op-01'
    });

    expect(result.success).toBe(true);
    const coilSnap = await getDoc(doc(db, 'coils', coilId));
    expect((coilSnap.data() as any)?.currentWeight).toBe(-50);
  });

  it('Concurrencia: 2 consumos paralelos no pierden peso', async () => {
    const coilId = await seedCoil(db, {
      id: 'BOB-CONC',
      finish: 'GALVANIZADO',
      initialWeight: 1000,
      currentWeight: 1000
    });

    // Lanzar 2 en paralelo
    await Promise.all([
      consumeCoil({ coilId, line: 'drywall', sku: 'P38', pieces: 1, weightConsumed: 100, operatorId: 'op-1' }),
      consumeCoil({ coilId, line: 'drywall', sku: 'P64', pieces: 1, weightConsumed: 200, operatorId: 'op-2' })
    ]);

    const coilSnap = await getDoc(doc(db, 'coils', coilId));
    expect((coilSnap.data() as any)?.currentWeight).toBe(700); // 1000 - 100 - 200
  });

  it('Acabado inactivo: rechaza consumo', async () => {
    await seedFinish(db, { id: 'OBSOLETO', label: 'OBSOLETO', active: false, lines: ['drywall'] });
    const coilId = await seedCoil(db, { id: 'BOB-OBS', finish: 'OBSOLETO' });

    await expect(consumeCoil({
      coilId,
      line: 'drywall',
      sku: 'P38',
      pieces: 1,
      weightConsumed: 10,
      operatorId: 'op-1'
    })).rejects.toThrow(/está inactivo/);
  });
});
