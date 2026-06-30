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
import { doc, getDoc, collection, getDocs, writeBatch, serverTimestamp, query, where, runTransaction, DocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';

vi.unmock('@/lib/firebase/clientApp');

// Simulación de la función de importación masiva (BulkUploadSales.tsx)
// con la lógica de idempotencia y NC real.
async function simulateImport(parsedSales: any[]) {
  let importedCount = 0;
  const omittedIds: string[] = [];

  for (const sale of parsedSales) {
    try {
      const result = await runTransaction(db, async (tx) => {
        const saleRef = doc(db, "sales", sale.documentNumber);
        
        // a. LECTURA 1: Verificar existencia de la venta
        const existingSaleSnap = await tx.get(saleRef);
        if (existingSaleSnap.exists()) {
          return "OMITTED";
        }

        // b. LECTURAS DE STOCK: Agrupar referencias únicas para cumplir la regla read-before-write
        const stockRefsToRead = new Map<string, any>();
        for (const item of sale.items) {
          if (item.sku && item.sku !== "GENERIC" && !item.isCoil) {
            const strategy = getStockStrategy(item.businessLine);
            const stockRef = strategy.getStockRef(item.sku);
            stockRefsToRead.set(stockRef.path, { ref: stockRef, strategy, sku: item.sku });
          }
        }

        const stockSnaps = new Map<string, DocumentSnapshot>();
        for (const [path, info] of Array.from(stockRefsToRead.entries())) {
           const snap = await tx.get(info.ref);
           stockSnaps.set(path, snap as DocumentSnapshot);
        }

        // c. ESCRITURAS: Crear venta
        const skusArray = Array.from(new Set(sale.items.map((i: any) => i.sku)));
        tx.set(saleRef, {
          ...sale,
          skus: skusArray,
          uploadedAt: serverTimestamp(),
          metadata: { 
            isHistorical: true, 
            documentType: sale.documentType,
            adjustedDocument: sale.adjustedDocument,
          },
        });

        // d. ESCRITURAS DE STOCK
        for (const item of sale.items) {
          if (item.sku && item.sku !== "GENERIC" && !item.isCoil) {
            const strategy = getStockStrategy(item.businessLine);
            const stockRef = strategy.getStockRef(item.sku);
            const stockSnap = stockSnaps.get(stockRef.path)!;
            
            const currentQty = strategy.extractQuantity(stockSnap);
            
            const isNCWithStock = sale.documentType === 'NOTA CRÉDITO' && sale.ncStockAction === 'RETURNS_STOCK';
            const shouldMoveStock = (sale.documentType === 'FACTURA' || sale.documentType === 'BOLETA') || isNCWithStock;
            
            if (shouldMoveStock) {
              const newBalance = isNCWithStock ? currentQty + item.quantity : currentQty - item.quantity;
              const writeParams = {
                sku: item.sku,
                quantity: item.quantity,
                newBalance,
                saleId: sale.documentNumber,
                customerName: sale.customerName,
                sellerId: sale.sellerId || 'SISTEMA',
                avgCost: item.baseCost,
                motivo: isNCWithStock ? `NC ${sale.documentNumber}` : undefined,
                ref: (sale.adjustedDocument as string) || undefined,
              };

              if (isNCWithStock) {
                strategy.writeSaleReversal(writeParams, stockSnap, tx);
              } else {
                strategy.writeSaleDecrement(writeParams, stockSnap, tx);
              }
            }
          }
        }
        
        return "IMPORTED";
      });

      if (result === "OMITTED") {
        omittedIds.push(sale.documentNumber);
      } else {
        importedCount++;
      }
    } catch (txError) {
      console.error(`Error transaccional en venta ${sale.documentNumber}:`, txError);
    }
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
    await simulateImport([saleData]);

    const stockSnap1 = await getDoc(doc(db, 'roofing_stock', sku));
    expect(stockSnap1.data()?.quantity).toBe(90);

    // Segunda importación (misma data)
    await simulateImport([saleData]);

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

    await simulateImport([saleSI, saleNO]);

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

    await simulateImport([saleNC]);

    const stockSnap = await getDoc(doc(db, 'roofing_stock', sku));
    // "Sí" → RETURNS_STOCK → stock IN: 50 + 5 = 55
    expect(stockSnap.data()?.quantity).toBe(55);

    const movesSnap = await getDocs(collection(db, 'roofing_stock_movements'));
    const movement = movesSnap.docs.find(d => d.data().sku === sku);
    expect(movement?.data()?.type).toBe('ENTRADA');
    expect(movement?.data()?.quantity).toBe(5);
  });
});
