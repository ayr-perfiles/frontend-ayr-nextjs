import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getStockStrategy, 
  drywallStockStrategy, 
  roofingStockStrategy, 
  metallicRoofingStockStrategy,
  tradingStockStrategy,
  servicesStockStrategy 
} from './index';

// Mocks
vi.mock('@/lib/firebase/clientApp', () => ({
  db: { type: 'mock-db' }
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: any[]) => {
    // Overload 1: doc(db, coll, id)
    if (args.length === 3) return { coll: args[1], id: args[2] };
    // Overload 2: doc(collRef)
    if (args.length === 1) return { coll: args[0].coll, id: 'GEN-ID' };
    return { coll: 'unknown', id: 'unknown' };
  }),
  collection: vi.fn((_db, coll) => ({ coll })),
  serverTimestamp: vi.fn(() => 'MOCKED_TIMESTAMP'),
}));

describe('getStockStrategy', () => {
  it('retorna la estrategia correcta para cada línea', () => {
    expect(getStockStrategy('drywall')).toBe(drywallStockStrategy);
    expect(getStockStrategy('roofing')).toBe(roofingStockStrategy);
    expect(getStockStrategy('metallic-roofing')).toBe(metallicRoofingStockStrategy);
    expect(getStockStrategy('trading')).toBe(tradingStockStrategy);
    expect(getStockStrategy('services')).toBe(servicesStockStrategy);
  });

  it('lanza error para líneas no soportadas', () => {
    expect(() => getStockStrategy('invalid')).toThrow(/no soportada/i);
  });
});

describe('drywallStockStrategy', () => {
  const mockTx = {
    update: vi.fn(),
    set: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writeSaleDecrement: usa tx.update si el snap existe', () => {
    const snap = { exists: () => true, data: () => ({ totalQuantity: 10 }) };
    const params = {
      sku: 'P38',
      quantity: 2,
      newBalance: 8,
      saleId: 'SALE-1',
      customerName: 'Cliente A',
      sellerId: 'user-1'
    };

    drywallStockStrategy.writeSaleDecrement(params, snap as any, mockTx as any);

    expect(mockTx.update).toHaveBeenCalledWith(
      expect.objectContaining({ coll: 'inventory_stock', id: 'P38' }),
      expect.objectContaining({ totalQuantity: 8 })
    );
    // Verificar movimiento
    expect(mockTx.set).toHaveBeenCalledWith(
      expect.objectContaining({ coll: 'kardex_movements' }),
      expect.objectContaining({ type: 'OUT', quantity: 2, balance: 8 })
    );
  });

  it('writeSaleDecrement: usa tx.set si el snap no existe', () => {
    const snap = { exists: () => false };
    const params = {
      sku: 'P38',
      quantity: 2,
      newBalance: -2,
      saleId: 'SALE-1',
      customerName: 'Cliente A',
      sellerId: 'user-1'
    };

    drywallStockStrategy.writeSaleDecrement(params, snap as any, mockTx as any);

    expect(mockTx.set).toHaveBeenCalledWith(
      expect.objectContaining({ coll: 'inventory_stock', id: 'P38' }),
      expect.objectContaining({ totalQuantity: -2 })
    );
  });
});

describe('roofingStockStrategy', () => {
  const mockTx = {
    update: vi.fn(),
    set: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writeSaleDecrement: actualiza stock y registra movimiento en roofing_stock', () => {
    const snap = { exists: () => true, data: () => ({ quantity: 10, avgCost: 50 }) };
    const params = {
      sku: 'UPVC6MT',
      quantity: 2,
      newBalance: 8,
      saleId: 'SALE-1',
      customerName: 'Cliente A',
      sellerId: 'user-1'
    };

    roofingStockStrategy.writeSaleDecrement(params, snap as any, mockTx as any);

    expect(mockTx.update).toHaveBeenCalledWith(
      expect.objectContaining({ coll: 'roofing_stock', id: 'UPVC6MT' }),
      expect.objectContaining({ quantity: 8, totalValue: 400 }) // 8 * 50
    );
    expect(mockTx.set).toHaveBeenCalledWith(
      expect.objectContaining({ coll: 'roofing_stock_movements' }),
      expect.objectContaining({ type: 'SALIDA', quantity: 2, costPerUnit: 50 })
    );
  });
});

describe('tradingStockStrategy', () => {
  const mockTx = {
    update: vi.fn(),
    set: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writeProductionIncrement: incrementa stock y promedia costos', () => {
    const snap = { exists: () => true, data: () => ({ quantity: 10, avgCost: 100 }) };
    const params = {
      sku: 'TUBO-01',
      quantity: 5,
      newBalance: 15,
      newAverageCost: 110,
      reference: 'PO-001',
      operatorId: 'admin-1',
      description: 'Compra'
    };

    tradingStockStrategy.writeProductionIncrement(params, snap as any, mockTx as any);

    expect(mockTx.set).toHaveBeenCalledWith(
      expect.objectContaining({ coll: 'trading_stock', id: 'TUBO-01' }),
      expect.objectContaining({ quantity: 15, avgCost: 110, totalValue: 1650 }),
      { merge: true }
    );
    expect(mockTx.set).toHaveBeenCalledWith(
      expect.objectContaining({ coll: 'trading_stock_movements' }),
      expect.objectContaining({ type: 'ENTRADA', quantity: 5, costPerUnit: 110 })
    );
  });
});

describe('servicesStockStrategy (NO-OP)', () => {
  const mockTx = {
    update: vi.fn(),
    set: vi.fn(),
  };

  it('no realiza escrituras en decrement ni reversal', () => {
    servicesStockStrategy.writeSaleDecrement({} as any, null, mockTx as any);
    servicesStockStrategy.writeSaleReversal({} as any, null, mockTx as any);
    
    expect(mockTx.update).not.toHaveBeenCalled();
    expect(mockTx.set).not.toHaveBeenCalled();
  });

  it('extractQuantity retorna Infinity', () => {
    expect(servicesStockStrategy.extractQuantity({} as any)).toBe(Infinity);
  });
});

/**
 * TODO Fase 2 (Requiere Emulador):
 * - Verificar que runTransaction envuelve correctamente las llamadas.
 * - Probar concurrencia con múltiples ventas al mismo SKU.
 * - Validar que los timestamps de Firestore se graban correctamente.
 */
