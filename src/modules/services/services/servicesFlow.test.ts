/**
 * Integration tests — módulo Services (Mano de obra)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── In-memory Firestore simulation ──────────────────────────────────────────

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

// ─── Mock declarations ────────────────────────────────────────────────────────

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

// ─── Imports ──────────────────────────────────────────────────────────────────

import {
  collection, doc, getDoc, getDocs, query, where, limit, runTransaction,
} from 'firebase/firestore';
import type { Transaction } from 'firebase/firestore';

import { createProduct }   from './catalogService';
import { processSale }     from '@/core/sales/services/salesService';
import type { CartItem }   from '@/core/sales/services/salesService';

// ─── Configure mocks ──────────────────────────────────────────────────────────

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

  vi.mocked(where).mockImplementation((field: string, op: string, value: unknown) =>
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

const SKU = 'CONFORMADO';

const MIN_PRODUCT_INPUT = {
  sku: SKU,
  displayName: 'SERVICIO DE CONFORMADO',
  unit: 'TONELADA' as const,
  pricePerUnit: 150,
};

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    sku:          SKU,
    businessLine: 'services',
    productName:  'SERVICIO DE CONFORMADO',
    quantity:     5,
    unitPrice:    150,
    unitValue:    150,
    baseCost:     0,
    unitWeight:   0,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Services Module: Flujo completo (NO-OP Strategy)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.reset();
    setupMocks();
    store.set('settings', 'general_settings', { nextSaleNumber: 1 });
  });

  it('crear producto → vender (no actualiza ningún stock)', async () => {
    await createProduct(MIN_PRODUCT_INPUT);
    expect(store.countIn('services_catalog')).toBe(1);

    // Vender 5 toneladas de servicio
    const result = await processSale('Cliente', '123', [makeCartItem({ quantity: 5 })], 'seller');
    expect(result.success).toBe(true);

    // Verificamos que no se escribió nada en "_noop_stock" ni en ningún otro lado raro
    expect(store.countIn('_noop_stock')).toBe(0);

    // Tampoco hubo movimientos de stock
    expect(store.countIn('services_stock_movements')).toBe(0);
    expect(store.countIn('trading_stock_movements')).toBe(0);
    expect(store.countIn('kardex_movements')).toBe(0);
  });
});
