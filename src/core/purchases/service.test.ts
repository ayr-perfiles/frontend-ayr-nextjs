import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerPurchase, voidPurchase } from './service';
import { db, auth } from '@/lib/firebase/clientApp';
import { runTransaction, getDocs, doc } from 'firebase/firestore';

vi.mock('@/lib/firebase/clientApp', () => ({
  db: { type: 'mock-db' },
  auth: { currentUser: { email: 'test@example.com' } },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, coll) => ({ coll })),
  doc: vi.fn((...args: any[]) => {
    if (args.length === 3) return { coll: args[1], id: args[2], ref: 'doc-ref' };
    if (args.length === 1) return { coll: args[0].coll, id: 'GEN-ID', ref: 'doc-ref' };
    return { coll: 'unknown', id: 'unknown', ref: 'doc-ref' };
  }),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ type: 'timestamp' })),
  Timestamp: { fromDate: vi.fn((d) => d) },
  limit: vi.fn(),
}));

describe('Purchase Service (Unit Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerPurchase', () => {
    const validBaseInput = {
      supplier: { ruc: '20123456789', name: 'Test Supplier' },
      businessLine: 'trading',
      invoice: {
        number: 'F001-001',
        date: new Date(),
        currency: 'USD',
        exchangeRate: 3.8,
        gravada: 100,
        igv: 18,
        total: 118,
      },
      items: [
        { sku: 'SKU1', productName: 'Prod 1', quantity: 10, unitCostCurrency: 10, unitCostPEN: 38 }
      ],
      totalCostPEN: 380,
    };

    it('debe omitir el registro si ya existe la factura (idempotencia)', async () => {
      (getDocs as any).mockResolvedValue({
        empty: false,
        docs: [{ id: 'existing-id' }]
      });

      const result = await registerPurchase(validBaseInput as any);
      
      expect(result).toBe('existing-id');
      expect(runTransaction).not.toHaveBeenCalled();
    });

    it('debe fallar si la línea de negocio no es soportada', async () => {
      (getDocs as any).mockResolvedValue({ empty: true });
      const input = { ...validBaseInput, businessLine: 'invalid' };

      await expect(registerPurchase(input as any)).rejects.toThrow(/Invalid option/i);
    });

    it('debe calcular correctamente el nuevo costo promedio (WAC)', async () => {
      (getDocs as any).mockResolvedValue({ empty: true });
      
      let capturedTransaction: any;
      (runTransaction as any).mockImplementation(async (_db: any, callback: any) => {
        capturedTransaction = {
          get: vi.fn().mockImplementation((ref: any) => {
            if (ref.coll === 'trading_stock') {
              return {
                exists: () => true,
                data: () => ({ quantity: 100, avgCost: 50 }) // 100 * 50 = 5000
              };
            }
            if (ref.coll === 'trading_catalog') {
              return {
                exists: () => true,
                data: () => ({ displayName: 'Prod 1' })
              };
            }
            return { exists: () => false };
          }),
          set: vi.fn(),
          update: vi.fn(),
        };
        return await callback(capturedTransaction);
      });

      // Nueva compra: 50 unidades a 80 PEN cada una (50 * 80 = 4000)
      // Total anterior: 5000, Total nuevo: 4000. Suma: 9000. Qty: 150. Avg: 9000/150 = 60.
      const input = {
        ...validBaseInput,
        items: [{ sku: 'SKU1', productName: 'Prod 1', quantity: 50, unitCostCurrency: 80, unitCostPEN: 80 }]
      };

      await registerPurchase(input as any);

      expect(capturedTransaction.set).toHaveBeenCalledWith(
        expect.objectContaining({ coll: 'trading_stock', id: 'SKU1' }),
        expect.objectContaining({
          quantity: 150,
          avgCost: 60,
          totalValue: 9000
        })
      );
    });
  });

  describe('voidPurchase', () => {
    it('debe fallar si la compra ya está anulada', async () => {
      (runTransaction as any).mockImplementation(async (_db: any, callback: any) => {
        const mockTx = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({ status: 'ANULADA' })
          }),
        };
        return await callback(mockTx);
      });

      await expect(voidPurchase('id', 'razon')).rejects.toThrow(/ya está anulada/);
    });

    it('debe fallar si el stock actual es menor a lo comprado (STOCK_ALREADY_SOLD)', async () => {
      (runTransaction as any).mockImplementation(async (_db: any, callback: any) => {
        const mockTx = {
          get: vi.fn().mockImplementation((ref: any) => {
            if (ref.coll === 'purchases') {
              return {
                exists: () => true,
                data: () => ({
                  status: 'REGISTRADA',
                  businessLine: 'trading',
                  items: [{ sku: 'SKU1', quantity: 10, unitCostPEN: 50 }]
                })
              };
            }
            if (ref.coll === 'trading_stock') {
              return {
                exists: () => true,
                data: () => ({ quantity: 5 }) // Solo quedan 5, se compraron 10
              };
            }
            return { exists: () => false };
          }),
        };
        return await callback(mockTx);
      });

      try {
        await voidPurchase('id', 'razon');
        expect.fail('Debería haber lanzado error');
      } catch (error: any) {
        expect(error.message).toMatch(/parte ya se vendió/);
        expect(error.code).toBe('STOCK_ALREADY_SOLD');
      }
    });
  });
});
