import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import {
  setupIntegrationTest,
  clearFirestore,
  cleanupIntegrationTest,
} from './firestore-helpers';
import { doc, getDoc, setDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';
import { runSaleImportTransaction } from '@/core/import/runSaleImportTransaction';
import { buildImportWrites } from '@/core/import/salesImportLogic';
import { getAllActiveFulfillmentLogs } from '@/modules/metallic-roofing/services/productionService';
import { hasActiveProduction, bucketLogsBySourceId } from '@/core/production/fulfillmentLogic';

vi.unmock('@/lib/firebase/clientApp');

/**
 * [IMPORT-OVERWRITE] — el importador escribía la percha de producción
 * `COT-{documentNumber}` con un `tx.set` SIN `tx.get` previo, mientras la venta
 * (`saleRef`) en el MISMO bloque sí tiene guard (COMPLETED -> abortar,
 * VOIDED -> archivar). Una re-importación pisaba en silencio cualquier percha
 * existente. Víctimas registradas en prod: COT-FFA1-1255 y COT-FFA1-1250.
 *
 * Estos tests llaman al MÓDULO EXTRAÍDO (`runSaleImportTransaction`), no a
 * `page.tsx` y no a una re-implementación — que es exactamente lo que
 * `[IMPORT-EXTRACT]` (C3, v6.82.0) destrabó. `simulateImport` de los otros 3
 * archivos NO se toca: sigue siendo la segunda implementación declarada.
 */

// El flag de producción activa se resuelve PRE-transacción, igual que en el
// call-site real: una transacción de Firestore no corre queries, solo doc-get
// (mismo motivo por el que `annulSale` resuelve la suya afuera, v6.48.6).
async function resolveActivePerchaProduction(quoteId: string): Promise<boolean> {
  const buckets = bucketLogsBySourceId(await getAllActiveFulfillmentLogs());
  return hasActiveProduction(buckets.get(quoteId) ?? []);
}

async function importOne(sale: any) {
  const quoteId = `COT-${sale.documentNumber}`;
  const hasActivePerchaProduction = await resolveActivePerchaProduction(quoteId);
  return runTransaction(db, (tx) =>
    runSaleImportTransaction(tx, {
      db,
      sale,
      userUid: 'uid-test',
      userEmail: 'test@example.com',
      hasActivePerchaProduction,
    }),
  );
}

describe('[IMPORT-OVERWRITE] la percha de producción no se pisa en silencio', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest();
  });

  beforeEach(async () => {
    await clearFirestore();
  });

  // FACTURA + ítem metallic-roofing es lo que hace que `buildImportWrites`
  // emita percha (guard `createsProductionPercha`, v6.55.0).
  const metallicSale = {
    documentNumber: "FFA1-1255",
    customerName: "MADICOP S.A.C.",
    customerDocument: "20601234567",
    status: "COMPLETED",
    sellerId: "SISTEMA",
    currency: "PEN",
    exchangeRateApplied: 1,
    documentType: "FACTURA",
    adjustedDocument: "",
    ncStockAction: "MONEY_ONLY",
    originalCurrencyAmount: 0,
    timestamp: new Date("2026-06-05T17:00:00.000Z"),
    items: [
      {
        sku: "COB030ROJO",
        productName: "COBERTURA ALUZINC 0.30MM ROJO",
        quantity: 100,
        unitPrice: 12,
        unitValue: 10.169,
        baseCost: 0,
        unitWeight: 0,
        calculatedWeight: 0,
        unitOfMeasure: "METRO LINEAL",
        businessLine: "metallic-roofing",
        isCoil: false,
        flags: ["sin costo"],
      },
    ],
    totalAmount: 1200,
    totalCost: 0,
    totalProfit: 0,
    totalWeight: 0,
    paymentStatus: "PAID",
    businessLines: ["metallic-roofing"],
    allFlags: ["sin costo"],
  };

  const QUOTE_ID = `COT-${metallicSale.documentNumber}`;

  /**
   * Siembra la percha preexistente con el snapshot financiero QUE EL PROPIO BUILDER
   * produce para esta misma venta, y recién encima le pisa `status` y los marcadores.
   *
   * No es cosmética: `firestore.rules:101` exige
   * `fieldsUnchanged(['totalAmount','subtotal','igv','exchangeRate','currency','items','paymentType'])`
   * en todo `update` de `sales`. Una percha sembrada a mano SIN esos campos hace que
   * el `tx.set` del importador sea rechazado por RULES (`PERMISSION_DENIED`,
   * `evaluation error at L101:24`) antes de llegar al guard — medido en la 1ª corrida
   * del RED de este frente. Y ése NO es el escenario de producción: las 2 víctimas
   * reales (COT-FFA1-1255 / COT-FFA1-1250) eran re-importaciones del MISMO comprobante,
   * así que su snapshot financiero coincidía, `fieldsUnchanged` pasaba, y el pisado
   * ocurría. El fixture tiene que reproducir eso o no prueba nada.
   */
  async function seedPercha(overrides: Record<string, unknown>) {
    const { quotationDoc } = buildImportWrites(
      { ...metallicSale, metadata: { isReplacement: false, uploadedBy: 'seed@example.com' } } as any,
      serverTimestamp(),
    );
    await setDoc(doc(db, "sales", QUOTE_ID), { ...quotationDoc, ...overrides });
  }

  it('percha CANCELADA: aborta la transacción entera y NO la pisa', async () => {
    // Percha cancelada preexistente, con 2 marcadores que solo puede tener una
    // cancelación real. Si el `tx.set` la pisa, los 2 desaparecen de un saque.
    await seedPercha({
      status: "CANCELLED",
      cancelledBy: "dueño@ayrsteel.com",
      cancelReason: "MARCADOR_DE_CANCELACION_REAL",
    });

    // El error se captura en vez de assertearse de una: los asserts del ESTADO van
    // primero a propósito, para que el rojo hable del MECANISMO (la percha se pisó)
    // y no del síntoma ("no lanzó"). Con la aserción del throw primero, el rojo dice
    // `promise resolved 'IMPORTED'`, que es cierto pero no muestra el daño.
    const caught = await importOne(metallicSale).then(
      (r) => ({ ok: true as const, r }),
      (e: Error) => ({ ok: false as const, e }),
    );

    // La percha sobrevive intacta: los marcadores siguen ahí.
    const quoteSnap = await getDoc(doc(db, "sales", QUOTE_ID));
    expect(quoteSnap.exists()).toBe(true);
    expect(quoteSnap.data()!.cancelReason).toBe("MARCADOR_DE_CANCELACION_REAL");
    expect(quoteSnap.data()!.cancelledBy).toBe("dueño@ayrsteel.com");
    expect(quoteSnap.data()!.status).toBe("CANCELLED");

    // Y la transacción abortó ENTERA: la venta tampoco se escribió.
    const saleSnap = await getDoc(doc(db, "sales", metallicSale.documentNumber));
    expect(saleSnap.exists()).toBe(false);

    expect(caught.ok).toBe(false);
    expect(!caught.ok && caught.e.message).toMatch(/percha/i);
  });

  it('percha con producción ACTIVA: aborta la transacción entera y NO la pisa', async () => {
    await seedPercha({
      status: "QUOTATION",
      productionStatus: "CONFIRMED",
      confirmedBy: "MARCADOR_DE_PERCHA_EN_PRODUCCION",
    });

    // Producción viva colgando de esa percha.
    await setDoc(doc(db, "production_logs", "LOG-ACTIVE-1255"), {
      status: "ACTIVE",
      line: "metallic-roofing",
      sku: "COB030ROJO",
      piecesProduced: 40,
      source: { type: "QUOTE", id: QUOTE_ID, label: QUOTE_ID },
      timestamp: serverTimestamp(),
    });

    // Precondición del test: el flag se resuelve en true por la vía real.
    expect(await resolveActivePerchaProduction(QUOTE_ID)).toBe(true);

    const caught = await importOne(metallicSale).then(
      (r) => ({ ok: true as const, r }),
      (e: Error) => ({ ok: false as const, e }),
    );

    const quoteSnap = await getDoc(doc(db, "sales", QUOTE_ID));
    expect(quoteSnap.exists()).toBe(true);
    expect(quoteSnap.data()!.confirmedBy).toBe("MARCADOR_DE_PERCHA_EN_PRODUCCION");
    expect(quoteSnap.data()!.status).toBe("QUOTATION");

    const saleSnap = await getDoc(doc(db, "sales", metallicSale.documentNumber));
    expect(saleSnap.exists()).toBe(false);

    expect(caught.ok).toBe(false);
    expect(!caught.ok && caught.e.message).toMatch(/percha/i);
  });

  // Control positivo. Sin él, los 2 asserts de arriba serían igual de
  // compatibles con "el guard bloquea SIEMPRE", que es otro bug — el mismo
  // criterio del GRUPO K de sales.rules.test.ts (v6.64.0).
  it('CONTROL: sin percha previa, la importación escribe venta y percha normalmente', async () => {
    const result = await importOne(metallicSale);
    expect(result).toBe("IMPORTED");

    const saleSnap = await getDoc(doc(db, "sales", metallicSale.documentNumber));
    const quoteSnap = await getDoc(doc(db, "sales", QUOTE_ID));
    expect(saleSnap.exists()).toBe(true);
    expect(quoteSnap.exists()).toBe(true);
    expect(quoteSnap.data()!.status).toBe("QUOTATION");
  });
});
