import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import {
  setupIntegrationTest,
  clearFirestore,
  cleanupIntegrationTest,
  seedStock
} from './firestore-helpers';
import { getStockStrategy } from '@/core/sales/strategies';
import { classifyNCStockAction, NcStockAction } from '@/utils/importHelpers';
import { doc, getDoc, collection, getDocs, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';
import { runSaleImportTransaction } from '@/core/import/runSaleImportTransaction';

vi.unmock('@/lib/firebase/clientApp');

// [IMPORT-EXTRACT] MIGRADO en v6.89.0 (TANDA 10): este archivo ya NO reimplementa la
// transacción del importador -- la LLAMA. La copia local que vivía acá fue borrada;
// lo que queda es solo el bucle por comprobante, que es lo que hace el call-site real
// (`handleUploadToFirebase`). El `catch` de la copia hacía `console.error` + `throw`,
// o sea que no atrapaba nada: se elimina sin cambio de comportamiento.
//
// La copia borrada decidía la omisión con un `exists()` CIEGO al status; la función
// real ramifica por `status` (COMPLETED -> OMITTED, VOIDED -> reemplazo). Es el punto
// 1 de la divergencia medida en v6.87.0/v6.88.0, y la celda A1xP1 de la matriz: sobre
// un doc ya COMPLETED las dos ramas devuelven "OMITTED", así que el valor observado no
// cambia -- medido, no derivado (ver el mensaje de este commit).
async function importSales(parsedSales: any[]) {
  for (const sale of parsedSales) {
    await runTransaction(db, (tx) => runSaleImportTransaction(tx, { db, sale }));
  }
}

describe('Sales Import Logic (Integration)', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest(null, db);
  });

  beforeEach(async () => {
    await clearFirestore(db);
  });

  it('idempotencia: re-importar la misma factura no duplica ni descuenta stock doble', async () => {
    const sku = 'UPVC-TEST';
    await seedStock(db, 'roofing_stock', sku, { quantity: 100, avgCost: 10 });
    
    const saleData = {
      documentNumber: 'F001-000001',
      documentType: 'FACTURA',
      currency: 'PEN',
      timestamp: new Date('2026-06-05T17:00:00.000Z'),
      adjustedDocument: '',
      customerName: 'Cliente Test',
      items: [{
        sku,
        quantity: 10,
        businessLine: 'roofing',
        isCoil: false,
        baseCost: 10
      }]
    };

    // Primera importación
    await importSales([saleData]);

    const stockSnap1 = await getDoc(doc(db, 'roofing_stock', sku));
    expect(stockSnap1.data()?.quantity).toBe(90);

    // Segunda importación (misma data)
    await importSales([saleData]);

    const stockSnap2 = await getDoc(doc(db, 'roofing_stock', sku));
    expect(stockSnap2.data()?.quantity).toBe(90); // Se mantuvo en 90, NO bajó a 80

    const movesSnap = await getDocs(collection(db, 'roofing_stock_movements'));
    expect(movesSnap.docs).toHaveLength(1); // Solo un movimiento registrado
  });

  it('NC: RETURNS_STOCK mueve stock y peso neto difiere de MONEY_ONLY', async () => {
    const skuSI = 'SKU-SI';
    const skuNO = 'SKU-NO';
    await seedStock(db, 'roofing_stock', skuSI, { quantity: 100, avgCost: 10 });
    await seedStock(db, 'roofing_stock', skuNO, { quantity: 100, avgCost: 10 });

    // RETURNS_STOCK: stock entra → totalWeight = -10 (reversal de salida)
    const saleSI = {
      documentNumber: 'NC-001',
      documentType: 'NOTA CRÉDITO',
      currency: 'PEN',
      timestamp: new Date('2026-06-05T17:00:00.000Z'),
      adjustedDocument: '',
      ncStockAction: 'RETURNS_STOCK' as NcStockAction,
      customerName: 'Cliente SI',
      totalWeight: -10,
      items: [{
        sku: skuSI,
        quantity: 10,
        businessLine: 'roofing',
        isCoil: false,
        baseCost: 10
      }]
    };

    // MONEY_ONLY: sin movimiento de stock → totalWeight = 0
    const saleNO = {
      documentNumber: 'NC-002',
      documentType: 'NOTA CRÉDITO',
      currency: 'PEN',
      timestamp: new Date('2026-06-05T17:00:00.000Z'),
      adjustedDocument: '',
      ncStockAction: 'MONEY_ONLY' as NcStockAction,
      customerName: 'Cliente NO',
      totalWeight: 0,
      items: [{
        sku: skuNO,
        quantity: 10,
        businessLine: 'roofing',
        isCoil: false,
        baseCost: 10
      }]
    };

    await importSales([saleSI, saleNO]);

    const stockSI = await getDoc(doc(db, 'roofing_stock', skuSI));
    const stockNO = await getDoc(doc(db, 'roofing_stock', skuNO));
    const saleSIDoc = await getDoc(doc(db, 'sales', 'NC-001'));
    const saleNODoc = await getDoc(doc(db, 'sales', 'NC-002'));

    // Stock final: RETURNS_STOCK sube, MONEY_ONLY no cambia
    expect(stockSI.data()?.quantity).toBe(110);
    expect(stockNO.data()?.quantity).toBe(100);
    expect(stockSI.data()?.quantity).not.toBe(stockNO.data()?.quantity);

    // Peso neto: ambas ramas producen valores distintos
    expect(saleSIDoc.data()?.totalWeight).toBe(-10);
    expect(saleNODoc.data()?.totalWeight).toBe(0);
    expect(saleSIDoc.data()?.totalWeight).not.toBe(saleNODoc.data()?.totalWeight);
  });

  it('NC Fase 2: SUNAT "Sí" con tilde produce RETURNS_STOCK end-to-end', async () => {
    // Simula el flujo real: AFECTA_STOCK viene del Excel como "Sí" (con tilde, formato SUNAT)
    const sku = 'SKU-SUNAT';
    await seedStock(db, 'roofing_stock', sku, { quantity: 50, avgCost: 15 });

    const ncStockAction = classifyNCStockAction('Sí'); // debe devolver 'RETURNS_STOCK'
    expect(ncStockAction).toBe('RETURNS_STOCK');

    const saleNC = {
      documentNumber: 'NC-SUNAT-001',
      documentType: 'NOTA CRÉDITO',
      currency: 'PEN',
      timestamp: new Date('2026-06-05T17:00:00.000Z'),
      adjustedDocument: 'FFB1-0001',
      ncStockAction,
      customerName: 'Cliente SUNAT',
      totalWeight: -5,
      items: [{
        sku,
        quantity: 5,
        businessLine: 'roofing',
        isCoil: false,
        baseCost: 15
      }]
    };

    await importSales([saleNC]);

    const stockSnap = await getDoc(doc(db, 'roofing_stock', sku));
    // "Sí" → RETURNS_STOCK → stock IN: 50 + 5 = 55
    expect(stockSnap.data()?.quantity).toBe(55);

    const movesSnap = await getDocs(collection(db, 'roofing_stock_movements'));
    const movement = movesSnap.docs.find(d => d.data().sku === sku);
    expect(movement?.data()?.type).toBe('ENTRADA');
    expect(movement?.data()?.quantity).toBe(5);
  });
});
