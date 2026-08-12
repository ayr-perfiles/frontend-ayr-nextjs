import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import * as admin from '../../../functions/node_modules/firebase-admin';
import { produceFromCoils } from '../../../functions/src/callables/production';
import { clearFirestore } from './firestore-helpers';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

describe('produceFromCoils Integration Tests', () => {
  let db: admin.firestore.Firestore;

  beforeAll(async () => {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: TEST_PROJECT_ID });
    }
    db = admin.firestore();
  });
  
  beforeEach(async () => {
    await clearFirestore(TEST_PROJECT_ID);
  });


  it('1. feliz 1 bobina: validar coil actualizado, stock incrementado, kardex OUT, production_log con perCoilBreakdown, WAC correcto, audit', async () => {
    // Setup
    await db.collection('coil_finishes').doc('FINISH-1').set({
      label: 'Aluzinc Natural',
      active: true,
      lines: ['metallic-roofing'],
      densityFactor: 0.00785
    });

    await db.collection('coils').doc('COIL-1').set({
      id: 'COIL-1',
      status: 'AVAILABLE',
      finish: 'FINISH-1',
      masterWidth: 1200,
      thickness: 0.3,
      pricePerKg: 3.5,
      currentWeight: 2000,
      initialWeight: 2000
    });

    const request = {
      data: {
        targetSku: 'CALAMINA-TR4-0.3-1200',
        productKind: 'COBERTURA_ML',
        lengthM: null,
        coilInputs: [{ coilId: 'COIL-1', declared: 100 }],
        requestId: 'req-1', source: { type: 'QUOTE', id: 'Q1' }
      },
      auth: {
        uid: 'user-1',
        token: { email: 'operator@test.com', role: 'OPERATOR' }
      }
    };

    const res = await produceFromCoils.run(request as any);

    expect(res.success).toBe(true);
    expect(res.hasNegativeCoilWarning).toBe(false);
    expect(res.cantidadProducida).toBe(100);

    // Verify coil
    const coilSnap = await db.collection('coils').doc('COIL-1').get();
    const coil = coilSnap.data()!;
    // Weight consumed = 100 * 0.3 * 1200 * 0.00785 = 282.6
    expect(coil.currentWeight).toBe(1717.4);
    expect(coil.status).toBe('IN_PROGRESS');

    // Verify stock
    const stockSnap = await db.collection('metallic_roofing_stock').doc('CALAMINA-TR4-0.3-1200').get();
    const stock = stockSnap.data()!;
    expect(stock.quantity).toBe(100);
    // Cost = 282.6 * 3.5 = 989.1
    // AvgCost = 989.1 / 100 = 9.891
    expect(stock.avgCost).toBe(9.891);
    expect(stock.totalValue).toBe(989.1);

    // Verify kardex
    const kardexSnaps = await db.collection('kardex_movements').where('sku', '==', 'COIL-1').get();
    expect(kardexSnaps.size).toBe(1);
    const kardex = kardexSnaps.docs[0].data();
    expect(kardex.type).toBe('OUT');
    expect(kardex.weightKg).toBe(282.6);
    expect(kardex.balance).toBe(1717.4);

    // Verify production_log
    const logs = await db.collection('production_logs').get();
    expect(logs.size).toBe(1);
    const log = logs.docs[0].data();
    expect(log.sku).toBe('CALAMINA-TR4-0.3-1200');
    expect(log.piecesProduced).toBe(100);
    expect(log.perCoilBreakdown).toHaveLength(1);
    expect(log.perCoilBreakdown[0].weightConsumedKg).toBe(282.6);

    // Verify audit
    const audits = await db.collection('audit_logs').where('action', '==', 'PRODUCE_FROM_COILS').get();
    expect(audits.size).toBe(1);
    expect(audits.docs[0].data().action).toBe('PRODUCE_FROM_COILS');
  });


  it('2. feliz multi-coil (3 bobinas, MISMO acabado F-1, pasa normal anti-regresión)', async () => {
    await db.collection('coil_finishes').doc('F-1').set({ label: 'F-1', active: true, lines: ['metallic-roofing'], densityFactor: 0.00785 });
    
    await db.collection('coils').doc('COIL-A').set({ id: 'COIL-A', status: 'AVAILABLE', finish: 'F-1', masterWidth: 1200, thickness: 0.3, pricePerKg: 3.5, currentWeight: 1000, initialWeight: 1000 });
    await db.collection('coils').doc('COIL-B').set({ id: 'COIL-B', status: 'IN_PROGRESS', finish: 'F-1', masterWidth: 1220, thickness: 0.4, pricePerKg: 4.0, currentWeight: 1500, initialWeight: 1500 });
    await db.collection('coils').doc('COIL-C').set({ id: 'COIL-C', status: 'AVAILABLE', finish: 'F-1', masterWidth: 1000, thickness: 0.5, pricePerKg: 3.8, currentWeight: 2000, initialWeight: 2000 });

    const request = {
      data: {
        targetSku: 'CALAMINA-MULTI',
        productKind: 'COBERTURA_ML',
        lengthM: null,
        coilInputs: [
          { coilId: 'COIL-A', declared: 100 },
          { coilId: 'COIL-B', declared: 50 },
          { coilId: 'COIL-C', declared: 200 }
        ],
        requestId: 'req-multi', source: { type: 'QUOTE', id: 'Q1' }
      },
      auth: { uid: 'u-1', token: { email: 'e@test.com', role: 'ADMIN' } }
    };

    const res = await produceFromCoils.run(request as any);
    expect(res.success).toBe(true);
    expect(res.cantidadProducida).toBe(350);

    // COIL-A: 100 * 0.3 * 1200 * 0.00785 = 282.6 kg. Cost: 282.6 * 3.5 = 989.1
    // COIL-B: 50 * 0.4 * 1220 * 0.00785 = 191.54 kg. Cost: 191.54 * 4.0 = 766.16
    // COIL-C: 200 * 0.5 * 1000 * 0.00785 = 785 kg. Cost: 785 * 3.8 = 2983
    // Total Cost = 4738.26. Unit Cost = 4738.26 / 350 = 13.537885...

    const stockSnap = await db.collection('metallic_roofing_stock').doc('CALAMINA-MULTI').get();
    const stock = stockSnap.data()!;
    expect(stock.quantity).toBe(350);
    expect(stock.avgCost).toBeCloseTo(13.537885, 5);

    const logSnap = await db.collection('production_logs').get();
    const log = logSnap.docs[0].data();
    expect(log.perCoilBreakdown).toHaveLength(3);
    
    // Kardex
    const kardexSnaps = await db.collection('kardex_movements').where('type', '==', 'OUT').get();
    expect(kardexSnaps.size).toBe(3);
  });

  it('2b. RED: produceFromCoils con 2 bobinas de DISTINTO finish -> HttpsError failed-precondition, cero escrituras', async () => {
    await db.collection('coil_finishes').doc('F-1').set({ label: 'F-1', active: true, lines: ['metallic-roofing'], densityFactor: 0.00785 });
    await db.collection('coil_finishes').doc('F-2').set({ label: 'F-2', active: true, lines: ['metallic-roofing'], densityFactor: 0.00800 });
    
    await db.collection('coils').doc('COIL-A').set({ id: 'COIL-A', status: 'AVAILABLE', finish: 'F-1', masterWidth: 1200, thickness: 0.3, pricePerKg: 3.5, currentWeight: 1000, initialWeight: 1000 });
    await db.collection('coils').doc('COIL-B').set({ id: 'COIL-B', status: 'IN_PROGRESS', finish: 'F-2', masterWidth: 1220, thickness: 0.4, pricePerKg: 4.0, currentWeight: 1500, initialWeight: 1500 });

    const request = {
      data: {
        targetSku: 'CALAMINA-MULTI-FAIL',
        productKind: 'COBERTURA_ML',
        lengthM: null,
        coilInputs: [
          { coilId: 'COIL-A', declared: 100 },
          { coilId: 'COIL-B', declared: 50 }
        ],
        requestId: 'req-multi-fail', source: { type: 'QUOTE', id: 'Q1' }
      },
      auth: { uid: 'u-1', token: { email: 'e@test.com', role: 'ADMIN' } }
    };

    // Expect the callable to throw the specific error (mono-RAL guard)
    await expect(produceFromCoils.run(request as any)).rejects.toThrow(
      /Todas las bobinas de una corrida deben tener el mismo acabado/
    );

    // Verify ZERO writes
    const coilA = await db.collection('coils').doc('COIL-A').get();
    expect(coilA.data()!.currentWeight).toBe(1000); // Intact

    const coilB = await db.collection('coils').doc('COIL-B').get();
    expect(coilB.data()!.currentWeight).toBe(1500); // Intact

    const stockSnap = await db.collection('metallic_roofing_stock').doc('CALAMINA-MULTI-FAIL').get();
    expect(stockSnap.exists).toBe(false); // No stock created
  });

  it('2c. Densidad: anclá que se lee de coil_finishes por bobina, NUNCA del producto (anti-regresión)', async () => {
    // Validamos que el cálculo de peso consumido usa exactamente el densityFactor de coil_finishes.
    await db.collection('coil_finishes').doc('RAL-3002').set({ label: 'Rojo 3002', active: true, lines: ['metallic-roofing'], densityFactor: 0.008 });
    
    await db.collection('coils').doc('COIL-RAL').set({ id: 'COIL-RAL', status: 'AVAILABLE', finish: 'RAL-3002', masterWidth: 1000, thickness: 0.5, pricePerKg: 3.5, currentWeight: 1000, initialWeight: 1000 });

    const request = {
      data: {
        targetSku: 'CALAMINA-RAL',
        productKind: 'COBERTURA_ML',
        lengthM: null,
        coilInputs: [{ coilId: 'COIL-RAL', declared: 100 }],
        requestId: 'req-ral', source: { type: 'QUOTE', id: 'Q1' }
      },
      auth: { uid: 'u-1', token: { email: 'e@test.com', role: 'ADMIN' } }
    };

    const res = await produceFromCoils.run(request as any);
    expect(res.success).toBe(true);
    
    // ML = 100, masterWidth = 1000mm, thickness = 0.5mm, densityFactor = 0.008
    // Peso consumido = 100 * 0.5 * 1000 * 0.008 = 400 kg.
    const coilSnap = await db.collection('coils').doc('COIL-RAL').get();
    expect(coilSnap.data()!.currentWeight).toBe(600); // 1000 - 400 = 600 kg.
  });

  it('2d. RED: bobina sin finish (legacy) en corrida multi-bobina -> FAIL-CLOSED', async () => {
    await db.collection('coil_finishes').doc('F-1').set({ label: 'F-1', active: true, lines: ['metallic-roofing'], densityFactor: 0.00785 });
    
    // COIL-LEGACY no tiene campo finish
    await db.collection('coils').doc('COIL-A').set({ id: 'COIL-A', status: 'AVAILABLE', finish: 'F-1', masterWidth: 1200, thickness: 0.3, pricePerKg: 3.5, currentWeight: 1000, initialWeight: 1000 });
    await db.collection('coils').doc('COIL-LEGACY').set({ id: 'COIL-LEGACY', status: 'AVAILABLE', masterWidth: 1220, thickness: 0.4, pricePerKg: 4.0, currentWeight: 1500, initialWeight: 1500 });

    const request = {
      data: {
        targetSku: 'CALAMINA-LEGACY-FAIL',
        productKind: 'COBERTURA_ML',
        lengthM: null,
        coilInputs: [
          { coilId: 'COIL-A', declared: 100 },
          { coilId: 'COIL-LEGACY', declared: 50 }
        ],
        requestId: 'req-legacy-fail', source: { type: 'QUOTE', id: 'Q1' }
      },
      auth: { uid: 'u-1', token: { email: 'e@test.com', role: 'ADMIN' } }
    };

    // Expect the callable to throw failed-precondition
    await expect(produceFromCoils.run(request as any)).rejects.toThrow(
      /Todas las bobinas deben tener un acabado registrado/
    );

    // Verify ZERO writes
    const coilLegacy = await db.collection('coils').doc('COIL-LEGACY').get();
    expect(coilLegacy.data()!.currentWeight).toBe(1500); // Intact
  });

  it('3. rol: rechaza sin-rol y roles no autorizados', async () => {
    const req = { data: { requestId: 'r', source: { type: 'QUOTE', id: 'Q1' } }, auth: { uid: 'u', token: { role: 'VIEWER' } } };
    await expect(produceFromCoils.run(req as any)).rejects.toThrow('Rol no autorizado');
  });

  it('4. input: coilInputs vacío, invalid parameters', async () => {
    const base = { auth: { uid: 'u', token: { role: 'ADMIN' } } };
    
    await expect(produceFromCoils.run({ ...base, data: { requestId: 'r1', source: { type: 'QUOTE', id: 'Q1' }, productKind: 'INVALID', coilInputs: [] } } as any)).rejects.toThrow();
    await expect(produceFromCoils.run({ ...base, data: { requestId: 'r2', source: { type: 'QUOTE', id: 'Q1' }, productKind: 'PLANCHA_UND', lengthM: null, coilInputs: [{ coilId: 'C', declared: 10 }] } } as any)).rejects.toThrow();
    await expect(produceFromCoils.run({ ...base, data: { requestId: 'r3', source: { type: 'QUOTE', id: 'Q1' }, productKind: 'COBERTURA_ML', lengthM: null, coilInputs: [{ coilId: 'C', declared: -5 }] } } as any)).rejects.toThrow();
  });

  it('4b. input: rechaza si falta source o source invalido', async () => {
    const base = { auth: { uid: 'u', token: { role: 'ADMIN' } } };
    const validData = { targetSku: 'SKU', productKind: 'COBERTURA_ML', lengthM: null, coilInputs: [{ coilId: 'C', declared: 100 }], requestId: 'req' };
    
    // Sin source
    await expect(produceFromCoils.run({ ...base, data: { ...validData } } as any)).rejects.toThrow('Es obligatorio proveer una cotización');
    // type inválido
    await expect(produceFromCoils.run({ ...base, data: { ...validData, source: { type: 'REQUEST', id: 'R1' } } } as any)).rejects.toThrow('Es obligatorio proveer una cotización');
    // id inválido
    await expect(produceFromCoils.run({ ...base, data: { ...validData, source: { type: 'QUOTE', id: '   ' } } } as any)).rejects.toThrow('Es obligatorio proveer una cotización');
  });

  it('5. precondición todo-o-nada: aborta corrida si falla 1', async () => {
    await db.collection('coil_finishes').doc('F-1').set({ active: true, lines: ['metallic-roofing'], densityFactor: 0.00785 });
    await db.collection('coils').doc('COIL-A').set({ status: 'AVAILABLE', finish: 'F-1', masterWidth: 1200, thickness: 0.3, currentWeight: 1000 });
    await db.collection('coils').doc('COIL-B').set({ status: 'PROCESSED', finish: 'F-1', masterWidth: 1200, thickness: 0.3, currentWeight: 0 }); // INVALID STATUS

    const request = {
      data: {
        targetSku: 'CALAMINA-ABORT', productKind: 'COBERTURA_ML',
        coilInputs: [ { coilId: 'COIL-A', declared: 100 }, { coilId: 'COIL-B', declared: 100 } ],
        requestId: 'req-abort', source: { type: 'QUOTE', id: 'Q1' }
      },
      auth: { uid: 'u-1', token: { role: 'ADMIN' } }
    };

    await expect(produceFromCoils.run(request as any)).rejects.toThrow();

    // Verify COIL-A intact
    const coilASnap = await db.collection('coils').doc('COIL-A').get();
    expect(coilASnap.data()!.currentWeight).toBe(1000); // Intact
    expect(coilASnap.data()!.status).toBe('AVAILABLE');

    // Verify COIL-B intact
    const coilBSnap = await db.collection('coils').doc('COIL-B').get();
    expect(coilBSnap.data()!.currentWeight).toBe(0); // Intact
    expect(coilBSnap.data()!.status).toBe('PROCESSED');

    // Verify production_logs
    const logSnap = await db.collection('production_logs').where('sku', '==', 'CALAMINA-ABORT').get();
    expect(logSnap.size).toBe(0);

    // Verify kardex
    const kardexASnap = await db.collection('kardex_movements').where('sku', '==', 'COIL-A').get();
    expect(kardexASnap.size).toBe(0);
    const kardexBSnap = await db.collection('kardex_movements').where('sku', '==', 'COIL-B').get();
    expect(kardexBSnap.size).toBe(0);

    // Verify stock
    const stockSnap = await db.collection('metallic_roofing_stock').doc('CALAMINA-ABORT').get();
    expect(stockSnap.exists).toBe(false);

    // Verify idempotency
    const idempotencySnap = await db.collection('idempotency_keys').doc('req-abort').get();
    expect(idempotencySnap.exists).toBe(false);
  });

  it('6. finish sin densityFactor -> failed-precondition', async () => {
    await db.collection('coil_finishes').doc('F-NO-DENSITY').set({ active: true, lines: ['metallic-roofing'] });
    await db.collection('coils').doc('COIL-NO-DENSITY').set({ status: 'AVAILABLE', finish: 'F-NO-DENSITY', masterWidth: 1200, thickness: 0.3, currentWeight: 1000 });

    const request = {
      data: {
        targetSku: 'SKU', productKind: 'COBERTURA_ML',
        coilInputs: [ { coilId: 'COIL-NO-DENSITY', declared: 100 } ],
        requestId: 'req-nodensity', source: { type: 'QUOTE', id: 'Q1' }
      },
      auth: { uid: 'u', token: { role: 'ADMIN' } }
    };
    await expect(produceFromCoils.run(request as any)).rejects.toThrow('no tiene factor de densidad');
  });

  it('7. negativo: consumir mas del peso', async () => {
    await db.collection('coil_finishes').doc('F-1').set({ active: true, lines: ['metallic-roofing'], densityFactor: 0.00785 });
    await db.collection('coils').doc('COIL-NEG').set({ id: 'COIL-NEG', status: 'AVAILABLE', finish: 'F-1', masterWidth: 1000, thickness: 1, pricePerKg: 3.5, currentWeight: 10, initialWeight: 10 });

    const request = {
      data: { targetSku: 'SKU-NEG', productKind: 'COBERTURA_ML', coilInputs: [{ coilId: 'COIL-NEG', declared: 100 }], requestId: 'req-neg', source: { type: 'QUOTE', id: 'Q1' } },
      auth: { uid: 'u', token: { role: 'ADMIN' } }
    };

    const res = await produceFromCoils.run(request as any);
    expect(res.success).toBe(true);
    expect(res.hasNegativeCoilWarning).toBe(true);
    
    const coilSnap = await db.collection('coils').doc('COIL-NEG').get();
    expect(coilSnap.data()!.currentWeight).toBeLessThan(0);
    expect(coilSnap.data()!.status).toBe('PROCESSED');
  });

  it('8. WAC sobre stock existente', async () => {
    await db.collection('metallic_roofing_stock').doc('SKU-WAC').set({ quantity: 100, avgCost: 10, totalValue: 1000 });
    await db.collection('coil_finishes').doc('F-1').set({ active: true, lines: ['metallic-roofing'], densityFactor: 0.00785 });
    await db.collection('coils').doc('COIL-WAC').set({ id: 'COIL-WAC', status: 'AVAILABLE', finish: 'F-1', masterWidth: 1000, thickness: 1, pricePerKg: 20, currentWeight: 10000 });

    // Consumimos 10 ML = 10 * 1 * 1000 * 0.00785 = 78.5 kg.
    // Costo de esta corrida = 78.5 * 20 = 1570. Total value nuevo = 1000 + 1570 = 2570.
    // Cantidad nueva = 100 + 10 = 110. WAC nuevo = 2570 / 110 = 23.363636
    const request = {
      data: { targetSku: 'SKU-WAC', productKind: 'COBERTURA_ML', coilInputs: [{ coilId: 'COIL-WAC', declared: 10 }], requestId: 'req-wac', source: { type: 'QUOTE', id: 'Q1' } },
      auth: { uid: 'u', token: { role: 'ADMIN' } }
    };
    await produceFromCoils.run(request as any);

    const stockSnap = await db.collection('metallic_roofing_stock').doc('SKU-WAC').get();
    expect(stockSnap.data()!.avgCost).toBe(23.363636);
  });

  it('9. idempotencia', async () => {
    await db.collection('coil_finishes').doc('F-1').set({ active: true, lines: ['metallic-roofing'], densityFactor: 0.00785 });
    await db.collection('coils').doc('COIL-IDEMP-1').set({ id: 'COIL-IDEMP-1', status: 'AVAILABLE', finish: 'F-1', masterWidth: 1000, thickness: 1, pricePerKg: 3.5, currentWeight: 1000, initialWeight: 1000 });
    await db.collection('coils').doc('COIL-IDEMP-2').set({ id: 'COIL-IDEMP-2', status: 'AVAILABLE', finish: 'F-1', masterWidth: 1000, thickness: 1, pricePerKg: 3.5, currentWeight: 1000, initialWeight: 1000 });

    const request = {
      data: {
        targetSku: 'SKU-IDEMP',
        productKind: 'COBERTURA_ML',
        coilInputs: [
          { coilId: 'COIL-IDEMP-1', declared: 10 },
          { coilId: 'COIL-IDEMP-2', declared: 20 }
        ],
        requestId: 'req-idemp', source: { type: 'QUOTE', id: 'Q1' }
      },
      auth: { uid: 'u', token: { role: 'ADMIN' } }
    };
    
    const res1 = await produceFromCoils.run(request as any);
    const res2 = await produceFromCoils.run(request as any);

    expect(res1).toEqual(res2);

    // weight consumed: 
    // IDEMP-1: 10 * 1 * 1000 * 0.00785 = 78.5
    // IDEMP-2: 20 * 1 * 1000 * 0.00785 = 157
    const coil1Snap = await db.collection('coils').doc('COIL-IDEMP-1').get();
    expect(coil1Snap.data()!.currentWeight).toBe(1000 - 78.5);
    
    const coil2Snap = await db.collection('coils').doc('COIL-IDEMP-2').get();
    expect(coil2Snap.data()!.currentWeight).toBe(1000 - 157);

    const kardexSnaps = await db.collection('kardex_movements').where('reference', '==', 'SKU-IDEMP').get();
    expect(kardexSnaps.size).toBe(2); // Uno por bobina

    const logSnap = await db.collection('production_logs').where('sku', '==', 'SKU-IDEMP').get();
    expect(logSnap.size).toBe(1); // Solo 1 vez

    const stockSnap = await db.collection('metallic_roofing_stock').doc('SKU-IDEMP').get();
    expect(stockSnap.data()!.quantity).toBe(30); // 10 + 20 = 30 producidos en una sola iteración
  });

  it('10. reportedWeightKg override: el costo y peso consumido se basa en reportedWeightKg, no en teórico', async () => {
    await db.collection('coil_finishes').doc('F-REP').set({ label: 'F-REP', active: true, lines: ['metallic-roofing'], densityFactor: 0.00785 });
    await db.collection('coils').doc('COIL-REP').set({ id: 'COIL-REP', status: 'AVAILABLE', finish: 'F-REP', masterWidth: 1000, thickness: 1, pricePerKg: 10, currentWeight: 1000, initialWeight: 1000 });

    const request = {
      data: {
        targetSku: 'SKU-REP',
        productKind: 'COBERTURA_ML',
        coilInputs: [
          // Peso teórico: 10 * 1 * 1000 * 0.00785 = 78.5 kg
          // Costo teórico: 78.5 * 10 = 785 PEN
          // Si mandamos reportedWeightKg: 80, el peso consumido será 80 kg, Costo total = 80 * 10 = 800 PEN.
          { coilId: 'COIL-REP', declared: 10, reportedWeightKg: 80 }
        ],
        requestId: 'req-rep', source: { type: 'QUOTE', id: 'Q1' }
      },
      auth: { uid: 'u', token: { role: 'ADMIN' } }
    };
    
    const res = await produceFromCoils.run(request as any);
    expect(res.cantidadProducida).toBe(10);
    expect(res.costoUnitarioPEN).toBe(80); // 800 / 10 = 80

    const coilSnap = await db.collection('coils').doc('COIL-REP').get();
    expect(coilSnap.data()!.currentWeight).toBe(920); // 1000 - 80

    const stockSnap = await db.collection('metallic_roofing_stock').doc('SKU-REP').get();
    expect(stockSnap.data()!.avgCost).toBe(80);
  });

  it('11. isClosed=true bloquea producción', async () => {
    await db.collection('coil_finishes').doc('F-CLOSED').set({ active: true, lines: ['metallic-roofing'], densityFactor: 0.00785 });
    await db.collection('coils').doc('COIL-CLOSED').set({ id: 'COIL-CLOSED', status: 'AVAILABLE', isClosed: true, finish: 'F-CLOSED', masterWidth: 1000, thickness: 1, pricePerKg: 10, currentWeight: 1000 });

    const request = {
      data: {
        targetSku: 'SKU-CLOSED',
        productKind: 'COBERTURA_ML',
        coilInputs: [{ coilId: 'COIL-CLOSED', declared: 10 }],
        requestId: 'req-closed', source: { type: 'QUOTE', id: 'Q1' }
      },
      auth: { uid: 'u', token: { role: 'ADMIN' } }
    };
    
    await expect(produceFromCoils.run(request as any)).rejects.toThrow('La bobina está cerrada. El supervisor debe abrirla antes de producir.');
  });

  it('12. toggle abrir sobre cerrada -> luego produceFromCoils -> PASA', async () => {
    await db.collection('coil_finishes').doc('F-OPEN').set({ active: true, lines: ['metallic-roofing'], densityFactor: 0.00785 });
    await db.collection('coils').doc('COIL-TOGGLE').set({ id: 'COIL-TOGGLE', status: 'AVAILABLE', isClosed: true, finish: 'F-OPEN', masterWidth: 1000, thickness: 1, pricePerKg: 10, currentWeight: 1000, initialWeight: 1000 });

    // Simular el toggle abriendo la bobina
    await db.collection('coils').doc('COIL-TOGGLE').update({ isClosed: false });

    const request = {
      data: {
        targetSku: 'SKU-TOGGLE',
        productKind: 'COBERTURA_ML',
        coilInputs: [{ coilId: 'COIL-TOGGLE', declared: 10 }],
        requestId: 'req-toggle', source: { type: 'QUOTE', id: 'Q1' }
      },
      auth: { uid: 'u', token: { role: 'ADMIN' } }
    };
    
    const res = await produceFromCoils.run(request as any);
    expect(res.success).toBe(true);

    const coilSnap = await db.collection('coils').doc('COIL-TOGGLE').get();
    expect(coilSnap.data()!.status).toBe('IN_PROGRESS');
  });

  it('13. Write-back de costo: al completar cotización vinculada a venta -> actualiza baseCost, profit y totalCost/totalProfit en sales', async () => {
    await db.collection('coil_finishes').doc('FINISH-WB').set({
      active: true,
      lines: ['metallic-roofing'],
      densityFactor: 0.00785
    });

    await db.collection('coils').doc('COIL-WB').set({
      id: 'COIL-WB',
      status: 'AVAILABLE',
      isClosed: false,
      finish: 'FINISH-WB',
      masterWidth: 1000,
      thickness: 1,
      pricePerKg: 10,
      currentWeight: 1000,
      initialWeight: 1000
    });

    // Cotización vinculada
    await db.collection('sales').doc('COT-F001-999').set({
      id: 'COT-F001-999',
      status: 'CONVERTED',
      relatedSaleId: 'F001-999',
      items: [
        {
          sku: 'SKU-WB',
          quantity: 10,
          businessLine: 'metallic-roofing'
        }
      ]
    });

    // Venta con costo inicial 0 y flag 'sin costo'
    await db.collection('sales').doc('F001-999').set({
      id: 'F001-999',
      status: 'COMPLETED',
      documentNumber: 'F001-999',
      totalAmount: 1000,
      totalCost: 0,
      totalProfit: 847.5,
      allFlags: ['sin costo'],
      items: [
        {
          sku: 'SKU-WB',
          productName: 'COBERTURA WB',
          quantity: 10,
          unitPrice: 100,
          unitValue: 84.75,
          baseCost: 0,
          profit: 847.5,
          businessLine: 'metallic-roofing',
          flags: ['sin costo']
        }
      ]
    });

    const request = {
      data: {
        targetSku: 'SKU-WB',
        productKind: 'COBERTURA_ML',
        coilInputs: [{ coilId: 'COIL-WB', declared: 10 }],
        requestId: 'req-wb-1',
        source: { type: 'QUOTE', id: 'COT-F001-999' }
      },
      auth: { uid: 'user-wb', token: { role: 'ADMIN', email: 'admin@ayr.pe' } }
    };

    const res = await produceFromCoils.run(request as any);
    expect(res.success).toBe(true);

    // Verificar que la venta linkeada fue actualizada
    const saleSnap = await db.collection('sales').doc('F001-999').get();
    expect(saleSnap.exists).toBe(true);
    const saleData = saleSnap.data()!;

    // 10 ML * (1000mm * 1mm * 0.00785 = 7.85 kg/ML) = 78.5 kg * 10 S//kg = S/ 785 total -> S/ 78.50 unitario
    expect(saleData.items[0].baseCost).toBeCloseTo(78.50, 2);
    expect(saleData.items[0].profit).toBeCloseTo((84.75 - 78.50) * 10, 2); // 62.50
    expect(saleData.items[0].costSource).toBe('PRODUCTION');
    expect(saleData.items[0].flags).not.toContain('sin costo');

    expect(saleData.totalCost).toBeCloseTo(785.00, 2);
    expect(saleData.totalProfit).toBeCloseTo(62.50, 2);
    expect(saleData.totalAmount).toBe(1000);
    expect(saleData.allFlags).not.toContain('sin costo');
    expect(saleData.costSyncedAt).toBeDefined();
  });

  it('14. RED 1x1 (M2): produceFromCoils marca isFulfilled en la cotizacion si completa, false si parcial', async () => {
    // Preparar bobina
    await db.collection('coil_finishes').doc('F-FULFILL').set({ active: true, lines: ['metallic-roofing'], densityFactor: 0.00785 });
    await db.collection('coils').doc('COIL-FULFILL').set({
      id: 'COIL-FULFILL', status: 'AVAILABLE', finish: 'F-FULFILL',
      masterWidth: 1000, thickness: 1, pricePerKg: 10, currentWeight: 1000, initialWeight: 1000
    });

    // Crear Cotizacion y Venta (cantidad 20 ML)
    await db.collection('sales').doc('COT-FULFILL').set({
      status: 'QUOTATION',
      productionStatus: 'CONFIRMED',
      isFulfilled: false,
      relatedSaleId: 'SALE-FULFILL',
      items: [
        { businessLine: 'metallic-roofing', sku: 'SKU-FULFILL', quantity: 20, type: 'METALLIC' }
      ]
    });
    await db.collection('sales').doc('SALE-FULFILL').set({
      status: 'COMPLETED',
      items: [
        { businessLine: 'metallic-roofing', sku: 'SKU-FULFILL', quantity: 20, type: 'METALLIC' }
      ]
    });

    // 1. Produccion parcial (10 ML)
    await produceFromCoils.run({
      data: {
        targetSku: 'SKU-FULFILL',
        productKind: 'COBERTURA_ML',
        coilInputs: [{ coilId: 'COIL-FULFILL', declared: 10 }],
        requestId: 'req-partial', source: { type: 'QUOTE', id: 'COT-FULFILL' }
      },
      auth: { uid: 'user-wb', token: { role: 'ADMIN' } }
    } as any);

    let quoteSnap = await db.collection('sales').doc('COT-FULFILL').get();
    expect(quoteSnap.data()!.isFulfilled).toBe(false);

    // 2. Produccion completa (10 ML restantes)
    await produceFromCoils.run({
      data: {
        targetSku: 'SKU-FULFILL',
        productKind: 'COBERTURA_ML',
        coilInputs: [{ coilId: 'COIL-FULFILL', declared: 10 }],
        requestId: 'req-complete', source: { type: 'QUOTE', id: 'COT-FULFILL' }
      },
      auth: { uid: 'user-wb', token: { role: 'ADMIN' } }
    } as any);

    quoteSnap = await db.collection('sales').doc('COT-FULFILL').get();
    expect(quoteSnap.data()!.isFulfilled).toBe(true);
  });

});
