import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import {
  setupIntegrationTest,
  clearFirestore,
  cleanupIntegrationTest,
  seedCoil,
} from './firestore-helpers';
import { receiveStrips } from '@/core/coils/services/cutOrderService';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';

// Desactivar el mock global de db para usar el emulador
vi.unmock('@/lib/firebase/clientApp');

/**
 * INVARIANTE BAJO PRUEBA — "Mundo A" (v6.42):
 * `coil.pricePerKg` SIEMPRE está en PEN. `computePricePerKg` (coilPricing.ts) ya aplicó
 * el tipo de cambio al registrar la bobina: `(totalValue * exchangeRate) / weightKg`.
 *
 * Por lo tanto el costo de material de una orden de corte es `sentWeight * pricePerKg`,
 * SIN volver a multiplicar por `metadata.exchangeRate` — hacerlo infla el costo ~TC veces
 * y ese número contamina `costPerKgUtil` -> `strips_stock.avgCostPerKg`.
 *
 * La conversión que SÍ es legítima es la del costo de SERVICIO
 * (`invoice.gravada * invoice.exchangeRate`), que es un monto crudo de la factura del tercero.
 */

const CUT_ORDER_ID = 'CO-TEST-USD';
const WIDTH_MM = 100;

async function seedCutOrder(coilId: string, sentWeight: number) {
  await setDoc(doc(db, 'cut_orders', CUT_ORDER_ID), {
    tercero: { nombre: 'CORTES SAC', ruc: '20512345678' },
    status: 'ENVIADO',
    coils: [{ coilId, sentWeight, cutPlan: [{ widthMm: WIDTH_MM, count: 10 }] }],
    sentWeightTotal: sentWeight,
    sentAt: new Date(),
    sentBy: 'test@example.com',
  });
}

async function readStripAvgCost(): Promise<number> {
  const snap = await getDoc(doc(db, 'strips_stock', String(WIDTH_MM)));
  expect(snap.exists()).toBe(true);
  return (snap.data() as any).avgCostPerKg;
}

async function readSingleMovementCost(): Promise<number> {
  const snaps = await getDocs(collection(db, 'strips_movements'));
  expect(snaps.size).toBe(1);
  return (snaps.docs[0].data() as any).costPerKg;
}

describe('cutOrderService.receiveStrips — costo de material (Integration)', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest(null, db);
  });

  beforeEach(async () => {
    await clearFirestore(db);
  });

  it('bobina USD: NO reconvierte pricePerKg por exchangeRate (Mundo A)', async () => {
    // pricePerKg 10 ya está en PEN aunque la factura de compra haya sido en USD.
    const coilId = await seedCoil(db, {
      id: 'BOB-USD-01',
      finish: 'GALV',
      initialWeight: 1000,
      currentWeight: 1000,
      pricePerKg: 10,
      metadata: { currency: 'USD', exchangeRate: 3.4 },
    });
    await seedCutOrder(coilId, 1000);

    await receiveStrips({
      cutOrderId: CUT_ORDER_ID,
      // gravada 0 => serviceCostPEN 0 => el costo del fleje es SOLO material.
      invoice: {
        number: 'F001-1', date: '2026-08-20', currency: 'PEN',
        exchangeRate: 1, gravada: 0, igv: 0, total: 0,
      },
      receivedStrips: [{ coilId, widthMm: WIDTH_MM, count: 10, weight: 1000 }],
      receivedWeightTotal: 1000,
      userEmail: 'test@example.com',
    });

    // material = 1000 kg * 10 PEN/kg = 10.000 PEN; / 1000 kg recibidos = 10 PEN/kg.
    // Con la doble conversión daría 10 * 3.4 = 34.
    expect(await readStripAvgCost()).toBeCloseTo(10, 6);
    expect(await readSingleMovementCost()).toBeCloseTo(10, 6);
  });

  it('bobina PEN: sin cambio (no-regresión)', async () => {
    const coilId = await seedCoil(db, {
      id: 'BOB-PEN-01',
      finish: 'GALV',
      initialWeight: 1000,
      currentWeight: 1000,
      pricePerKg: 10,
      metadata: { currency: 'PEN', exchangeRate: 1 },
    });
    await seedCutOrder(coilId, 1000);

    await receiveStrips({
      cutOrderId: CUT_ORDER_ID,
      invoice: {
        number: 'F001-2', date: '2026-08-20', currency: 'PEN',
        exchangeRate: 1, gravada: 0, igv: 0, total: 0,
      },
      receivedStrips: [{ coilId, widthMm: WIDTH_MM, count: 10, weight: 1000 }],
      receivedWeightTotal: 1000,
      userEmail: 'test@example.com',
    });

    expect(await readStripAvgCost()).toBeCloseTo(10, 6);
  });

  it('bobina USD + factura de servicio en USD: solo el SERVICIO se convierte', async () => {
    const coilId = await seedCoil(db, {
      id: 'BOB-USD-02',
      finish: 'GALV',
      initialWeight: 1000,
      currentWeight: 1000,
      pricePerKg: 10,
      metadata: { currency: 'USD', exchangeRate: 3.4 },
    });
    await seedCutOrder(coilId, 1000);

    await receiveStrips({
      cutOrderId: CUT_ORDER_ID,
      // gravada 100 USD * TC 3.4 = 340 PEN de servicio (conversión legítima).
      invoice: {
        number: 'F001-3', date: '2026-08-20', currency: 'USD',
        exchangeRate: 3.4, gravada: 100, igv: 18, total: 118,
      },
      receivedStrips: [{ coilId, widthMm: WIDTH_MM, count: 10, weight: 1000 }],
      receivedWeightTotal: 1000,
      userEmail: 'test@example.com',
    });

    // (10.000 material + 340 servicio) / 1000 kg = 10,34 PEN/kg.
    expect(await readStripAvgCost()).toBeCloseTo(10.34, 6);
  });
});
