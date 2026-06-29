import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = 'test-metallic-prod-' + Date.now();
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import {
  setupIntegrationTest,
  clearFirestore,
  cleanupIntegrationTest,
  seedCoil,
  seedFinish,
  seedStock,
} from './firestore-helpers';
import { produceFromCoils, voidProductionFromCoils } from '@/modules/metallic-roofing/services/productionService';
import { db } from '@/lib/firebase/clientApp';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';

vi.unmock('@/lib/firebase/clientApp');

const OPERATOR = 'op@ayrsteel.com';

// ── Helpers de seed ────────────────────────────────────────────────────────────

async function seedAluzincFinish(densityFactor = 0.00785) {
  await seedFinish(db, {
    id: 'ALUZINC',
    label: 'ALUZINC',
    active: true,
    lines: ['metallic-roofing'],
    densityFactor,
  });
}

async function seedAluzincCoil(overrides: Record<string, unknown> = {}) {
  return seedCoil(db, {
    id: `BOB-ALU-${Date.now()}`,
    finish: 'ALUZINC',
    initialWeight: 5000,
    currentWeight: 5000,
    masterWidth: 1200,
    thickness: 0.45,
    pricePerKg: 3.5,
    status: 'AVAILABLE',
    ...overrides,
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

describe('produceFromCoils — Conformado Aluzinc (Integration — Emulador)', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest(null, db);
  });

  beforeEach(async () => {
    await clearFirestore(db);
    await seedAluzincFinish();
  });

  // ── 1. Caso base: 2 bobinas, WAC correcto ──────────────────────────────────

  it('2 bobinas → stock sube, WAC correcto, production_log congelado, kardex OUT×2 + IN', async () => {
    // Bobina A: 1000 kg, 1200mm, S/.3.5/kg, δ=0.00785
    // Bobina B: 800 kg, 1100mm, S/.4.2/kg — pero ALUZINC tiene masterWidth=1200 aquí
    // Para simplificar, ambas con 1200mm pero distinto pricePerKg.
    const coilIdA = await seedAluzincCoil({ id: 'BOB-A', currentWeight: 1000, pricePerKg: 3.5 });
    const coilIdB = await seedAluzincCoil({ id: 'BOB-B', currentWeight: 800, pricePerKg: 4.2 });

    // Stock inicial terminado: 10 unidades a S/.50/u
    await seedStock(db, 'metallic_roofing_stock', 'COB045ALU', {
      sku: 'COB045ALU',
      productName: 'COBERTURA ALUZINC',
      quantity: 10,
      avgCost: 50,
      totalValue: 500,
    });

    // 50 ML de A, 80 ML de B
    // weight_A = 50 × 0.45 × 1200 × 0.00785 = 211.95 kg
    // weight_B = 80 × 0.45 × 1200 × 0.00785 = 339.12 kg
    // cost_A = 211.95 × 3.5 = 741.825
    // cost_B = 339.12 × 4.2 = 1424.304
    // totalML = 130, costoTotal = 2166.129
    // costoUnitario = 2166.129 / 130 ≈ 16.662
    // newAvgCost = (10×50 + 2166.129) / (10+130) ≈ 19.043...

    const result = await produceFromCoils({
      targetSku: 'COB045ALU',
        requestId: "req-" + Math.random().toString(),
      productKind: 'COBERTURA_ML',
      lengthM: null,
      coilInputs: [
        { coilId: coilIdA, declared: 50 },
        { coilId: coilIdB, declared: 80 },
      ],
      
          });

    expect(result.success).toBe(true);
    expect(result.cantidadProducida).toBe(130);
    expect(result.costoUnitarioPEN).toBeCloseTo(16.662, 2);
    expect(result.hasNegativeCoilWarning).toBe(false);

    // Verificar bobinas descuentadas
    const snapA = await getDoc(doc(db, 'coils', coilIdA));
    const snapB = await getDoc(doc(db, 'coils', coilIdB));
    expect(snapA.data()!.currentWeight).toBeCloseTo(1000 - 211.95, 1);
    expect(snapA.data()!.status).toBe('IN_PROGRESS');
    expect(snapB.data()!.currentWeight).toBeCloseTo(800 - 339.12, 1);
    expect(snapB.data()!.status).toBe('IN_PROGRESS');

    // Verificar stock terminado
    const stockSnap = await getDoc(doc(db, 'metallic_roofing_stock', 'COB045ALU'));
    expect(stockSnap.data()!.quantity).toBe(140);       // 10 + 130
    expect(stockSnap.data()!.avgCost).toBeCloseTo(19.043, 1);

    // Verificar production_log
    const logsSnap = await getDocs(collection(db, 'production_logs'));
    expect(logsSnap.docs).toHaveLength(1);
    const log = logsSnap.docs[0].data();
    expect(log.sku).toBe('COB045ALU');
    expect(log.line).toBe('metallic-roofing');
    expect(log.piecesProduced).toBe(130);
    expect(log.costPerPiece).toBeCloseTo(16.662, 2);  // congelado
    expect(log.reportedWeight).toBeCloseTo(551.07, 2);
    expect(log.averageCostAfter).toBeCloseTo(19.043, 2);
    expect(log.status).toBe('ACTIVE');
    expect(log.parentCoilIds).toEqual(expect.arrayContaining([coilIdA, coilIdB]));
    expect(log.parentCoilId).toBe(coilIdA); // compat legacy

    // Verificar kardex: 2 OUT (bobinas)
    const kardexSnap = await getDocs(collection(db, 'kardex_movements'));
    const movements = kardexSnap.docs.map((d) => d.data());
    const outs = movements.filter((m) => m.type === 'OUT');
    expect(outs).toHaveLength(2);

    // Verificar stock_movements: 1 IN (producto terminado)
    const stockMovementsSnap = await getDocs(collection(db, 'metallic_roofing_stock_movements'));
    const stockMovements = stockMovementsSnap.docs.map((d) => d.data());
    const ins = stockMovements.filter((m) => m.type === 'ENTRADA');
    expect(ins).toHaveLength(1);

    const outA = outs.find((m) => m.sku === coilIdA);
    expect(outA).toBeDefined();
    expect(outA!.weightKg).toBeCloseTo(211.95, 1);
    expect(outA!.costPerKg).toBe(3.5);
  });

  // ── 2. Bobina procesada completamente → status PROCESSED ──────────────────

  it('bobina cuyo peso baja a ≤0 queda PROCESSED', async () => {
    const coilId = await seedAluzincCoil({ id: 'BOB-FULL', currentWeight: 200 });
    await seedStock(db, 'metallic_roofing_stock', 'COB045ALU', { quantity: 0, avgCost: 0 });

    // Consumir exactamente el peso de la bobina:
    // weight = ML × 0.45 × 1200 × 0.00785 = ML × 4.239 → para 200kg: ML ≈ 47.18
    // Usar 48 ML para sobrepasar levemente (forzar PROCESSED)
    await produceFromCoils({
      targetSku: 'COB045ALU',
        requestId: "req-" + Math.random().toString(),
      productKind: 'COBERTURA_ML',
      lengthM: null,
      coilInputs: [{ coilId, declared: 48 }],
      
          });

    const snap = await getDoc(doc(db, 'coils', coilId));
    expect(snap.data()!.currentWeight).toBeLessThanOrEqual(0);
    expect(snap.data()!.status).toBe('PROCESSED');
  });

  // ── 3. Peso negativo de bobina → hasNegativeCoilWarning (no excepción) ────

  it('consumo > currentWeight → permite, retorna hasNegativeCoilWarning:true', async () => {
    const coilId = await seedAluzincCoil({ id: 'BOB-NEG', currentWeight: 50 });
    await seedStock(db, 'metallic_roofing_stock', 'COB045ALU', { quantity: 0, avgCost: 0 });

    // 200 ML → weight = 200 × 0.45 × 1200 × 0.00785 = 847.8 kg >> 50 kg
    const result = await produceFromCoils({
      targetSku: 'COB045ALU',
        requestId: "req-" + Math.random().toString(),
      productKind: 'COBERTURA_ML',
      lengthM: null,
      coilInputs: [{ coilId, declared: 200 }],
      
          });

    expect(result.success).toBe(true);
    expect(result.hasNegativeCoilWarning).toBe(true);

    const snap = await getDoc(doc(db, 'coils', coilId));
    expect(snap.data()!.currentWeight).toBeLessThan(0);
  });

  // ── 4. WAC del stock terminado calculado correctamente ────────────────────

  it('WAC nuevo = (cantidadActual×costActual + costoTotal) / nuevaCantidad', async () => {
    const coilId = await seedAluzincCoil({ id: 'BOB-WAC', currentWeight: 2000, pricePerKg: 4 });
    // Stock inicial: 20 unidades a S/.30/u
    await seedStock(db, 'metallic_roofing_stock', 'SKU-WAC', {
      sku: 'SKU-WAC',
      productName: 'TEST',
      quantity: 20,
      avgCost: 30,
      totalValue: 600,
    });

    // Producir 100 ML:
    // weight = 100 × 0.45 × 1200 × 0.00785 = 423.9 kg
    // cost = 423.9 × 4 = 1695.6
    // costoUnitario = 1695.6 / 100 = 16.956
    // newQty = 120, newValue = 600 + 1695.6 = 2295.6
    // newAvgCost = 2295.6 / 120 = 19.13

    await produceFromCoils({
      targetSku: 'SKU-WAC',
        requestId: "req-" + Math.random().toString(),
      productKind: 'COBERTURA_ML',
      lengthM: null,
      coilInputs: [{ coilId, declared: 100 }],
      
          });

    const stockSnap = await getDoc(doc(db, 'metallic_roofing_stock', 'SKU-WAC'));
    expect(stockSnap.data()!.quantity).toBe(120);
    expect(stockSnap.data()!.avgCost).toBeCloseTo(19.13, 1);
  });

  // ── 5. Acabado sin densityFactor → bloquea con error claro ───────────────

  it('acabado sin densityFactor → bloquea producción con mensaje claro', async () => {
    // Crear un acabado SIN densityFactor
    await seedFinish(db, {
      id: 'SIN_FACTOR',
      label: 'SIN FACTOR',
      active: true,
      lines: ['metallic-roofing'],
      densityFactor: null
    });
    const coilId = await seedAluzincCoil({ id: 'BOB-SF', finish: 'SIN_FACTOR' });
    await seedStock(db, 'metallic_roofing_stock', 'COB045ALU', { quantity: 0, avgCost: 0 });

    await expect(
      produceFromCoils({
        targetSku: 'COB045ALU',
        requestId: "req-" + Math.random().toString(),
        productKind: 'COBERTURA_ML',
        lengthM: null,
        coilInputs: [{ coilId, declared: 50 }],
        
              }),
    ).rejects.toThrow('factor de densidad');
  });

  // ── 6. Bobina inexistente → error ─────────────────────────────────────────

  it('bobina inexistente → error claro', async () => {
    await seedStock(db, 'metallic_roofing_stock', 'COB045ALU', { quantity: 0, avgCost: 0 });

    await expect(
      produceFromCoils({
        targetSku: 'COB045ALU',
        requestId: "req-" + Math.random().toString(),
        productKind: 'COBERTURA_ML',
        lengthM: null,
        coilInputs: [{ coilId: 'BOB-NO-EXISTE', declared: 50 }],
        
              }),
    ).rejects.toThrow('no existe');
  });

  // ── 7. Bobina SOLD → error de estado ─────────────────────────────────────

  it('bobina SOLD → error de estado', async () => {
    const coilId = await seedAluzincCoil({ id: 'BOB-SOLD', status: 'SOLD' });
    await seedStock(db, 'metallic_roofing_stock', 'COB045ALU', { quantity: 0, avgCost: 0 });

    await expect(
      produceFromCoils({
        targetSku: 'COB045ALU',
        requestId: "req-" + Math.random().toString(),
        productKind: 'COBERTURA_ML',
        lengthM: null,
        coilInputs: [{ coilId, declared: 50 }],
        
              }),
    ).rejects.toThrow('SOLD');
  });

  // ── 8. Todo en una transacción: si falla → rollback total ────────────────

  it('fallo a mitad (bobina 2 inexistente) → rollback: bobina 1 sin cambios', async () => {
    const coilId = await seedAluzincCoil({ id: 'BOB-ROLLBACK', currentWeight: 1000 });
    await seedStock(db, 'metallic_roofing_stock', 'COB045ALU', { quantity: 0, avgCost: 0 });

    await expect(
      produceFromCoils({
        targetSku: 'COB045ALU',
        requestId: "req-" + Math.random().toString(),
        productKind: 'COBERTURA_ML',
        lengthM: null,
        coilInputs: [
          { coilId, declared: 50 },
          { coilId: 'BOB-INEXISTENTE', declared: 30 },
        ],
        
              }),
    ).rejects.toThrow();

    // La bobina real no debe haber cambiado (rollback)
    const snap = await getDoc(doc(db, 'coils', coilId));
    expect(snap.data()!.currentWeight).toBe(1000);
    expect(snap.data()!.status).toBe('AVAILABLE');

    // Stock también sin cambios
    const stockSnap = await getDoc(doc(db, 'metallic_roofing_stock', 'COB045ALU'));
    expect(stockSnap.data()!.quantity).toBe(0);
  });
});

