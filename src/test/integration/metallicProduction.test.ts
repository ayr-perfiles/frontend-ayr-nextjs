import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import {
  setupIntegrationTest,
  clearFirestore,
  cleanupIntegrationTest,
  seedCoil,
  seedFinish,
  seedStock,
} from './firestore-helpers';
import { produceFromCoils } from '@/modules/metallic-roofing/services/productionService';
import { db } from '@/lib/firebase/clientApp';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';

vi.unmock('@/lib/firebase/clientApp');

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
      source: { type: 'QUOTE', id: 'COT-TEST-1' }
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
      source: { type: 'QUOTE', id: 'COT-TEST-2' }
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
      source: { type: 'QUOTE', id: 'COT-TEST-3' }
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
      source: { type: 'QUOTE', id: 'COT-TEST-4' }
    });

    const stockSnap = await getDoc(doc(db, 'metallic_roofing_stock', 'SKU-WAC'));
    expect(stockSnap.data()!.quantity).toBe(120);
    expect(stockSnap.data()!.avgCost).toBeCloseTo(19.13, 1);
  });

  // ── 4b. [STOCK-NEG-WAC] — el guard del WAC mira el saldo previo, no el resultante ──
  // Geometría propia (densityFactor=0.001, thickness=1, masterWidth=1000) para que
  // weightPerML = 1×1000×0.001 = 1 kg/ML exacto, y con pricePerKg=4 el costoUnitarioPEN
  // sale 4.00 exacto en los 3 casos — evita ruido de punto flotante en las assertions.

  it('R1: currentQty negativa, la producción CRUZA a positivo → WAC = costo del lote (no la mezcla)', async () => {
    await seedAluzincFinish(0.001);
    await seedStock(db, 'metallic_roofing_stock', 'SKU-WAC-R1', {
      sku: 'SKU-WAC-R1',
      productName: 'TEST-R1',
      quantity: -2796.8,
      avgCost: 0,
      totalValue: 0,
    });
    const coilId = await seedAluzincCoil({ id: 'BOB-WAC-R1', currentWeight: 10000, thickness: 1, masterWidth: 1000, pricePerKg: 4 });

    await produceFromCoils({
      targetSku: 'SKU-WAC-R1',
      requestId: "req-" + Math.random().toString(),
      productKind: 'COBERTURA_ML',
      lengthM: null,
      coilInputs: [{ coilId, declared: 3500 }],
      source: { type: 'QUOTE', id: 'COT-TEST-R1' }
    });

    const stockSnap = await getDoc(doc(db, 'metallic_roofing_stock', 'SKU-WAC-R1'));
    expect(stockSnap.data()!.quantity).toBeCloseTo(703.2, 4);
    expect(stockSnap.data()!.avgCost).toBe(4);
    expect(stockSnap.data()!.totalValue).toBeCloseTo(2812.8, 2);
  });

  it('R2: currentQty negativa, la producción NO alcanza a cruzar → sigue negativa', async () => {
    await seedAluzincFinish(0.001);
    await seedStock(db, 'metallic_roofing_stock', 'SKU-WAC-R2', {
      sku: 'SKU-WAC-R2',
      productName: 'TEST-R2',
      quantity: -2796.8,
      avgCost: 0,
      totalValue: 0,
    });
    const coilId = await seedAluzincCoil({ id: 'BOB-WAC-R2', currentWeight: 2000, thickness: 1, masterWidth: 1000, pricePerKg: 4 });

    await produceFromCoils({
      targetSku: 'SKU-WAC-R2',
      requestId: "req-" + Math.random().toString(),
      productKind: 'COBERTURA_ML',
      lengthM: null,
      coilInputs: [{ coilId, declared: 1000 }],
      source: { type: 'QUOTE', id: 'COT-TEST-R2' }
    });

    const stockSnap = await getDoc(doc(db, 'metallic_roofing_stock', 'SKU-WAC-R2'));
    expect(stockSnap.data()!.quantity).toBeCloseTo(-1796.8, 4);
    expect(stockSnap.data()!.avgCost).toBe(4);
    expect(stockSnap.data()!.totalValue).toBeCloseTo(-7187.2, 2);
  });

  it('R3: currentQty EXACTAMENTE 0 (borde del guard) → WAC = costo del lote', async () => {
    await seedAluzincFinish(0.001);
    await seedStock(db, 'metallic_roofing_stock', 'SKU-WAC-R3', {
      sku: 'SKU-WAC-R3',
      productName: 'TEST-R3',
      quantity: 0,
      avgCost: 0,
      totalValue: 0,
    });
    const coilId = await seedAluzincCoil({ id: 'BOB-WAC-R3', currentWeight: 2000, thickness: 1, masterWidth: 1000, pricePerKg: 4 });

    await produceFromCoils({
      targetSku: 'SKU-WAC-R3',
      requestId: "req-" + Math.random().toString(),
      productKind: 'COBERTURA_ML',
      lengthM: null,
      coilInputs: [{ coilId, declared: 1000 }],
      source: { type: 'QUOTE', id: 'COT-TEST-R3' }
    });

    const stockSnap = await getDoc(doc(db, 'metallic_roofing_stock', 'SKU-WAC-R3'));
    expect(stockSnap.data()!.quantity).toBe(1000);
    expect(stockSnap.data()!.avgCost).toBe(4);
    expect(stockSnap.data()!.totalValue).toBe(4000);
  });

  it('R4 (no-regresión): currentQty POSITIVA → mezcla ponderada clásica intacta', async () => {
    await seedStock(db, 'metallic_roofing_stock', 'SKU-WAC-R4', {
      sku: 'SKU-WAC-R4',
      productName: 'TEST-R4',
      quantity: 20,
      avgCost: 30,
      totalValue: 600,
    });
    const coilId = await seedAluzincCoil({ id: 'BOB-WAC-R4', currentWeight: 2000, thickness: 0.45, masterWidth: 1200, pricePerKg: 4 });

    await produceFromCoils({
      targetSku: 'SKU-WAC-R4',
      requestId: "req-" + Math.random().toString(),
      productKind: 'COBERTURA_ML',
      lengthM: null,
      coilInputs: [{ coilId, declared: 100 }],
      source: { type: 'QUOTE', id: 'COT-TEST-R4' }
    });

    const stockSnap = await getDoc(doc(db, 'metallic_roofing_stock', 'SKU-WAC-R4'));
    expect(stockSnap.data()!.quantity).toBe(120);
    expect(stockSnap.data()!.avgCost).toBeCloseTo(19.13, 1);
  });

  it('R5: currentQty negativa CON avgCost previo ≠0, la producción cruza a positivo (2da parte de una carga en 2 tandas)', async () => {
    // Encadena exactamente donde termina R2: quantity:-1796.8, avgCost:4.00 (el resultado
    // de una primera producción que no alcanzó a cruzar). Acá llega la segunda producción,
    // a OTRO costo unitario (6.00), y esta sí cruza a positivo.
    //
    // Ni el valor NUEVO (6.00, el costo de este lote) ni el VIEJO (11.110353, la mezcla que
    // arrastra el avgCost residual del lote anterior) son el costo "verdadero" multi-lote —
    // ese sería 19000/3500 = 5.428571, y exigiría un acumulador de valor histórico que
    // NINGUNA de las 3 implementaciones de WAC del repo (esta, drywall, adjustStock) tiene.
    // El fix no persigue exactitud multi-lote (decisión ya tomada de no construir ese
    // acumulador) — busca acotar el error a "costo del lote que cruza", no "mezcla con un
    // avgCost residual que nunca fue un WAC real". NO "corregir" este número a 5.428571 sin
    // abrir ese frente aparte.
    await seedAluzincFinish(0.001);
    await seedStock(db, 'metallic_roofing_stock', 'SKU-WAC-R5', {
      sku: 'SKU-WAC-R5',
      productName: 'TEST-R5',
      quantity: -1796.8,
      avgCost: 4.00,
      totalValue: -7187.2,
    });
    const coilId = await seedAluzincCoil({ id: 'BOB-WAC-R5', currentWeight: 5000, thickness: 1, masterWidth: 1000, pricePerKg: 6 });

    await produceFromCoils({
      targetSku: 'SKU-WAC-R5',
      requestId: "req-" + Math.random().toString(),
      productKind: 'COBERTURA_ML',
      lengthM: null,
      coilInputs: [{ coilId, declared: 2500 }],
      source: { type: 'QUOTE', id: 'COT-TEST-R5' }
    });

    const stockSnap = await getDoc(doc(db, 'metallic_roofing_stock', 'SKU-WAC-R5'));
    expect(stockSnap.data()!.quantity).toBeCloseTo(703.2, 4);
    expect(stockSnap.data()!.avgCost).toBe(6);
    expect(stockSnap.data()!.totalValue).toBeCloseTo(4219.2, 2);
  });

  it('hasWacResetWarning: true cuando el saldo previo era <0 (el WAC se reseteó)', async () => {
    await seedAluzincFinish(0.001);
    await seedStock(db, 'metallic_roofing_stock', 'SKU-WAC-FLAG-A', {
      sku: 'SKU-WAC-FLAG-A',
      productName: 'TEST-FLAG-A',
      quantity: -2796.8,
      avgCost: 0,
      totalValue: 0,
    });
    const coilId = await seedAluzincCoil({ id: 'BOB-WAC-FLAG-A', currentWeight: 10000, thickness: 1, masterWidth: 1000, pricePerKg: 4 });

    const result = await produceFromCoils({
      targetSku: 'SKU-WAC-FLAG-A',
      requestId: "req-" + Math.random().toString(),
      productKind: 'COBERTURA_ML',
      lengthM: null,
      coilInputs: [{ coilId, declared: 3500 }],
      source: { type: 'QUOTE', id: 'COT-TEST-FLAG-A' }
    });

    expect(result.hasWacResetWarning).toBe(true);
  });

  it('hasWacResetWarning: false cuando el saldo previo era positivo (mezcla ponderada normal)', async () => {
    await seedStock(db, 'metallic_roofing_stock', 'SKU-WAC-FLAG-B', {
      sku: 'SKU-WAC-FLAG-B',
      productName: 'TEST-FLAG-B',
      quantity: 20,
      avgCost: 30,
      totalValue: 600,
    });
    const coilId = await seedAluzincCoil({ id: 'BOB-WAC-FLAG-B', currentWeight: 2000, thickness: 0.45, masterWidth: 1200, pricePerKg: 4 });

    const result = await produceFromCoils({
      targetSku: 'SKU-WAC-FLAG-B',
      requestId: "req-" + Math.random().toString(),
      productKind: 'COBERTURA_ML',
      lengthM: null,
      coilInputs: [{ coilId, declared: 100 }],
      source: { type: 'QUOTE', id: 'COT-TEST-FLAG-B' }
    });

    expect(result.hasWacResetWarning).toBe(false);
  });

  it('R6: currentQty EXACTAMENTE 0 → hasWacResetWarning false (no se pierde valor, no hay reset)', async () => {
    // Mismo seed que R3: con saldo previo 0, currentQty*currentAvgCost se anula, newValue
    // queda igual a costoTotalPEN, y las 2 ramas del ternario dan el mismo numero — no hay
    // perdida de informacion que advertir. Es el borde donde el guard (>0) y la advertencia
    // (<0) dejan de coincidir a propósito: preguntan cosas distintas.
    await seedAluzincFinish(0.001);
    await seedStock(db, 'metallic_roofing_stock', 'SKU-WAC-R6', {
      sku: 'SKU-WAC-R6',
      productName: 'TEST-R6',
      quantity: 0,
      avgCost: 0,
      totalValue: 0,
    });
    const coilId = await seedAluzincCoil({ id: 'BOB-WAC-R6', currentWeight: 2000, thickness: 1, masterWidth: 1000, pricePerKg: 4 });

    const result = await produceFromCoils({
      targetSku: 'SKU-WAC-R6',
      requestId: "req-" + Math.random().toString(),
      productKind: 'COBERTURA_ML',
      lengthM: null,
      coilInputs: [{ coilId, declared: 1000 }],
      source: { type: 'QUOTE', id: 'COT-TEST-R6' }
    });

    expect(result.hasWacResetWarning).toBe(false);

    const stockSnap = await getDoc(doc(db, 'metallic_roofing_stock', 'SKU-WAC-R6'));
    expect(stockSnap.data()!.avgCost).toBe(4);
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
        source: { type: 'QUOTE', id: 'COT-TEST-5' }
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
        source: { type: 'QUOTE', id: 'COT-TEST-6' }
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
        source: { type: 'QUOTE', id: 'COT-TEST-7' }
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
        source: { type: 'QUOTE', id: 'COT-TEST-8' }
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

  // ── 9. Validación source obligatoria (Guard v6.22) ──────────────────────

  it('rechaza si falta source o no es de type QUOTE (Guard v6.22)', async () => {
    const coilId = await seedAluzincCoil({ id: 'BOB-NO-SOURCE', currentWeight: 1000 });
    await seedStock(db, 'metallic_roofing_stock', 'COB045ALU', { quantity: 0, avgCost: 0 });

    await expect(
      produceFromCoils({
        targetSku: 'COB045ALU',
        requestId: "req-" + Math.random().toString(),
        productKind: 'COBERTURA_ML',
        lengthM: null,
        coilInputs: [{ coilId, declared: 50 }],
        // source intentionally omitted
      }),
    ).rejects.toThrow('Es obligatorio proveer una cotización para producir.');
  });
});

