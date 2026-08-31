import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import {
  setupIntegrationTest,
  clearFirestore,
  cleanupIntegrationTest,
  seedStock,
  setTestUserAdmin
} from './firestore-helpers';
import { getStockStrategy } from '@/core/sales/strategies';
import { doc, getDoc, collection, getDocs, serverTimestamp, runTransaction, query, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/clientApp';
import { runSaleImportTransaction } from '@/core/import/runSaleImportTransaction';

vi.unmock('@/lib/firebase/clientApp');

// [IMPORT-EXTRACT] MIGRADO en v6.89.0 (TANDA 10): este archivo ya NO reimplementa la
// transacción del importador -- la LLAMA. La copia local que vivía acá fue borrada;
// lo que queda es solo el bucle por comprobante, que es lo que hace el call-site real
// (`handleUploadToFirebase`). El `catch` de la copia hacía `console.error` + `throw`,
// o sea que no atrapaba nada: se elimina sin cambio de comportamiento.
async function importSales(parsedSales: any[], user: any) {
  for (const sale of parsedSales) {
    await runTransaction(db, (tx) =>
      runSaleImportTransaction(tx, {
        db,
        sale,
        userUid: user?.uid,
        userEmail: user?.email,
      }),
    );
  }
}

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";

describe('Sales Re-import Logic (Integration)', () => {
  const mockUser = { uid: 'user-123', email: 'test@ayr.com' };

  beforeAll(async () => {
    await setupIntegrationTest();
    try {
      await createUserWithEmailAndPassword(auth, "test-reimport@example.com", "password123");
    } catch (e) {
      await signInWithEmailAndPassword(auth, "test-reimport@example.com", "password123");
    }
    await setTestUserAdmin("test-reimport@example.com");
  });

  afterAll(async () => {
    await cleanupIntegrationTest(null, db);
  });

  beforeEach(async () => {
    await clearFirestore(db);
  });

  it('1. Doble-corrida mismo Excel, doc COMPLETED -> stock baja UNA vez; segunda omite', async () => {
    const sku = 'REIMP-1';
    await seedStock(db, 'roofing_stock', sku, { quantity: 100, avgCost: 10 });
    
    const saleData = {
      documentNumber: 'F001-0001',
      documentType: 'FACTURA',
      status: 'COMPLETED',
      currency: 'PEN',
      timestamp: new Date('2026-06-05T17:00:00.000Z'),
      customerName: 'Cliente 1',
      items: [{ sku, quantity: 10, businessLine: 'roofing', isCoil: false, baseCost: 10 }]
    };

    await importSales([saleData], mockUser);
    const stock1 = (await getDoc(doc(db, 'roofing_stock', sku))).data();
    expect(stock1?.quantity).toBe(90);

    await importSales([saleData], mockUser);
    const stock2 = (await getDoc(doc(db, 'roofing_stock', sku))).data();
    expect(stock2?.quantity).toBe(90); // Omitida
  });

  // SKIP hasta WRITE 9 (salesService Callable). La reimportación SUNAT debe mutar items
  // por backend; firestore.rules §8.4 protege items/totalAmount/igv contra escritura cliente
  // por diseño (DESPLEGADO EN PROD). No debilitar la rule.
  it.skip('2. Importar -> anular -> re-importar corregido -> doc COMPLETED con datos nuevos; history existe; stock OK', async () => {
    const sku = 'REIMP-2';
    await seedStock(db, 'roofing_stock', sku, { quantity: 100, avgCost: 10 });

    const saleV1 = {
      documentNumber: 'F001-0002',
      documentType: 'FACTURA',
      status: 'COMPLETED',
      currency: 'PEN',
      timestamp: new Date('2026-06-05T17:00:00.000Z'),
      customerName: 'Cliente Original',
      items: [{ sku, quantity: 10, businessLine: 'roofing', isCoil: false, baseCost: 10 }]
    };

    // 1. Importar
    await importSales([saleV1], mockUser);
    
    // 2. Anular manualmente (simulado)
    const saleRef = doc(db, 'sales', 'F001-0002');
    await runTransaction(db, async (tx) => {
        const snap = await tx.get(saleRef);
        const strategy = getStockStrategy('roofing');
        const stockRef = strategy.getStockRef(sku);
        const stockSnap = await tx.get(stockRef);
        const currentQty = strategy.extractQuantity(stockSnap);
        
        tx.update(saleRef, { status: 'VOIDED', voidedAt: serverTimestamp() });
        strategy.writeSaleReversal({
            sku, quantity: 10, newBalance: currentQty + 10, saleId: 'F001-0002', customerName: 'Cliente Original', sellerId: 'test'
        }, stockSnap, tx);
    });

    const stockAfterVoid = (await getDoc(doc(db, 'roofing_stock', sku))).data();
    expect(stockAfterVoid?.quantity).toBe(100);

    // 3. Re-importar corregido (cantidad 15)
    const saleV2 = {
      documentNumber: 'F001-0002',
      documentType: 'FACTURA',
      status: 'COMPLETED',
      currency: 'PEN',
      timestamp: new Date('2026-06-05T17:00:00.000Z'),
      customerName: 'Cliente Corregido',
      items: [{ sku, quantity: 15, businessLine: 'roofing', isCoil: false, baseCost: 10 }]
    };
    await importSales([saleV2], mockUser);

    const saleFinal = (await getDoc(saleRef)).data();
    expect(saleFinal?.status).toBe('COMPLETED');
    expect(saleFinal?.customerName).toBe('Cliente Corregido');
    expect(saleFinal?.items[0].quantity).toBe(15);

    const stockFinal = (await getDoc(doc(db, 'roofing_stock', sku))).data();
    expect(stockFinal?.quantity).toBe(85); // 100 - 15

    const historySnap = await getDocs(collection(saleRef, 'history'));
    expect(historySnap.docs).toHaveLength(1);
    expect(historySnap.docs[0].data().customerName).toBe('Cliente Original');
    expect(historySnap.docs[0].data().status).toBe('VOIDED');

    const auditSnap = await getDocs(query(collection(db, 'audit_logs'), where('action', '==', 'SALE_REPLACED')));
    expect(auditSnap.docs).toHaveLength(1);
    expect(auditSnap.docs[0].data().documentNumber).toBe('F001-0002');
  });

  // SKIP hasta WRITE 9 (salesService Callable). La reimportación SUNAT debe mutar items
  // por backend; firestore.rules §8.4 protege items/totalAmount/igv contra escritura cliente
  // por diseño (DESPLEGADO EN PROD). No debilitar la rule.
  it.skip('3. Tres ciclos anular->reimportar sobre el mismo número -> 3 entradas distintas en history', async () => {
    const sku = 'REIMP-3';
    await seedStock(db, 'roofing_stock', sku, { quantity: 1000, avgCost: 10 });
    const saleRef = doc(db, 'sales', 'F001-0003');

    for (let i = 1; i <= 3; i++) {
        // Importar
        await importSales([{
            documentNumber: 'F001-0003',
            documentType: 'FACTURA',
            status: 'COMPLETED',
            currency: 'PEN',
            timestamp: new Date('2026-06-05T17:00:00.000Z'),
            customerName: `Cliente V${i}`,
            items: [{ sku, quantity: 10, businessLine: 'roofing', isCoil: false, baseCost: 10 }]
        }], mockUser);

        // Anular
        await runTransaction(db, async (tx) => {
            const strategy = getStockStrategy('roofing');
            const stockSnap = await tx.get(strategy.getStockRef(sku));
            tx.update(saleRef, { status: 'VOIDED' });
            strategy.writeSaleReversal({
                sku, quantity: 10, newBalance: strategy.extractQuantity(stockSnap) + 10, saleId: 'F001-0003', customerName: `Cliente V${i}`, sellerId: 'test'
            }, stockSnap, tx);
        });
    }

    // Ultima re-importacion para dejarla activa
    await importSales([{
        documentNumber: 'F001-0003',
        documentType: 'FACTURA',
        status: 'COMPLETED',
        currency: 'PEN',
        timestamp: new Date('2026-06-05T17:00:00.000Z'),
        customerName: `Cliente Final`,
        items: [{ sku, quantity: 10, businessLine: 'roofing', isCoil: false, baseCost: 10 }]
    }], mockUser);

    const historySnap = await getDocs(collection(saleRef, 'history'));
    expect(historySnap.docs).toHaveLength(3);
    
    const names = historySnap.docs.map(d => d.data().customerName);
    expect(names).toContain('Cliente V1');
    expect(names).toContain('Cliente V2');
    expect(names).toContain('Cliente V3');
  });

  // SKIP hasta WRITE 9 (salesService Callable). La reimportación SUNAT debe mutar items
  // por backend; firestore.rules §8.4 protege items/totalAmount/igv contra escritura cliente
  // por diseño (DESPLEGADO EN PROD). No debilitar la rule.
  it.skip('4. Re-import de NC anulada respeta ncStockAction al reaplicar', async () => {
    const sku = 'REIMP-4';
    await seedStock(db, 'roofing_stock', sku, { quantity: 100, avgCost: 10 });
    const saleRef = doc(db, 'sales', 'NC-0004');

    // 1. Importar NC (RETURNS_STOCK) -> sube stock a 110
    await importSales([{
        documentNumber: 'NC-0004',
        documentType: 'NOTA CRÉDITO',
        ncStockAction: 'RETURNS_STOCK',
        status: 'COMPLETED',
        currency: 'PEN',
        timestamp: new Date('2026-06-05T17:00:00.000Z'),
        customerName: 'NC V1',
        items: [{ sku, quantity: 10, businessLine: 'roofing', isCoil: false, baseCost: 10 }]
    }], mockUser);
    expect((await getDoc(doc(db, 'roofing_stock', sku))).data()?.quantity).toBe(110);

    // 2. Anular NC -> baja stock a 100
    await runTransaction(db, async (tx) => {
        const strategy = getStockStrategy('roofing');
        const stockSnap = await tx.get(strategy.getStockRef(sku));
        tx.update(saleRef, { status: 'VOIDED' });
        // Reversal de una NC que devolvió stock es quitarlo
        strategy.writeSaleDecrement({
            sku, quantity: 10, newBalance: strategy.extractQuantity(stockSnap) - 10, saleId: 'NC-0004', customerName: 'NC V1', sellerId: 'test'
        }, stockSnap, tx);
    });
    expect((await getDoc(doc(db, 'roofing_stock', sku))).data()?.quantity).toBe(100);

    // 3. Re-importar NC (MONEY_ONLY) -> stock queda en 100
    await importSales([{
        documentNumber: 'NC-0004',
        documentType: 'NOTA CRÉDITO',
        ncStockAction: 'MONEY_ONLY',
        status: 'COMPLETED',
        currency: 'PEN',
        timestamp: new Date('2026-06-05T17:00:00.000Z'),
        customerName: 'NC V2',
        items: [{ sku, quantity: 10, businessLine: 'roofing', isCoil: false, baseCost: 10 }]
    }], mockUser);
    expect((await getDoc(doc(db, 'roofing_stock', sku))).data()?.quantity).toBe(100);

    // 4. Anular y re-importar NC (RETURNS_STOCK) -> stock queda en 110
    await runTransaction(db, async (tx) => {
        tx.update(saleRef, { status: 'VOIDED' });
        // No movemos stock aquí porque era MONEY_ONLY (simulado)
    });

    await importSales([{
        documentNumber: 'NC-0004',
        documentType: 'NOTA CRÉDITO',
        ncStockAction: 'RETURNS_STOCK',
        status: 'COMPLETED',
        currency: 'PEN',
        timestamp: new Date('2026-06-05T17:00:00.000Z'),
        customerName: 'NC V3',
        items: [{ sku, quantity: 10, businessLine: 'roofing', isCoil: false, baseCost: 10 }]
    }], mockUser);
    expect((await getDoc(doc(db, 'roofing_stock', sku))).data()?.quantity).toBe(110);
  });
});
