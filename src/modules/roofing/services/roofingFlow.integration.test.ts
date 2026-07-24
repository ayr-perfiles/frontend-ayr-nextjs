/**
 * Integration tests — módulo Roofing PVC
 *
 * Qué se prueba aquí:
 *   1. Flujo completo: crear producto → ajustar stock → vender
 *   2. Stock negativo después de una venta sin stock (ADR-005)
 *   3. Cálculo correcto del costo promedio ponderado
 *   4. Audit logs generados en cada paso del flujo
 *   5. RBAC: SUPERVISOR no puede crear productos (Firestore rechaza la escritura)
 *
 * Estrategia de mock:
 *   - firebase/firestore se reemplaza por un MemStore en memoria.
 *   - Los servicios reales (catalogService, stockAdjustmentService, salesService)
 *     corren sin modificaciones; sólo el adaptador Firestore es falso.
 *   - Esto permite probar la interacción ENTRE servicios sin emuladores.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── In-memory Firestore simulation ──────────────────────────────────────────
//
// MemStore simula el estado de Firestore en RAM.
// Los mocks de runTransaction / getDocs / getDoc leen y escriben aquí,
// permitiendo que múltiples llamadas a servicios distintos compartan estado.

type DocData = Record<string, unknown>;
type DocRef  = { _col: string; _id: string; id: string };
type ColRef  = { _col: string; _isCol: true };
type Constraint = {
  _where?: { field: string; op: string; value: unknown };
  _limit?: number;
};
type QueryObj = { _col: string; _constraints: Constraint[] };

function isColRef(x: unknown): x is ColRef {
  return !!(x as ColRef)?._isCol;
}

class MemStore {
  private docs: Record<string, DocData> = {};
  private counter = 0;

  reset() { this.docs = {}; this.counter = 0; }

  makeRef(col: string, id: string): DocRef { return { _col: col, _id: id, id }; }

  makeAutoRef(col: string): DocRef {
    const id = `auto_${++this.counter}`;
    return { _col: col, _id: id, id };
  }

  snap(col: string, id: string) {
    const data = this.docs[`${col}/${id}`];
    return { exists: () => Boolean(data), data: () => data ?? {}, id };
  }

  set(col: string, id: string, data: DocData, options?: { merge?: boolean }) {
    const key = `${col}/${id}`;
    this.docs[key] = options?.merge ? { ...(this.docs[key] ?? {}), ...data } : { ...data };
  }

  update(col: string, id: string, updates: DocData) {
    const key = `${col}/${id}`;
    this.docs[key] = { ...(this.docs[key] ?? {}), ...updates };
  }

  query(col: string, constraints: Constraint[] = []): Array<{ id: string; data: () => DocData }> {
    const prefix = `${col}/`;
    let docs = Object.entries(this.docs)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => ({ id: k.slice(prefix.length), data: () => ({ ...v }) }));

    for (const c of constraints) {
      if (c._where) {
        const { field, op, value } = c._where;
        docs = docs.filter(d => {
          const fv = (d.data() as DocData)[field];
          if (op === '==') return fv === value;
          if (op === 'in') return (value as unknown[]).includes(fv);
          if (op === 'array-contains') return Array.isArray(fv) && fv.includes(value);
          return true;
        });
      }
      if (c._limit !== undefined) docs = docs.slice(0, c._limit);
    }
    return docs;
  }

  countIn(col: string): number { return this.query(col).length; }

  getDoc(col: string, id: string): DocData | undefined { return this.docs[`${col}/${id}`]; }
}

const store = new MemStore();

// ─── Mock declarations (hoisted before imports by Vitest) ─────────────────────

vi.mock('@/lib/firebase/clientApp', () => ({
  db:   { _isDb: true },
  auth: { currentUser: { email: 'admin@test.com' } },
}));

vi.mock('@/lib/algoliaClient', () => ({
  algoliaClient:  { searchSingleIndex: vi.fn() },
  ALGOLIA_INDICES: { SALES: 'sales_index' },
}));

vi.mock('firebase/firestore', () => ({
  collection:         vi.fn(),
  doc:                vi.fn(),
  getDoc:             vi.fn(),
  getDocs:            vi.fn(),
  query:              vi.fn(),
  where:              vi.fn(),
  orderBy:            vi.fn(() => ({})),
  limit:              vi.fn(),
  limitToLast:        vi.fn(() => ({})),
  startAfter:         vi.fn(() => ({})),
  endBefore:          vi.fn(() => ({})),
  documentId:         vi.fn(() => '__id__'),
  runTransaction:     vi.fn(),
  serverTimestamp:    vi.fn(() => 'SERVER_TS'),
  getCountFromServer: vi.fn(() => Promise.resolve({ data: () => ({ count: 0 }) })),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import {
  collection, doc, getDoc, getDocs, query, where, limit, runTransaction,
} from 'firebase/firestore';
import type { Transaction } from 'firebase/firestore';

import { createProduct }   from './catalogService';
import { adjustStock }     from './stockAdjustmentService';
import { processSale }     from '@/core/sales/services/salesService';
import type { CartItem }   from '@/core/sales/services/salesService';

// ─── Configure mocks against the in-memory store ─────────────────────────────

function setupMocks() {
  vi.mocked(collection).mockImplementation((_db: unknown, col?: string) =>
    ({ _col: col ?? 'unknown', _isCol: true }) as unknown as ReturnType<typeof collection>,
  );

  vi.mocked(doc).mockImplementation((dbOrRef: unknown, ...rest: unknown[]) => {
    if (isColRef(dbOrRef)) {
      return store.makeAutoRef(dbOrRef._col) as unknown as ReturnType<typeof doc>;
    }
    const [col, id] = rest as [string, string];
    return store.makeRef(col, id) as unknown as ReturnType<typeof doc>;
  });

  vi.mocked(where).mockImplementation((field: any, op: any, value: any) =>
    ({ _where: { field, op, value } }) as unknown as ReturnType<typeof where>,
  );

  vi.mocked(limit).mockImplementation((n: number) =>
    ({ _limit: n }) as unknown as ReturnType<typeof limit>,
  );

  vi.mocked(query).mockImplementation((colRef: unknown, ...constraints: unknown[]) =>
    ({
      _col: (colRef as ColRef)._col,
      _constraints: constraints,
    }) as unknown as ReturnType<typeof query>,
  );

  vi.mocked(getDocs).mockImplementation(async (q: unknown) => {
    const { _col, _constraints = [] } = q as QueryObj;
    const docs = store.query(_col, _constraints as Constraint[]);
    return { empty: docs.length === 0, docs } as unknown as Awaited<ReturnType<typeof getDocs>>;
  });

  vi.mocked(getDoc).mockImplementation(async (ref: unknown) => {
    const r = ref as DocRef;
    return store.snap(r._col, r._id) as unknown as Awaited<ReturnType<typeof getDoc>>;
  });

  vi.mocked(runTransaction).mockImplementation(
    async (_db: unknown, fn: (tx: Transaction) => Promise<unknown>) => {
      const tx = {
        get:    vi.fn((ref: unknown) => {
          const r = ref as DocRef;
          return Promise.resolve(store.snap(r._col, r._id));
        }),
        set:    vi.fn((ref: unknown, data: unknown, opts?: unknown) => {
          const r = ref as DocRef;
          store.set(r._col, r._id, data as DocData, opts as { merge?: boolean } | undefined);
        }),
        update: vi.fn((ref: unknown, updates: unknown) => {
          const r = ref as DocRef;
          store.update(r._col, r._id, updates as DocData);
        }),
      };
      return fn(tx as unknown as Transaction);
    },
  );
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SKU = 'UPVC6MT';

const MIN_PRODUCT_INPUT = {
  sku: SKU,
  displayName: 'TC5 UPVC ROJO 6MT',
  material:  'UPVC'  as const,
  color:     'ROJO',
  thickness: 1.5,
  width:     1.075,
  length:    6.0,
  unit:      'PIEZA' as const,
};

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    sku:          SKU,
    businessLine: 'roofing',
    productName:  'TC5 UPVC ROJO 6MT',
    quantity:     1,
    unitPrice:    80,
    unitValue:    80,
    baseCost:     50,
    unitWeight:   0,
    ...overrides,
  };
}

/** Pre-siembra el catálogo sin pasar por createProduct (evita complejidad en tests focalizados). */
function seedCatalog() {
  store.set('roofing_catalog', SKU, {
    displayName: 'TC5 UPVC ROJO 1.5MM X 1.075 X 6.00MT',
    material: 'UPVC', color: 'ROJO', thickness: 1.5,
    width: 1.075, length: 6.0, unit: 'PIEZA',
    active: true, avgCost: 0,
  });
}

