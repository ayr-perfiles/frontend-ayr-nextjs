import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import {
  setupIntegrationTest,
  clearFirestore,
  cleanupIntegrationTest,
} from './firestore-helpers';
import { collection, doc, getDoc, getDocs, query, where, setDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';
import { runSaleImportTransaction } from '@/core/import/runSaleImportTransaction';
import { buildImportWrites } from '@/core/import/salesImportLogic';
import { getAllActiveFulfillmentLogs } from '@/modules/metallic-roofing/services/productionService';
import { hasActiveProduction, bucketLogsBySourceId } from '@/core/production/fulfillmentLogic';

vi.unmock('@/lib/firebase/clientApp');

/**
 * [IMPORT-PERCHA-ARCHIVE] (COLA #47) — la MITAD que `[IMPORT-OVERWRITE]` (v6.83.0)
 * dejó fuera a propósito. La decisión de v6.76.0 tenía 2 mitades: (a) percha
 * `CANCELLED` / con producción activa -> abortar la transacción entera (YA
 * IMPLEMENTADO, `runSaleImportTransaction.ts`, cubierto por
 * `salesImportOverwrite.integration.test.ts`); (b) percha `QUOTATION` SIN
 * producción -> archivar a `history` y RECIÉN AHÍ pisar, igual que `saleRef`
 * ya hace en el mismo bloque.
 *
 * Llama al MÓDULO EXTRAÍDO (`runSaleImportTransaction`), no a `page.tsx` y no
 * a una re-implementación. `simulateImport` de los otros 3 archivos NO se
 * toca: la divergencia con la función real crece (7º punto, registrado en
 * HANDOFF.md COLA #18) y este frente no la unifica.
 */

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

describe('[IMPORT-PERCHA-ARCHIVE] percha QUOTATION sin producción activa: se archiva y se pisa', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest();
  });

  beforeEach(async () => {
    await clearFirestore();
  });

  // Mismo fixture base que salesImportOverwrite.integration.test.ts: FACTURA +
  // ítem metallic-roofing es lo que hace que `buildImportWrites` emita percha
  // (guard `createsProductionPercha`, v6.55.0).
  const metallicSale = {
    documentNumber: "FFA1-1400",
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

  // Igual que en salesImportOverwrite.integration.test.ts: la percha preexistente
  // se siembra con el snapshot financiero que el propio builder produce para esta
  // misma venta (fieldsUnchanged de firestore.rules:101 lo exige), y recién encima
  // se le pisa un marcador propio del test.
  async function seedPercha(overrides: Record<string, unknown>) {
    const { quotationDoc } = buildImportWrites(
      { ...metallicSale, metadata: { isReplacement: false, uploadedBy: 'seed@example.com' } } as any,
      serverTimestamp(),
    );
    await setDoc(doc(db, "sales", QUOTE_ID), { ...quotationDoc, ...overrides });
  }

  it('percha QUOTATION sin producción activa: se ARCHIVA a history, se audita QUOTATION_REPLACED, y se pisa', async () => {
    await seedPercha({
      status: "QUOTATION",
      confirmedBy: "MARCADOR_DE_PERCHA_VIEJA",
    });

    const result = await importOne(metallicSale);
    expect(result).toBe("IMPORTED");

    // El estado va primero: la percha quedó pisada con contenido NUEVO, el
    // marcador viejo ya no está en el doc vivo.
    const quoteSnap = await getDoc(doc(db, "sales", QUOTE_ID));
    expect(quoteSnap.exists()).toBe(true);
    expect(quoteSnap.data()!.status).toBe("QUOTATION");
    expect(quoteSnap.data()!.confirmedBy).toBeUndefined();

    // El archivado: exactamente 1 doc en history, con el marcador viejo preservado.
    const historySnap = await getDocs(collection(db, "sales", QUOTE_ID, "history"));
    expect(historySnap.size).toBe(1);
    expect(historySnap.docs[0].data().confirmedBy).toBe("MARCADOR_DE_PERCHA_VIEJA");
    expect(historySnap.docs[0].data().status).toBe("QUOTATION");
    expect(historySnap.docs[0].data().archivedReason).toBe("re-import correction");

    // El audit propio, NO reusa SALE_REPLACED (mismo comprobante ya escribe uno
    // por la venta; reusar la acción haría 2 SALE_REPLACED por 1 sola operación
    // y descuadraría cualquier conteo de reemplazos de venta).
    const auditSnap = await getDocs(
      query(collection(db, "audit_logs"), where("action", "==", "QUOTATION_REPLACED")),
    );
    expect(auditSnap.size).toBe(1);
    expect(auditSnap.docs[0].data().documentNumber).toBe(QUOTE_ID);
    expect(auditSnap.docs[0].data().previousStatus).toBe("QUOTATION");
    expect(auditSnap.docs[0].data().historyPath).toBe(historySnap.docs[0].ref.path);
  });

  // Control positivo (criterio GRUPO K, v6.64.0): sin percha previa, la
  // importación NO archiva nada. Sin este control, los asserts de arriba serían
  // igual de compatibles con "se archiva SIEMPRE, exista o no percha previa" —
  // otro bug, no el que este frente corrige.
  it('CONTROL: sin percha previa, no se archiva nada y la percha se crea normalmente', async () => {
    const result = await importOne(metallicSale);
    expect(result).toBe("IMPORTED");

    const quoteSnap = await getDoc(doc(db, "sales", QUOTE_ID));
    expect(quoteSnap.exists()).toBe(true);
    expect(quoteSnap.data()!.status).toBe("QUOTATION");

    const historySnap = await getDocs(collection(db, "sales", QUOTE_ID, "history"));
    expect(historySnap.size).toBe(0);

    const auditSnap = await getDocs(
      query(collection(db, "audit_logs"), where("action", "==", "QUOTATION_REPLACED")),
    );
    expect(auditSnap.size).toBe(0);
  });
});
