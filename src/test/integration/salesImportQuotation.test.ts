import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import {
  setupIntegrationTest,
  clearFirestore,
  cleanupIntegrationTest
} from './firestore-helpers';
import { doc, getDoc, collection, getDocs, runTransaction, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';
import { buildImportWrites } from '@/core/import/salesImportLogic';

vi.unmock('@/lib/firebase/clientApp');

// Simulación exacta de la función de importación masiva (SalesImportPage handleUploadToFirebase)
// [IMPORT-SIM-DRIFT] A diferencia de salesImport.test.ts/salesReimport.test.ts, esta
// función SÍ delega en buildImportWrites (el builder real) para venta+percha -- pero
// sigue sin llamar a la transacción del importador entera. Extraerla está registrado
// como frente [IMPORT-EXTRACT]. La AUSENCIA de movimiento de stock acá es alcance
// intencional (este archivo prueba solo la atomicidad venta+percha), no un olvido.
async function simulateImportWithLogic(parsedSales: any[]) {
  const results: any[] = [];
  for (const sale of parsedSales) {
    try {
      const result = await runTransaction(db, async (tx) => {
        const saleRef = doc(db, "sales", sale.documentNumber);
        const existingSaleSnap = await tx.get(saleRef);
        let isReplacement = false;

        if (existingSaleSnap.exists()) {
          const existingData = existingSaleSnap.data();
          if (existingData.status === "COMPLETED") {
            return "OMITTED";
          } else if (existingData.status === "VOIDED") {
            isReplacement = true;
          } else {
            return "OMITTED";
          }
        }

        const saleInputWithMeta = {
          ...sale,
          metadata: {
            isReplacement,
            uploadedBy: "test@example.com",
          },
        };

        const { saleDoc, quotationDoc } = buildImportWrites(saleInputWithMeta, serverTimestamp());
        tx.set(saleRef, saleDoc);
        if (quotationDoc) {
          const quoteRef = doc(db, "sales", `COT-${sale.documentNumber}`);
          tx.set(quoteRef, quotationDoc);
        }


        return isReplacement ? "REPLACED" : "IMPORTED";
      });
      results.push({ documentNumber: sale.documentNumber, status: result });
    } catch (err: any) {
      results.push({ documentNumber: sale.documentNumber, status: 'ERROR', message: err.message });
    }
  }
  return results;
}

describe('Importador Sales + Quotation Integration (RED PHASE)', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest();
  });

  beforeEach(async () => {
    await clearFirestore();
  });

  const metallicSale = {
    documentNumber: "FFA1-1262",
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

  // 13. Atomicidad de Transacción: Escribe AMBOS docs o ninguno si la transacción falla
  it("13. Transacción atómica escribe AMBOS docs (venta y cotización) o ninguno si falla", async () => {
    // A. Éxito normal: escribe AMBOS docs
    await simulateImportWithLogic([metallicSale]);

    const saleSnap = await getDoc(doc(db, "sales", "FFA1-1262"));
    const quoteSnap = await getDoc(doc(db, "sales", "COT-FFA1-1262"));

    expect(saleSnap.exists()).toBe(true);
    expect(quoteSnap.exists()).toBe(true);

    // B. Fallo simulado: si la transacción lanza un error tras tx.set, se abortan AMBOS docs
    await clearFirestore();

    try {
      await runTransaction(db, async (tx) => {
        const saleRef = doc(db, "sales", "FFA1-FAIL");
        const quoteRef = doc(db, "sales", "COT-FFA1-FAIL");
        tx.set(saleRef, { status: "COMPLETED" });
        tx.set(quoteRef, { status: "QUOTATION" });
        throw new Error("ERROR_SIMULADO_DENTRO_DE_TRANSACCION");
      });
    } catch (e: any) {
      expect(e.message).toBe("ERROR_SIMULADO_DENTRO_DE_TRANSACCION");
    }

    const failSaleSnap = await getDoc(doc(db, "sales", "FFA1-FAIL"));
    const failQuoteSnap = await getDoc(doc(db, "sales", "COT-FFA1-FAIL"));

    expect(failSaleSnap.exists()).toBe(false);
    expect(failQuoteSnap.exists()).toBe(false);
  });


  // 14. Idempotencia re-import: correr el mismo import 2 veces -> ambos ids pisados, no duplicados
  it("14. Idempotencia re-import: reimportar la misma venta sobreescribe ambos docs y no duplica", async () => {
    await simulateImportWithLogic([metallicSale]);
    await simulateImportWithLogic([metallicSale]);

    const salesSnap = await getDocs(collection(db, "sales"));
    const quoteSnap = await getDoc(doc(db, "sales", "COT-FFA1-1262"));

    // Esperados: 2 documentos en total (FFA1-1262 y COT-FFA1-1262).
    // En FASE RED solo existe 1 (FFA1-1262). FAILS IN RED!
    expect(salesSnap.size).toBe(2);
    expect(quoteSnap.exists()).toBe(true);
  });

  // 15. settings/general_settings.nextQuotationNumber ANTES === DESPUÉS (el importador NO toca el contador)
  it("15. settings/general_settings.nextQuotationNumber no se modifica durante la importación", async () => {
    const settingsRef = doc(db, "settings", "general_settings");
    await setDoc(settingsRef, { nextQuotationNumber: 42 });

    await simulateImportWithLogic([metallicSale]);

    const settingsPostSnap = await getDoc(settingsRef);
    const quoteSnap = await getDoc(doc(db, "sales", "COT-FFA1-1262"));

    expect(settingsPostSnap.data()?.nextQuotationNumber).toBe(42);
    expect(quoteSnap.exists()).toBe(true); // FAILS IN RED!
  });

  // 16. Timestamp de cotización importada hereda la fecha histórica de la venta y NO la fecha de hoy
  it("16. quoteDoc.timestamp hereda la fecha histórica de la venta y NO la fecha de hoy (serverTimestamp)", async () => {
    const historicalDate = new Date("2026-06-04T17:00:00.000Z");
    const testSale = { ...metallicSale, timestamp: historicalDate };

    await simulateImportWithLogic([testSale]);

    const saleSnap = await getDoc(doc(db, "sales", "FFA1-1262"));
    const quoteSnap = await getDoc(doc(db, "sales", "COT-FFA1-1262"));

    const saleData = saleSnap.data()!;
    const quoteData = quoteSnap.data()!;

    const saleTsDate = saleData.timestamp?.toDate ? saleData.timestamp.toDate() : new Date(saleData.timestamp);
    const quoteTsDate = quoteData.timestamp?.toDate ? quoteData.timestamp.toDate() : new Date(quoteData.timestamp);

    // 1. Ambas fechas de negocio deben coincidir con la fecha histórica
    expect(quoteTsDate.toISOString()).toBe(historicalDate.toISOString()); // FAILS IN RED! Expected 2026-06-04..., Received current timestamp
    expect(saleTsDate.toISOString()).toBe(historicalDate.toISOString());

    // 2. quoteDoc.timestamp NO debe estar dentro de los últimos 60 segundos (anti-hoy)
    const nowMs = Date.now();
    const quoteMs = quoteTsDate.getTime();
    expect(nowMs - quoteMs).toBeGreaterThan(60000); // FAILS IN RED! Expected > 60000, Received < 1000

    // 3. uploadedAt SÍ es la fecha de la importación (ahora)
    expect(quoteData.uploadedAt).toBeDefined();
  });

  // 17. Integración emulador: importar y leer los docs ESCRITOS -> assert que NINGUNO tiene campo 'id' en Firestore
  it("17. Docs ESCRITOS en Firestore (venta y cotización) NO contienen la propiedad 'id' en la data", async () => {
    await simulateImportWithLogic([metallicSale]);

    const saleSnap = await getDoc(doc(db, "sales", "FFA1-1262"));
    const quoteSnap = await getDoc(doc(db, "sales", "COT-FFA1-1262"));

    const saleData = saleSnap.data()!;
    const quoteData = quoteSnap.data()!;

    expect(saleData).not.toHaveProperty("id"); // FAILS IN RED!
    expect(quoteData).not.toHaveProperty("id"); // FAILS IN RED!
  });
});