/** Pre-siembra stock con la cantidad y costo dados. */
function seedStock(quantity: number, avgCost: number) {
  store.set('roofing_stock', SKU, {
    sku: SKU, productName: 'TC5 UPVC ROJO 6MT',
    quantity, avgCost, totalValue: quantity * avgCost,
    lastUpdate: 'SERVER_TS',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. FLUJO COMPLETO
// ═══════════════════════════════════════════════════════════════════════════════

describe('Flujo completo: crear producto → ajustar stock → vender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.reset();
    setupMocks();
    store.set('settings', 'general_settings', { nextSaleNumber: 1 });
  });

  it('las tres fases persisten y coordinan estado en el store compartido', async () => {
    // Fase 1: catálogo vacío → crear producto
    expect(store.countIn('roofing_catalog')).toBe(0);
    await createProduct(MIN_PRODUCT_INPUT);
    expect(store.countIn('roofing_catalog')).toBe(1);
    expect(store.getDoc('roofing_catalog', SKU)?.material).toBe('UPVC');

    // Fase 2: stock vacío → ingresar 10 unidades
    expect(store.countIn('roofing_stock')).toBe(0);
    await adjustStock({
      sku: SKU, type: 'ENTRY', quantity: 10, unitCost: 50,
      reason: 'Compra inicial', performedBy: 'admin@test.com',
    });
    expect(store.getDoc('roofing_stock', SKU)?.quantity).toBe(10);
    expect(store.getDoc('roofing_stock', SKU)?.avgCost).toBe(50);

    // Fase 3: venta de 3 unidades → stock queda en 7
    const result = await processSale(
      'Cliente SA', 'RUC-20123456789', "", [makeCartItem({ quantity: 3 })],
      'seller_01',
    );

    expect(result).toMatchObject({ success: true, id: 'V-000001' });
    expect(store.getDoc('roofing_stock', SKU)?.quantity).toBe(7);
  });

  it('la venta crea el documento de venta con campos correctos', async () => {
    await createProduct(MIN_PRODUCT_INPUT);
    await adjustStock({ sku: SKU, type: 'ENTRY', quantity: 10, unitCost: 50, reason: 'E', performedBy: 'u' });
    await processSale('Distribuidora Norte', 'RUC-20999999', "", [makeCartItem({ quantity: 2, unitPrice: 85 })], 'v01');

    expect(store.countIn('sales')).toBe(1);
    const sale = store.query('sales')[0].data();
    expect(sale.customerName).toBe('Distribuidora Norte');
    expect(sale.status).toBe('COMPLETED');
    expect(sale.businessLines).toEqual(expect.arrayContaining(['roofing']));
    expect(sale.totalAmount).toBe(2 * 85);
  });

  it('el número de venta se incrementa en settings tras cada venta', async () => {
    await createProduct(MIN_PRODUCT_INPUT);
    await adjustStock({ sku: SKU, type: 'ENTRY', quantity: 20, unitCost: 50, reason: 'E', performedBy: 'u' });

    await processSale('A', '001', "", [makeCartItem({ quantity: 1 })], 'v');
    expect(store.getDoc('settings', 'general_settings')?.nextSaleNumber).toBe(2);

    await processSale('B', '002', "", [makeCartItem({ quantity: 1 })], 'v');
    expect(store.getDoc('settings', 'general_settings')?.nextSaleNumber).toBe(3);
    expect(store.countIn('sales')).toBe(2);
  });

  it('genera movimiento en roofing_stock_movements al vender', async () => {
    await createProduct(MIN_PRODUCT_INPUT);
    // Pre-seed stock directamente para evitar el movimiento de ENTRADA que añadiría adjustStock
    seedStock(10, 50);
    await processSale('Test', '123', "", [makeCartItem({ quantity: 4 })], 'seller');

    expect(store.countIn('roofing_stock_movements')).toBe(1);
    const mov = store.query('roofing_stock_movements')[0].data();
    expect(mov.sku).toBe(SKU);
    expect(mov.type).toBe('SALIDA');
    expect(mov.quantity).toBe(4);
    expect(mov.businessLine).toBe('roofing');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. STOCK NEGATIVO (ADR-005)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Stock negativo después de venta sin stock (ADR-005)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.reset();
    setupMocks();
    store.set('settings', 'general_settings', { nextSaleNumber: 1 });
    seedCatalog();
    // No se ingresa stock — stock inicial = 0
  });

  it('no lanza excepción al vender con stock cero', async () => {
    await expect(
      processSale('Test', 'DOC', "", [makeCartItem({ quantity: 5 })], 'seller'),
    ).resolves.toMatchObject({ success: true });
  });

  it('el stock queda negativo tras la venta', async () => {
    await processSale('Test', 'DOC', "", [makeCartItem({ quantity: 5 })], 'seller');
    expect(store.getDoc('roofing_stock', SKU)?.quantity).toBe(-5);
  });

  it('la venta queda registrada como COMPLETED aunque el stock sea negativo', async () => {
    await processSale('Test', 'DOC', "", [makeCartItem({ quantity: 5 })], 'seller');
    const sale = store.query('sales')[0]?.data();
    expect(sale?.status).toBe('COMPLETED');
    expect(sale?.items).toHaveLength(1);
  });

  it('ventas sucesivas acumulan stock negativo', async () => {
    await processSale('A', '001', "", [makeCartItem({ quantity: 5 })], 'seller');
    await processSale('B', '002', "", [makeCartItem({ quantity: 3 })], 'seller');

    expect(store.getDoc('roofing_stock', SKU)?.quantity).toBe(-8);
    expect(store.countIn('sales')).toBe(2);
  });

  it('si había stock positivo pero insuficiente, también permite negativo', async () => {
    seedStock(3, 50);

    await processSale('Test', 'DOC', "", [makeCartItem({ quantity: 10 })], 'seller');

    expect(store.getDoc('roofing_stock', SKU)?.quantity).toBe(-7);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CÁLCULO DE COSTO PROMEDIO PONDERADO
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cálculo correcto del costo promedio ponderado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.reset();
    setupMocks();
    seedCatalog();
  });

  it('primera entrada: avgCost == unitCost (stock parte de 0)', async () => {
    await adjustStock({ sku: SKU, type: 'ENTRY', quantity: 10, unitCost: 50, reason: 'E', performedBy: 'u' });

    const s = store.getDoc('roofing_stock', SKU);
    expect(s?.quantity).toBe(10);
    expect(s?.avgCost).toBe(50);
  });

  it('segunda entrada recalcula el promedio ponderado correctamente', async () => {
    // E1: 10 × 50 → avgCost = 50
    await adjustStock({ sku: SKU, type: 'ENTRY', quantity: 10, unitCost: 50, reason: 'E1', performedBy: 'u' });
    // E2: 5 × 80 → avgCost = (500 + 400) / 15 = 60.0000
    await adjustStock({ sku: SKU, type: 'ENTRY', quantity: 5,  unitCost: 80, reason: 'E2', performedBy: 'u' });

    const s = store.getDoc('roofing_stock', SKU);
    expect(s?.quantity).toBe(15);
    expect(s?.avgCost).toBe(60);
  });

  it('el costo promedio también se actualiza en el catálogo', async () => {
    await adjustStock({ sku: SKU, type: 'ENTRY', quantity: 10, unitCost: 50, reason: 'E1', performedBy: 'u' });
    await adjustStock({ sku: SKU, type: 'ENTRY', quantity: 5,  unitCost: 80, reason: 'E2', performedBy: 'u' });

    expect(store.getDoc('roofing_catalog', SKU)?.avgCost).toBe(60);
  });

  it('tres entradas sucesivas convergen al promedio correcto', async () => {
    // E1: 10 × 40  → stock=10, avg=40
    await adjustStock({ sku: SKU, type: 'ENTRY', quantity: 10, unitCost: 40, reason: 'E1', performedBy: 'u' });
    // E2: 10 × 60  → (400+600)/20 = 50
    await adjustStock({ sku: SKU, type: 'ENTRY', quantity: 10, unitCost: 60, reason: 'E2', performedBy: 'u' });
    // E3: 5  × 80  → (1000+400)/25 = 56
    await adjustStock({ sku: SKU, type: 'ENTRY', quantity: 5,  unitCost: 80, reason: 'E3', performedBy: 'u' });

    const s = store.getDoc('roofing_stock', SKU);
    expect(s?.quantity).toBe(25);
    expect(s?.avgCost).toBeCloseTo(56, 2);
  });

  it('salida (EXIT) no modifica el avgCost', async () => {
    await adjustStock({ sku: SKU, type: 'ENTRY', quantity: 10, unitCost: 50, reason: 'E', performedBy: 'u' });
    await adjustStock({ sku: SKU, type: 'EXIT',  quantity: 3,               reason: 'S', performedBy: 'u' });

    const s = store.getDoc('roofing_stock', SKU);
    expect(s?.quantity).toBe(7);
    expect(s?.avgCost).toBe(50);
  });

  it('ajuste absoluto (ADJUSTMENT) no modifica el avgCost', async () => {
    await adjustStock({ sku: SKU, type: 'ENTRY',      quantity: 10, unitCost: 50, reason: 'E', performedBy: 'u' });
    await adjustStock({ sku: SKU, type: 'ADJUSTMENT', quantity: 8,               reason: 'A', performedBy: 'u' });

    const s = store.getDoc('roofing_stock', SKU);
    expect(s?.quantity).toBe(8);
    expect(s?.avgCost).toBe(50);
  });

  it('el totalValue = quantity × avgCost al cierre', async () => {
    await adjustStock({ sku: SKU, type: 'ENTRY', quantity: 10, unitCost: 50, reason: 'E1', performedBy: 'u' });
    await adjustStock({ sku: SKU, type: 'ENTRY', quantity: 5,  unitCost: 80, reason: 'E2', performedBy: 'u' });

    const s = store.getDoc('roofing_stock', SKU)!;
    const expectedValue = Number(((s.quantity as number) * (s.avgCost as number)).toFixed(2));
    expect(s.totalValue).toBe(expectedValue);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. AUDIT LOGS GENERADOS EN CADA PASO
// ═══════════════════════════════════════════════════════════════════════════════

describe('Audit logs generados en cada paso del flujo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.reset();
    setupMocks();
    store.set('settings', 'general_settings', { nextSaleNumber: 1 });
    // No seedCatalog aquí: los tests que llaman createProduct crean el catálogo solos;
    // los que llaman adjustStock directamente hacen seedCatalog() localmente.
  });

  it('createProduct escribe audit log con action CREATE_ROOFING_PRODUCT', async () => {
    await createProduct(MIN_PRODUCT_INPUT);

    const logs = store.query('audit_logs');
    const log = logs.find(l => l.data().action === 'CREATE_ROOFING_PRODUCT');
    expect(log).toBeDefined();
    expect(log!.data().entityId).toBe(SKU);
  });

  it('el audit log de createProduct incluye email del usuario y timestamp', async () => {
    await createProduct(MIN_PRODUCT_INPUT);

    const log = store.query('audit_logs').find(l => l.data().action === 'CREATE_ROOFING_PRODUCT')!;
    expect(log.data().userEmail).toBeTruthy();
    expect(log.data().timestamp).toBe('SERVER_TS');
  });

  it('adjustStock ENTRY escribe audit log con action ADJUST_ROOFING_STOCK', async () => {
    seedCatalog();
    await adjustStock({ sku: SKU, type: 'ENTRY', quantity: 10, unitCost: 50, reason: 'Test', performedBy: 'u' });

    const log = store.query('audit_logs').find(l => l.data().action === 'ADJUST_ROOFING_STOCK');
    expect(log).toBeDefined();
    expect(log!.data().entityId).toBe(SKU);
  });

  it('el detalle del audit log de ENTRY refleja el delta correcto (+10, 0→10)', async () => {
    seedCatalog();
    await adjustStock({ sku: SKU, type: 'ENTRY', quantity: 10, unitCost: 50, reason: 'Ingreso', performedBy: 'u' });

    const details = store.query('audit_logs').find(
      l => l.data().action === 'ADJUST_ROOFING_STOCK',
    )!.data().details as string;

    expect(details).toContain('[ENTRY]');
    expect(details).toContain('+10');
    expect(details).toContain('0 → 10');
    expect(details).toContain(SKU);
  });

  it('el detalle del audit log de EXIT refleja delta negativo y rango correcto', async () => {
    seedCatalog();
    await adjustStock({ sku: SKU, type: 'ENTRY', quantity: 10, unitCost: 50, reason: 'E', performedBy: 'u' });
    await adjustStock({ sku: SKU, type: 'EXIT',  quantity: 3,               reason: 'Daño', performedBy: 'u' });

    const exitLog = store
      .query('audit_logs')
      .filter(l => l.data().action === 'ADJUST_ROOFING_STOCK')
      .at(-1)!;

    const details = exitLog.data().details as string;
    expect(details).toContain('[EXIT]');
    expect(details).toContain('-3');
    expect(details).toContain('10 → 7');
  });

  it('processSale escribe movimiento SALIDA en roofing_stock_movements', async () => {
    seedStock(10, 50);

    await processSale('Test', '123', "", [makeCartItem({ quantity: 2 })], 'seller_01');

    const movements = store.query('roofing_stock_movements');
    expect(movements).toHaveLength(1);
    const mov = movements[0].data();
    expect(mov.type).toBe('SALIDA');
    expect(mov.quantity).toBe(2);
    expect(mov.sku).toBe(SKU);
    expect(mov.createdAt).toBe('SERVER_TS');
  });

  it('todos los audit logs tienen userEmail y timestamp', async () => {
    await createProduct(MIN_PRODUCT_INPUT);
    await adjustStock({ sku: SKU, type: 'ENTRY', quantity: 5, unitCost: 50, reason: 'T', performedBy: 'u' });

    for (const log of store.query('audit_logs')) {
      expect(log.data().userEmail).toBeTruthy();
      expect(log.data().timestamp).toBe('SERVER_TS');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. RBAC — SUPERVISOR no puede crear productos en catálogo
// ═══════════════════════════════════════════════════════════════════════════════

describe('RBAC: SUPERVISOR no puede crear productos en catálogo', () => {
  /** Simula el error que Firestore devuelve cuando las security rules rechazan la operación. */
  function permissionError() {
    return Object.assign(
      new Error('Missing or insufficient permissions.'),
      { code: 'permission-denied' },
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    store.reset();
    setupMocks();
  });

  it('createProduct propaga el error permission-denied de Firestore', async () => {
    vi.mocked(runTransaction).mockRejectedValueOnce(permissionError());

    await expect(createProduct(MIN_PRODUCT_INPUT)).rejects.toThrow(
      'Missing or insufficient permissions.',
    );
  });

  it('el error propagado tiene código permission-denied', async () => {
    vi.mocked(runTransaction).mockRejectedValueOnce(permissionError());

    const error = await createProduct(MIN_PRODUCT_INPUT).catch(e => e) as { code: string };
    expect(error.code).toBe('permission-denied');
  });

  it('un fallo en la transacción no persiste datos parciales', async () => {
    vi.mocked(runTransaction).mockRejectedValueOnce(permissionError());

    await createProduct(MIN_PRODUCT_INPUT).catch(() => {});

    // La comprobación de combinación única (getDocs) ocurrió pero no escribió nada.
    // La transacción fue rechazada antes de ejecutarse → store vacío.
    expect(store.countIn('roofing_catalog')).toBe(0);
    expect(store.countIn('audit_logs')).toBe(0);
  });

  it('adjustStock también propaga el error permission-denied', async () => {
    seedCatalog();
    vi.mocked(runTransaction).mockRejectedValueOnce(permissionError());

    await expect(
      adjustStock({ sku: SKU, type: 'ENTRY', quantity: 5, unitCost: 50, reason: 'T', performedBy: 'supervisor@test.com' }),
    ).rejects.toThrow('Missing or insufficient permissions.');
  });

  it('tras el error, el store no contiene movimientos ni stock', async () => {
    seedCatalog();
    vi.mocked(runTransaction).mockRejectedValueOnce(permissionError());

    await adjustStock({ sku: SKU, type: 'ENTRY', quantity: 5, unitCost: 50, reason: 'T', performedBy: 'sup' }).catch(() => {});

    expect(store.countIn('roofing_stock')).toBe(0);
    expect(store.countIn('roofing_stock_movements')).toBe(0);
    expect(store.countIn('audit_logs')).toBe(0);
  });
});
