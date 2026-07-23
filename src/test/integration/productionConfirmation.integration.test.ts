import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import {
  setupIntegrationTest,
  clearFirestore,
  cleanupIntegrationTest,
} from './firestore-helpers';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';
// FAILS IN RED! confirmQuotationForProduction todavía no existe en salesService.ts
// (el import resuelve, pero el named export es undefined -> TypeError al invocarlo).
import { confirmQuotationForProduction, fetchSales } from '@/core/sales/services/salesService';

vi.unmock('@/lib/firebase/clientApp');

describe('confirmQuotationForProduction - Frente 1 productionStatus (RED PHASE)', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest();
  });

  beforeEach(async () => {
    await clearFirestore();
  });

  const baseQuotation = {
    status: 'QUOTATION',
    customerName: 'MADICOP S.A.C.',
    documentNumber: '20601234567',
    totalAmount: 1200,
    totalCost: 800,
    totalProfit: 400,
    sellerId: 'vendedor@ayrsteel.com',
    businessLines: ['metallic-roofing'],
    items: [
      {
        sku: 'COB030ROJO',
        businessLine: 'metallic-roofing',
        quantity: 100,
        unitPrice: 12,
        unitValue: 10.169,
        baseCost: 8,
        unitWeight: 5,
      },
    ],
    timestamp: new Date('2026-07-20T15:00:00.000Z'),
  };

  // 5. Confirmar una cotización PENDING setea productionStatus CONFIRMED y NO altera el resto del doc
  it('5. Confirmar cotización PENDING -> productionStatus CONFIRMED; status/totalAmount/items INTACTOS (leído del doc escrito)', async () => {
    const quoteId = 'C-000030';
    await setDoc(doc(db, 'sales', quoteId), { ...baseQuotation, productionStatus: 'PENDING' });

    await confirmQuotationForProduction(quoteId, 'admin@ayrsteel.com');

    const snap = await getDoc(doc(db, 'sales', quoteId));
    const data = snap.data()!;

    expect(data.productionStatus).toBe('CONFIRMED');
    // Snapshot financiero y de negocio: NO se toca al confirmar (no es approveQuotation).
    expect(data.status).toBe('QUOTATION');
    expect(data.totalAmount).toBe(baseQuotation.totalAmount);
    expect(data.items).toEqual(baseQuotation.items);
  });

  // 6. Cotización LEGACY sin productionStatus (como las 23 reales de prod, COT- pre-v6.26.x)
  it('6. Cotización LEGACY (sin campo productionStatus, como las 23 de prod) -> confirmar la deja en CONFIRMED igual', async () => {
    const quoteId = 'COT-BBV1-316';
    const { productionStatus: _omit, ...legacyQuotation } = { ...baseQuotation, productionStatus: undefined as any };
    await setDoc(doc(db, 'sales', quoteId), legacyQuotation);

    const preSnap = await getDoc(doc(db, 'sales', quoteId));
    expect(preSnap.data()).not.toHaveProperty('productionStatus');

    await confirmQuotationForProduction(quoteId, 'admin@ayrsteel.com');

    const postSnap = await getDoc(doc(db, 'sales', quoteId));
    const data = postSnap.data()!;

    // ANCLA: una cotización legacy (sin el campo) se comporta como si fuera PENDING —
    // confirmarla la deja CONFIRMED igual que a una cotización nueva. No hace falta
    // backfill previo para que el flujo de confirmación funcione sobre datos viejos.
    expect(data.productionStatus).toBe('CONFIRMED');
    expect(data.status).toBe('QUOTATION');
    expect(data.totalAmount).toBe(baseQuotation.totalAmount);
  });

  // 7. Selector de producción: solo CONFIRMED aparece. PENDING y legacy (sin campo) NO.
  it('7. RED ADICIONAL: fetchSales(productionStatusFilter=CONFIRMED) devuelve SOLO la confirmada; PENDING y legacy (sin campo) quedan afuera', async () => {
    const { productionStatus: _omit, ...legacyBase } = { ...baseQuotation, productionStatus: undefined as any };

    await setDoc(doc(db, 'sales', 'COT-CONFIRMED-001'), { ...baseQuotation, documentNumber: 'CONFIRMED-001', productionStatus: 'CONFIRMED' });
    await setDoc(doc(db, 'sales', 'C-PENDING-001'), { ...baseQuotation, documentNumber: 'PENDING-001', productionStatus: 'PENDING' });
    // ANCLA: legacy (sin el campo, como las 23 reales de prod) queda EXCLUIDA del selector
    // hasta que se confirme una vez (test 6) o se haga backfill — es el motivo documentado
    // del backfill pendiente en HANDOFF.md, no un bug de este test.
    await setDoc(doc(db, 'sales', 'COT-LEGACY-001'), { ...legacyBase, documentNumber: 'LEGACY-001' });

    const result = await fetchSales({
      pageSize: 100,
      statusFilter: 'QUOTATION',
      businessLine: 'metallic-roofing',
      searchTerm: '',
      startDate: '',
      endDate: '',
      sunatFilter: '',
      skipAggregates: true,
      productionStatusFilter: 'CONFIRMED',
    } as any);

    const ids = result.sales.map((s: any) => s.id);
    // FAILS IN RED! fetchSales todavía no soporta productionStatusFilter -> devuelve las 3.
    expect(ids).toEqual(['COT-CONFIRMED-001']);
    expect(ids).not.toContain('C-PENDING-001');
    expect(ids).not.toContain('COT-LEGACY-001');
  });

  // 8. confirmQuotationForProduction setea confirmedForProductionAt (timestamp servidor) y confirmedBy (email)
  it('8. RED ADICIONAL: confirmar setea confirmedForProductionAt (timestamp) y confirmedBy (email) en el doc escrito', async () => {
    const quoteId = 'C-000031';
    await setDoc(doc(db, 'sales', quoteId), { ...baseQuotation, productionStatus: 'PENDING' });

    const before = Date.now();
    await confirmQuotationForProduction(quoteId, 'supervisor@ayrsteel.com');
    const after = Date.now();

    const snap = await getDoc(doc(db, 'sales', quoteId));
    const data = snap.data()!;

    // FAILS IN RED! confirmedBy todavía no se escribe.
    expect(data.confirmedBy).toBe('supervisor@ayrsteel.com');
    // FAILS IN RED! confirmedForProductionAt todavía no se escribe.
    expect(data.confirmedForProductionAt).toBeDefined();
    const confirmedAtMs = data.confirmedForProductionAt.toDate().getTime();
    expect(confirmedAtMs).toBeGreaterThanOrEqual(before - 1000);
    expect(confirmedAtMs).toBeLessThanOrEqual(after + 1000);
  });

  // 9. Idempotencia: confirmar una cotización YA CONFIRMED no pisa confirmedForProductionAt/confirmedBy originales
  it('9. RED ADICIONAL: confirmar una cotización YA CONFIRMED es no-op — NO pisa confirmedForProductionAt ni confirmedBy originales', async () => {
    const quoteId = 'C-000032';
    const originalDate = new Date('2026-07-01T10:00:00.000Z');
    await setDoc(doc(db, 'sales', quoteId), {
      ...baseQuotation,
      productionStatus: 'CONFIRMED',
      confirmedForProductionAt: originalDate,
      confirmedBy: 'primer-admin@ayrsteel.com',
    });

    // Un segundo usuario intenta "re-confirmar" la misma cotización.
    await confirmQuotationForProduction(quoteId, 'otro-admin@ayrsteel.com');

    const snap = await getDoc(doc(db, 'sales', quoteId));
    const data = snap.data()!;

    expect(data.productionStatus).toBe('CONFIRMED');
    // ANCLA: la fecha y el autor ORIGINALES de la confirmación NO se pisan (idempotente,
    // mismo patrón que voidCoilScrap/reverseCoilSplit: early-return si ya está en el
    // estado terminal). FAILS IN RED (hoy la función ni existe, TypeError).
    expect(data.confirmedForProductionAt.toDate().toISOString()).toBe(originalDate.toISOString());
    expect(data.confirmedBy).toBe('primer-admin@ayrsteel.com');
  });
});
