import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { 
  setupIntegrationTest, 
  clearFirestore, 
  cleanupIntegrationTest,
  seedStock
} from './firestore-helpers';
import { registerPurchase, voidPurchase } from '@/core/purchases/service';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';

vi.unmock('@/lib/firebase/clientApp');

describe('Purchases Module (Integration)', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest(null, db);
  });

  beforeEach(async () => {
    await clearFirestore(db);
    // Seed catalog items
    await seedStock(db, 'roofing_catalog', 'UPVC6MT', { displayName: 'PVC 6M' });
    await seedStock(db, 'trading_catalog', 'ACC-01', { displayName: 'Accesorio' });
  });

  it('registerPurchase: actualiza stock y avgCost (WAC) para PVC', async () => {
    const purchaseInput = {
      supplier: { ruc: '20100200300', name: 'Supplier SAC' },
      businessLine: 'roofing',
      invoice: {
        number: 'F001-0001',
        date: new Date(),
        currency: 'PEN' as const,
        exchangeRate: 1,
        gravada: 1000,
        igv: 180,
        total: 1180,
      },
      items: [
        { 
          sku: 'UPVC6MT', 
          productName: 'PVC 6M', 
          quantity: 10, 
          unitCostCurrency: 100, 
          unitCostPEN: 100 
        }
      ],
      totalCostPEN: 1000,
    };

    const id = await registerPurchase(purchaseInput as any);
    expect(id).toBeDefined();

    // Verificar stock
    const stockSnap = await getDoc(doc(db, 'roofing_stock', 'UPVC6MT'));
    expect(stockSnap.exists()).toBe(true);
    const stock = stockSnap.data() as any;
    expect(stock.quantity).toBe(10);
    expect(stock.avgCost).toBe(100);
    expect(stock.totalValue).toBe(1000);

    // Segunda compra (WAC)
    const purchase2 = {
      ...purchaseInput,
      invoice: { ...purchaseInput.invoice, number: 'F001-0002' },
      items: [{ ...purchaseInput.items[0], quantity: 10, unitCostPEN: 120 }]
    };
    await registerPurchase(purchase2 as any);

    const stockSnap2 = await getDoc(doc(db, 'roofing_stock', 'UPVC6MT'));
    const stock2 = stockSnap2.data() as any;
    expect(stock2.quantity).toBe(20);
    // (10*100 + 10*120) / 20 = 110
    expect(stock2.avgCost).toBe(110);
    expect(stock2.totalValue).toBe(2200);

    // Movimientos
    const movesSnap = await getDocs(collection(db, 'roofing_stock_movements'));
    expect(movesSnap.docs).toHaveLength(2);
    expect(movesSnap.docs[0].data().type).toBe('ENTRADA');
  });

  it('registerPurchase: es idempotente por RUC + Factura', async () => {
    const purchaseInput = {
      supplier: { ruc: '20100200300', name: 'Supplier SAC' },
      businessLine: 'roofing',
      invoice: {
        number: 'F001-9999',
        date: new Date(),
        currency: 'PEN' as const,
        exchangeRate: 1,
        gravada: 500,
        igv: 90,
        total: 590,
      },
      items: [{ sku: 'UPVC6MT', productName: 'PVC 6M', quantity: 5, unitCostCurrency: 100, unitCostPEN: 100 }],
      totalCostPEN: 500,
    };

    const id1 = await registerPurchase(purchaseInput as any);
    const id2 = await registerPurchase(purchaseInput as any);

    expect(id1).toBe(id2);

    const stockSnap = await getDoc(doc(db, 'roofing_stock', 'UPVC6MT'));
    expect(stockSnap.data()?.quantity).toBe(5); // No sumó doble
  });

  it('voidPurchase: revierte stock y marca como ANULADA', async () => {
    const purchaseInput = {
      supplier: { ruc: '20100200300', name: 'Supplier SAC' },
      businessLine: 'roofing',
      invoice: {
        number: 'F001-5555',
        date: new Date(),
        currency: 'PEN' as const,
        exchangeRate: 1,
        gravada: 1000,
        igv: 180,
        total: 1180,
      },
      items: [{ sku: 'UPVC6MT', productName: 'PVC 6M', quantity: 10, unitCostCurrency: 100, unitCostPEN: 100 }],
      totalCostPEN: 1000,
    };

    const id = await registerPurchase(purchaseInput as any);
    await voidPurchase(id, 'Error de digitación');

    const purchaseSnap = await getDoc(doc(db, 'purchases', id));
    expect(purchaseSnap.data()?.status).toBe('ANULADA');

    const stockSnap = await getDoc(doc(db, 'roofing_stock', 'UPVC6MT'));
    expect(stockSnap.data()?.quantity).toBe(0);

    const auditSnap = await getDocs(query(collection(db, 'audit_logs'), where('action', '==', 'VOID_PURCHASE')));
    expect(auditSnap.docs).toHaveLength(1);
  });

  it('voidPurchase: falla si parte del stock ya fue vendido', async () => {
    const purchaseInput = {
      supplier: { ruc: '20100200300', name: 'Supplier SAC' },
      businessLine: 'roofing',
      invoice: {
        number: 'F001-4444',
        date: new Date(),
        currency: 'PEN' as const,
        exchangeRate: 1,
        gravada: 1000,
        igv: 180,
        total: 1180,
      },
      items: [{ sku: 'UPVC6MT', productName: 'PVC 6M', quantity: 10, unitCostCurrency: 100, unitCostPEN: 100 }],
      totalCostPEN: 1000,
    };

    const id = await registerPurchase(purchaseInput as any);

    // Simular venta: bajar stock manualmente
    await seedStock(db, 'roofing_stock', 'UPVC6MT', { quantity: 5 });

    await expect(voidPurchase(id, 'Anular')).rejects.toThrow(/parte ya se vendió/);
    
    const purchaseSnap = await getDoc(doc(db, 'purchases', id));
    expect(purchaseSnap.data()?.status).toBe('REGISTRADA'); // Sigue activa
  });
});
