import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import * as admin from '../../../functions/node_modules/firebase-admin';
import { produceFromStrip } from '../../../functions/src/callables/drywallProduction';
import { clearFirestore } from './firestore-helpers';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

describe('produceFromStrip Callable Integration Tests', () => {
  let db: admin.firestore.Firestore;

  beforeAll(async () => {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: TEST_PROJECT_ID });
    }
    db = admin.firestore();
  });
  
  beforeEach(async () => {
    await clearFirestore(TEST_PROJECT_ID);

    // Setup base para los tests de callable
    await db.collection('products').doc('P38GALV-CALLABLE').set({
      sku: 'P38GALV-CALLABLE',
      stripWidth: 121,
      standardWeight: 0.5,
      lengthMeters: 3.0
    });
    // Setup strip stock
    await db.collection('strips_stock').doc('121').set({
      widthMm: 121,
      totalStrips: 10,
      totalWeight: 1000,
      avgCostPerKg: 3.5 // => Costo por tira: 3.5 * 100 = 350
    });
  });

  it('1. caso feliz: asserts de WAC a mano y conteo de docs', async () => {
    // Stock inicial del producto
    await db.collection('inventory_stock').doc('P38GALV-CALLABLE').set({
      sku: 'P38GALV-CALLABLE',
      totalQuantity: 200,
      totalWeight: 100, // 200 piezas * 0.5kg
      lastCostPerPiece: 15.0 // WAC actual. Total valor: 3000
    });

    const request = {
      data: {
        sku: 'P38GALV-CALLABLE',
        pieces: 100,
        stripsUsed: 5,
        requestId: 'req-drywall-1'
      },
      auth: { uid: 'u-admin', token: { role: 'ADMIN', email: 'admin@ayr.com' } }
    };

    const res = await produceFromStrip.run(request as any);
    expect(res.success).toBe(true);

    // Asserts calculados a mano:
    // Tiras usadas = 5. Peso = 500kg. Costo total de tiras usadas = 5 * 350 = 1750 PEN.
    // WAC Nuevo = (3000 + 1750) / 300 = 4750 / 300 = 15.833333
    // Peso reportado = 100 * 0.5 = 50kg.
    
    const stockSnap = await db.collection('inventory_stock').doc('P38GALV-CALLABLE').get();
    expect(stockSnap.data()?.totalQuantity).toBe(300);
    expect(stockSnap.data()?.totalWeight).toBe(150); // 100 inicial + 50 reportado
    expect(stockSnap.data()?.lastCostPerPiece).toBeCloseTo(15.833333, 5);

    const stripStockSnap = await db.collection('strips_stock').doc('121').get();
    expect(stripStockSnap.data()?.totalStrips).toBe(5); // 10 - 5
    expect(stripStockSnap.data()?.totalWeight).toBe(500); // 1000 - 500

    const logsSnap = await db.collection('production_logs').get();
    expect(logsSnap.size).toBe(1);
    expect(logsSnap.docs[0].data().consumedCostPEN).toBe(1750);
    expect(logsSnap.docs[0].data().averageCostAfter).toBeCloseTo(15.833333, 5);

    const kardexSnap = await db.collection('kardex_movements').get();
    expect(kardexSnap.size).toBe(1);
    expect(kardexSnap.docs[0].data().type).toBe('IN');
    expect(kardexSnap.docs[0].data().quantity).toBe(100);

    const stripMovementsSnap = await db.collection('strips_movements').get();
    expect(stripMovementsSnap.size).toBe(1);
    expect(stripMovementsSnap.docs[0].data().type).toBe('SALIDA');
    expect(stripMovementsSnap.docs[0].data().quantity).toBe(5);
  });

  it('2. IDEMPOTENCIA: misma requestId 2x -> cuenta de docs 1', async () => {
    const request = {
      data: {
        sku: 'P38GALV-CALLABLE',
        pieces: 100,
        stripsUsed: 5,
        requestId: 'req-drywall-idemp'
      },
      auth: { uid: 'u-admin', token: { role: 'ADMIN' } }
    };

    const res1 = await produceFromStrip.run(request as any);
    const res2 = await produceFromStrip.run(request as any);

    expect(res1).toEqual(res2); // Mismo resultado cacheado

    // Solo se descontó 5 flejes
    const stripStockSnap = await db.collection('strips_stock').doc('121').get();
    expect(stripStockSnap.data()?.totalStrips).toBe(5);

    const logsSnap = await db.collection('production_logs').get();
    expect(logsSnap.size).toBe(1); // Solo 1 log, no 2

    const idempotencyKeys = await db.collection('idempotency_keys').get();
    expect(idempotencyKeys.size).toBe(1);
  });

  it('3. ROLLBACK TOTAL: forzar fallo a mitad -> nada escrito', async () => {
    const request = {
      data: {
        sku: 'P38GALV-CALLABLE',
        pieces: -100, // provocará error "piezas debe ser > 0"
        stripsUsed: 5,
        requestId: 'req-drywall-rollback'
      },
      auth: { uid: 'u-admin', token: { role: 'ADMIN' } }
    };

    await expect(produceFromStrip.run(request as any)).rejects.toThrow();

    // Verificar que el stock quedó intacto
    const stripStockSnap = await db.collection('strips_stock').doc('121').get();
    expect(stripStockSnap.data()?.totalStrips).toBe(10); // intacto

    const logsSnap = await db.collection('production_logs').get();
    expect(logsSnap.size).toBe(0);

    const idempotencyKeys = await db.collection('idempotency_keys').get();
    expect(idempotencyKeys.size).toBe(0);
  });

  it('4. BYPASS: ignora payload malicioso', async () => {
    // Inyectar 'consumedCost' y 'averageCostAfter' maliciosos en la data
    const request = {
      data: {
        sku: 'P38GALV-CALLABLE',
        pieces: 10,
        stripsUsed: 1,
        requestId: 'req-drywall-bypass',
        // Campos maliciosos
        consumedCostPEN: 99999,
        newAverageCost: 99999
      },
      auth: { uid: 'u-admin', token: { role: 'ADMIN' } }
    };

    const res = await produceFromStrip.run(request as any);
    expect(res.success).toBe(true);

    // Costo verdadero: 1 tira = 350 PEN
    const logsSnap = await db.collection('production_logs').get();
    expect(logsSnap.docs[0].data().consumedCostPEN).toBe(350); // Ignoró el 99999
  });
});