describe('voidProductionFromCoils — Anulación de Aluzinc (Integration)', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest(null, db);
  });

  beforeEach(async () => {
    await clearFirestore(db);
    await seedAluzincFinish();
  });

  it('anula correctamente un caso multi-bobina (COBERTURA_ML)', async () => {
    // Setup initial data
    const coilIdA = await seedAluzincCoil({ id: 'BOB-VOID-A', initialWeight: 1000, currentWeight: 1000, pricePerKg: 3.5 });
    const coilIdB = await seedAluzincCoil({ id: 'BOB-VOID-B', initialWeight: 800, currentWeight: 800, pricePerKg: 4.2 });

    await seedStock(db, 'metallic_roofing_stock', 'COB045ALU', {
      sku: 'COB045ALU',
      productName: 'COBERTURA ALUZINC',
      quantity: 10,
      avgCost: 50,
      totalValue: 500,
    });

    // Producir
    const prodResult = await produceFromCoils({
      targetSku: 'COB045ALU',
        requestId: "req-" + Math.random().toString(),
      productKind: 'COBERTURA_ML',
      lengthM: null,
      coilInputs: [
        { coilId: coilIdA, declared: 50 },
        { coilId: coilIdB, declared: 80 },
      ],
      
          });

    expect(prodResult.success).toBe(true);

    // Obtener log
    const logsSnap = await getDocs(collection(db, 'production_logs'));
    expect(logsSnap.docs).toHaveLength(1);
    const logId = logsSnap.docs[0].id;

    // Anular
    const voidResult = await voidProductionFromCoils(logId, OPERATOR);
    expect(voidResult.success).toBe(true);

    // VERIFICACIONES
    // 1. Bobinas recuperaron su peso exacto
    const snapA = await getDoc(doc(db, 'coils', coilIdA));
    const snapB = await getDoc(doc(db, 'coils', coilIdB));
    expect(snapA.data()!.currentWeight).toBe(1000);
    expect(snapA.data()!.status).toBe('AVAILABLE');
    expect(snapB.data()!.currentWeight).toBe(800);
    expect(snapB.data()!.status).toBe('AVAILABLE');

    // 2. Stock recuperó cantidad y recalcula WAC
    const stockSnap = await getDoc(doc(db, 'metallic_roofing_stock', 'COB045ALU'));
    expect(stockSnap.data()!.quantity).toBe(10);
    expect(stockSnap.data()!.totalValue).toBeCloseTo(500, 2);
    expect(stockSnap.data()!.avgCost).toBeCloseTo(50, 2);

    // 3. Log está VOIDED
    const logSnap = await getDoc(doc(db, 'production_logs', logId));
    expect(logSnap.data()!.status).toBe('VOIDED');
    expect(logSnap.data()!.voidedBy).toBe(OPERATOR);

    // 4. Kardex tiene IN
    const kardexSnap = await getDocs(collection(db, 'kardex_movements'));
    const movements = kardexSnap.docs.map((d) => d.data());
    const ins = movements.filter((m) => m.type === 'IN');
    expect(ins).toHaveLength(2); // 2 bobinas
    expect(ins[0].reference).toBe(logId);

    // 5. Stock movements tiene SALIDA
    const stockMovementsSnap = await getDocs(collection(db, 'metallic_roofing_stock_movements'));
    const stockMovements = stockMovementsSnap.docs.map((d) => d.data());
    const salidas = stockMovements.filter((m) => m.type === 'SALIDA');
    expect(salidas).toHaveLength(1);
    expect(salidas[0].referenceId).toBe(logId);

    // 6. Idempotencia
    await expect(voidProductionFromCoils(logId, OPERATOR)).rejects.toThrow(/ya fue anulado/i);
  });
});

