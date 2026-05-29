import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { 
  setupIntegrationTest, 
  clearFirestore, 
  cleanupIntegrationTest, 
  seedStock
} from './firestore-helpers';
import { getStockStrategy } from '@/core/sales/strategies';
import { doc, getDoc, runTransaction, collection, getDocs } from 'firebase/firestore';

vi.unmock('@/lib/firebase/clientApp');

describe('Sales Strategies (Integration)', () => {
  let testApp: any;
  let testDb: any;

  beforeAll(async () => {
    const { app, db } = await setupIntegrationTest();
    testApp = app;
    testDb = db;
    process.env.NODE_ENV = 'development';
  });

  afterAll(async () => {
    await cleanupIntegrationTest(testApp, testDb);
    process.env.NODE_ENV = 'test';
  });

  beforeEach(async () => {
    await clearFirestore();
  });

  it('Drywall Strategy: descuenta stock y registra movimiento en transaccion', async () => {
    const sku = 'P38GALV';
    await seedStock(testDb, 'inventory_stock', sku, { totalQuantity: 100 });
    const strategy = getStockStrategy('drywall');
    
    await runTransaction(testDb, async (transaction) => {
      const stockRef = strategy.getStockRef(sku);
      const snap = await transaction.get(stockRef);
      const currentQty = strategy.extractQuantity(snap);
      
      strategy.writeSaleDecrement({
        sku,
        quantity: 10,
        newBalance: currentQty - 10,
        saleId: 'SALE-DRY',
        customerName: 'Cliente Drywall',
        sellerId: 'user-1'
      }, snap, transaction);
    });

    const stockSnap = await getDoc(strategy.getStockRef(sku));
    expect(stockSnap.data()?.totalQuantity).toBe(90);

    const movesSnap = await getDocs(collection(testDb, 'kardex_movements'));
    expect(movesSnap.docs).toHaveLength(1);
    expect(movesSnap.docs[0].data()).toMatchObject({
      type: 'OUT',
      quantity: 10,
      balance: 90,
      reference: 'SALE-DRY'
    });
  });

  it('Roofing Strategy: actualiza cantidad y totalValue', async () => {
    const sku = 'UPVC-6';
    await seedStock(testDb, 'roofing_stock', sku, { 
      quantity: 50, 
      avgCost: 20, 
      totalValue: 1000,
      productName: 'PVC 6MT' 
    });
    const strategy = getStockStrategy('roofing');

    await runTransaction(testDb, async (transaction) => {
      const stockRef = strategy.getStockRef(sku);
      const snap = await transaction.get(stockRef);
      
      strategy.writeSaleDecrement({
        sku,
        quantity: 5,
        newBalance: 45,
        saleId: 'SALE-ROOF',
        customerName: 'Cliente PVC',
        sellerId: 'user-1'
      }, snap, transaction);
    });

    const stockSnap = await getDoc(strategy.getStockRef(sku));
    expect(stockSnap.data()?.quantity).toBe(45);
    expect(stockSnap.data()?.totalValue).toBe(900); // 45 * 20

    const movesSnap = await getDocs(collection(testDb, 'roofing_stock_movements'));
    expect(movesSnap.docs).toHaveLength(1);
    expect(movesSnap.docs[0].data()).toMatchObject({ type: 'SALIDA', quantity: 5 });
  });

  it('Services Strategy: NO-OP, no escribe nada', async () => {
    const strategy = getStockStrategy('services');
    const sku = 'CONFORMADO';

    await runTransaction(testDb, async (transaction) => {
      const stockRef = strategy.getStockRef(sku);
      const snap = await transaction.get(stockRef);
      
      strategy.writeSaleDecrement({
        sku,
        quantity: 10,
        newBalance: 0, // no importa
        saleId: 'SALE-SERV',
        customerName: 'Cliente Serv',
        sellerId: 'user-1'
      }, snap, transaction);
    });

    // Verificar que no se creó la colección dummy ni movimientos
    const movesSnap = await getDocs(collection(testDb, 'services_stock_movements'));
    expect(movesSnap.docs).toHaveLength(0);
  });
});
