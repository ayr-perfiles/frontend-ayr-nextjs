import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import {
  setupIntegrationTest,
  clearFirestore,
  cleanupIntegrationTest,
} from './firestore-helpers';
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';
import { markQuotationAccepted, cancelQuotation } from '@/core/sales/services/salesService';
import { buildQuotationDoc } from '@/core/sales/domain/saleDocBuilder';

vi.unmock('@/lib/firebase/clientApp');

/**
 * [QUOTATION-APPROVE-UNREACHABLE] (COLA #1) — U1, la escritura.
 *
 * DECISIÓN DE NEGOCIO (1), del dueño: aprobar = MARCAR LA ACEPTACIÓN DEL CLIENTE.
 * **No mueve stock, no descuenta, no escribe kardex, no toca bobinas.** Aceptar no
 * es vender. Esa decisión NO se confía a la lectura del código: se asserta contando
 * las colecciones ANTES y DESPUÉS (U1.2c). Un assert negativo no se satisface con
 * "no vi nada".
 *
 * DECISIÓN (3): los 2 campos (`clientAccepted` + `clientAcceptedAt`) se escriben
 * SIEMPRE JUNTOS, por un único escritor. Que no puedan discrepar tampoco se confía:
 * se asserta (U1.2b), y la mutación M1 lo verifica.
 *
 * DECISIÓN (5): `approveQuotation` NO se toca ni se reusa — ese camino crea una venta
 * `COMPLETED` con kardex y marca la bobina `SOLD`. Este camino es propio.
 *
 * Fixture con el BUILDER REAL (`buildQuotationDoc`), no a mano — B19.
 */

/** Colecciones que la decisión (1) prohíbe tocar. Se cuentan antes y después. */
const COLECCIONES_PROHIBIDAS = [
  'metallic_roofing_stock',
  'metallic_roofing_stock_movements',
  'kardex_movements',
  'coils',
] as const;

async function contarProhibidas(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const col of COLECCIONES_PROHIBIDAS) {
    const snap = await getDocs(collection(db, col));
    out[col] = snap.size;
  }
  return out;
}

function quotationDoc(overrides: Record<string, unknown> = {}) {
  const base = buildQuotationDoc(
    {
      status: "QUOTATION",
      customerName: "CLIENTE ACEPTACION",
      customerDocument: "20600000009",
      documentNumber: "",
      sellerId: "u-admin",
      items: [
        {
          sku: "COB030ROJO",
          productName: "COBERTURA ALUZINC 0.30MM ROJO",
          quantity: 100,
          unitPrice: 12,
          unitValue: 10.169,
          baseCost: 0,
          businessLine: "metallic-roofing",
          unitOfMeasure: "METRO LINEAL",
          isCoil: false,
        },
      ],
    },
    Timestamp.fromDate(new Date("2026-08-31T12:00:00.000Z")),
  );
  return { ...base, ...overrides };
}

describe('[QUOTATION-APPROVE-UNREACHABLE] marcar aceptación del cliente', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest();
  });

  beforeEach(async () => {
    await clearFirestore();
  });

  it('marca la aceptación: los 2 campos JUNTOS, status INTACTO, y CERO escritura de stock', async () => {
    const QUOTE_ID = 'C-000901';
    await setDoc(doc(db, 'sales', QUOTE_ID), quotationDoc());

    // Se siembra stock real para que "cero movimiento" sea una medición sobre
    // colecciones POBLADAS, no sobre colecciones vacías (donde 0 === 0 sería
    // verdadero por accidente y no por el mecanismo).
    await setDoc(doc(db, 'metallic_roofing_stock', 'COB030ROJO'), {
      sku: 'COB030ROJO',
      quantity: 500,
      avgCost: 4,
      totalValue: 2000,
    });

    const antes = await contarProhibidas();
    const stockAntes = (await getDoc(doc(db, 'metallic_roofing_stock', 'COB030ROJO'))).data();

    await markQuotationAccepted(QUOTE_ID, 'vendedor@ayrsteel.com');

    const snap = await getDoc(doc(db, 'sales', QUOTE_ID));
    const data = snap.data()!;

    // (a) el booleano
    expect(data.clientAccepted).toBe(true);
    // (b) el timestamp, en el MISMO update — nunca uno sin el otro
    expect(data.clientAcceptedAt).toBeDefined();
    expect(typeof data.clientAcceptedAt?.toDate).toBe('function');

    // (c) LA DECISIÓN DE NEGOCIO: aceptar NO es vender.
    expect(data.status).toBe('QUOTATION');
    const despues = await contarProhibidas();
    expect(despues).toEqual(antes);
    const stockDespues = (await getDoc(doc(db, 'metallic_roofing_stock', 'COB030ROJO'))).data();
    expect(stockDespues).toEqual(stockAntes);
  });

  it('una cotización YA aceptada no se re-acepta (el timestamp original no se pisa)', async () => {
    const QUOTE_ID = 'C-000902';
    const original = Timestamp.fromDate(new Date("2026-08-20T09:00:00.000Z"));
    await setDoc(
      doc(db, 'sales', QUOTE_ID),
      quotationDoc({ clientAccepted: true, clientAcceptedAt: original }),
    );

    await expect(markQuotationAccepted(QUOTE_ID, 'vendedor@ayrsteel.com')).rejects.toThrow(/acept/i);

    const data = (await getDoc(doc(db, 'sales', QUOTE_ID))).data()!;
    expect(data.clientAcceptedAt.toMillis()).toBe(original.toMillis());
  });

  it('una percha IMPORTADA no se acepta: nace de una factura ya emitida', async () => {
    const QUOTE_ID = 'COT-FFA1-9001';
    await setDoc(
      doc(db, 'sales', QUOTE_ID),
      quotationDoc({ relatedSaleId: 'FFA1-9001', metadata: { isQuotation: true } }),
    );

    await expect(markQuotationAccepted(QUOTE_ID, 'vendedor@ayrsteel.com')).rejects.toThrow(/importada/i);

    const data = (await getDoc(doc(db, 'sales', QUOTE_ID))).data()!;
    expect(data.clientAccepted).toBeUndefined();
  });

  // CONTROL POSITIVO (criterio GRUPO K, v6.64.0): un caso que HOY pasa y debe
  // seguir pasando. Sin él, los asserts negativos de arriba serían igual de
  // compatibles con "el camino de cotizaciones quedó bloqueado para todo".
  it('CONTROL: cancelQuotation sobre una cotización nativa sigue funcionando', async () => {
    const QUOTE_ID = 'C-000903';
    await setDoc(doc(db, 'sales', QUOTE_ID), quotationDoc());

    await cancelQuotation(QUOTE_ID, 'vendedor@ayrsteel.com');

    const data = (await getDoc(doc(db, 'sales', QUOTE_ID))).data()!;
    expect(data.status).toBe('CANCELLED');
  });
});
