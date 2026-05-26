import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mock firebase/firestore BEFORE importing service ────────────────────────

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'col-ref'),
  doc: vi.fn(() => 'doc-ref'),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(() => 'q'),
  where: vi.fn(() => 'w'),
  orderBy: vi.fn(() => 'o'),
  limit: vi.fn(() => 'l'),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
}));

import { getDocs, getDoc, runTransaction } from 'firebase/firestore';
import type { Transaction } from 'firebase/firestore';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deactivateProduct,
  reactivateProduct,
  generateDisplayName,
  seedInitialCatalog,
} from './catalogService';
import type { RoofingProductInput } from '../schemas/catalog';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeSnap(data?: Record<string, unknown>, id = 'UPVC6MT') {
  return { exists: () => !!data, id, data: () => data ?? {} };
}

function makeQuerySnap(rows: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    empty: rows.length === 0,
    docs: rows.map(r => ({ id: r.id, data: () => r.data })),
  };
}

const BASE_PRODUCT_DATA = {
  displayName: 'TC5 UPVC ROJO 1.5MM X 1.075 X 6.00MT',
  family: 'TC5',
  material: 'UPVC',
  color: 'ROJO',
  thickness: 1.5,
  width: 1.075,
  length: 6.0,
  unit: 'PIEZA',
  active: true,
  avgCost: 0,
};

const MIN_VALID_INPUT: RoofingProductInput = {
  material: 'UPVC',
  color: 'ROJO',
  thickness: 1.5,
  width: 1.075,
  length: 6.0,
  unit: 'PIEZA',
};

// ─── Transaction mock setup ───────────────────────────────────────────────────

let txGet: ReturnType<typeof vi.fn>;
let txSet: ReturnType<typeof vi.fn>;
let txUpdate: ReturnType<typeof vi.fn>;

function setupTransaction(getReturn?: unknown) {
  txGet = vi.fn().mockResolvedValue(getReturn ?? makeSnap(undefined));
  txSet = vi.fn();
  txUpdate = vi.fn();
  vi.mocked(runTransaction).mockImplementation(async (_db, fn) =>
    fn({ get: txGet, set: txSet, update: txUpdate } as unknown as Transaction),
  );
}

// ─── generateDisplayName ──────────────────────────────────────────────────────

describe('generateDisplayName', () => {
  it.each([
    [
      { family: 'TC5', material: 'UPVC', color: 'ROJO', thickness: 1.5, width: 1.075, length: 6.0 },
      'TC5 UPVC ROJO 1.5MM X 1.075 X 6.00MT',
    ],
    [
      { family: 'TC5', material: 'UPVC', color: 'AZUL', thickness: 1.5, width: 1.075, length: 3.6 },
      'TC5 UPVC AZUL 1.5MM X 1.075 X 3.60MT',
    ],
    [
      { family: 'TC5', material: 'ACERO_GALV', color: undefined, thickness: 2, width: 1.0, length: 6.0 },
      'TC5 ACERO_GALV 2MM X 1.000 X 6.00MT',
    ],
  ])('formats %o → %s', (input, expected) => {
    expect(generateDisplayName(input as Parameters<typeof generateDisplayName>[0])).toBe(expected);
  });
});

// ─── listProducts ─────────────────────────────────────────────────────────────

describe('listProducts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array when no products exist', async () => {
    vi.mocked(getDocs).mockResolvedValue(makeQuerySnap([]) as never);
    expect(await listProducts()).toEqual([]);
  });

  it('maps Firestore documents to RoofingProduct', async () => {
    vi.mocked(getDocs).mockResolvedValue(
      makeQuerySnap([{ id: 'UPVC6MT', data: BASE_PRODUCT_DATA }]) as never,
    );
    const result = await listProducts();
    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('UPVC6MT');
    expect(result[0].displayName).toBe(BASE_PRODUCT_DATA.displayName);
  });

  it('strips internal _combinationKey field', async () => {
    vi.mocked(getDocs).mockResolvedValue(
      makeQuerySnap([{ id: 'UPVC6MT', data: { ...BASE_PRODUCT_DATA, _combinationKey: 'x|y|1|2|3' } }]) as never,
    );
    const result = await listProducts();
    expect(result[0]).not.toHaveProperty('_combinationKey');
  });

  it('filters by searchTerm client-side on sku', async () => {
    vi.mocked(getDocs).mockResolvedValue(
      makeQuerySnap([
        { id: 'UPVC6MT', data: { ...BASE_PRODUCT_DATA, displayName: 'TC5 UPVC ROJO 6MT' } },
        { id: 'UPVC36MT', data: { ...BASE_PRODUCT_DATA, displayName: 'TC5 UPVC ROJO 36MT' } },
      ]) as never,
    );
    const result = await listProducts({ searchTerm: '36' });
    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('UPVC36MT');
  });

  it('filters by searchTerm client-side on displayName', async () => {
    vi.mocked(getDocs).mockResolvedValue(
      makeQuerySnap([
        { id: 'UPVC6MT', data: { ...BASE_PRODUCT_DATA, displayName: 'TC5 UPVC ROJO 6MT' } },
        { id: 'UPVC6MTAZUL', data: { ...BASE_PRODUCT_DATA, displayName: 'TC5 UPVC AZUL 6MT' } },
      ]) as never,
    );
    const result = await listProducts({ searchTerm: 'azul' });
    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('UPVC6MTAZUL');
  });
});

// ─── getProduct ───────────────────────────────────────────────────────────────

describe('getProduct', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when product does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValue(makeSnap(undefined) as never);
    expect(await getProduct('UPVC6MT')).toBeNull();
  });

  it('returns RoofingProduct when found', async () => {
    vi.mocked(getDoc).mockResolvedValue(makeSnap(BASE_PRODUCT_DATA, 'UPVC6MT') as never);
    const result = await getProduct('UPVC6MT');
    expect(result).not.toBeNull();
    expect(result!.sku).toBe('UPVC6MT');
    expect(result!.material).toBe('UPVC');
  });

  it('strips _combinationKey from returned product', async () => {
    vi.mocked(getDoc).mockResolvedValue(
      makeSnap({ ...BASE_PRODUCT_DATA, _combinationKey: 'UPVC|ROJO|1.5|1.075|6' }, 'UPVC6MT') as never,
    );
    const result = await getProduct('UPVC6MT');
    expect(result).not.toHaveProperty('_combinationKey');
  });
});

// ─── createProduct ────────────────────────────────────────────────────────────

describe('createProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: combination is unique
    vi.mocked(getDocs).mockResolvedValue(makeQuerySnap([]) as never);
    // Default tx: SKU does not exist
    setupTransaction(makeSnap(undefined));
  });

  it('creates product and returns it with auto-generated SKU', async () => {
    const result = await createProduct(MIN_VALID_INPUT);
    expect(result.sku).toBe('UPVC6MT');
    expect(result.material).toBe('UPVC');
    expect(result.active).toBe(true);
    expect(result.avgCost).toBe(0);
  });

  it('uses provided SKU when given', async () => {
    const result = await createProduct({ ...MIN_VALID_INPUT, sku: 'UPVC6MTCUSTOM' });
    expect(result.sku).toBe('UPVC6MTCUSTOM');
  });

  it('auto-generates displayName when not provided', async () => {
    const result = await createProduct(MIN_VALID_INPUT);
    expect(result.displayName).toBe('TC5 UPVC ROJO 1.5MM X 1.075 X 6.00MT');
  });

  it('uses provided displayName when given', async () => {
    const result = await createProduct({ ...MIN_VALID_INPUT, displayName: 'Mi plancha UPVC' });
    expect(result.displayName).toBe('Mi plancha UPVC');
  });

  it('writes product and audit log in transaction (2 sets)', async () => {
    await createProduct(MIN_VALID_INPUT);
    expect(txSet).toHaveBeenCalledTimes(2);
  });

  it('throws on Zod validation failure (missing unit)', async () => {
    const badInput = { material: 'UPVC', color: 'ROJO', thickness: 1.5, width: 1.075, length: 6.0 };
    await expect(createProduct(badInput as RoofingProductInput)).rejects.toThrow();
  });

  it('throws Zod error in Spanish when color missing for UPVC', async () => {
    const noColor = { material: 'UPVC', thickness: 1.5, width: 1.075, length: 6.0, unit: 'PIEZA' };
    await expect(createProduct(noColor as RoofingProductInput)).rejects.toThrow(
      'El color es obligatorio para material UPVC',
    );
  });

  it('throws when combination already exists', async () => {
    vi.mocked(getDocs).mockResolvedValue(
      makeQuerySnap([{ id: 'UPVC6MT', data: BASE_PRODUCT_DATA }]) as never,
    );
    await expect(createProduct(MIN_VALID_INPUT)).rejects.toThrow('Combinación duplicada');
  });

  it('throws when SKU already exists in Firestore', async () => {
    setupTransaction(makeSnap(BASE_PRODUCT_DATA)); // SKU exists
    await expect(createProduct(MIN_VALID_INPUT)).rejects.toThrow('Producto ya existe');
  });
});

// ─── updateProduct ────────────────────────────────────────────────────────────

describe('updateProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTransaction(makeSnap(BASE_PRODUCT_DATA)); // product exists
  });

  it('updates product fields successfully', async () => {
    await updateProduct('UPVC6MT', { active: false });
    expect(txUpdate).toHaveBeenCalledOnce();
  });

  it('writes audit log in transaction', async () => {
    await updateProduct('UPVC6MT', { active: false });
    expect(txSet).toHaveBeenCalledOnce();
  });

  it('throws when product does not exist', async () => {
    setupTransaction(makeSnap(undefined));
    await expect(updateProduct('NONEXISTENT', { active: false })).rejects.toThrow(
      'Producto no encontrado',
    );
  });

  it('throws when attempting to update sku', async () => {
    await expect(
      updateProduct('UPVC6MT', { sku: 'NEWSKU' } as Partial<RoofingProductInput>),
    ).rejects.toThrow('SKU no se puede modificar');
  });
});

// ─── deactivateProduct ────────────────────────────────────────────────────────

describe('deactivateProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deactivates product when no stock', async () => {
    txGet = vi.fn()
      .mockResolvedValueOnce(makeSnap(BASE_PRODUCT_DATA)) // product
      .mockResolvedValueOnce(makeSnap(undefined));          // no stock
    txUpdate = vi.fn();
    txSet = vi.fn();
    vi.mocked(runTransaction).mockImplementation(async (_db, fn) =>
      fn({ get: txGet, set: txSet, update: txUpdate } as unknown as Transaction),
    );

    await deactivateProduct('UPVC6MT', 'Descontinuado');
    expect(txUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ active: false }));
  });

  it('includes stock quantity in audit when stock > 0', async () => {
    txGet = vi.fn()
      .mockResolvedValueOnce(makeSnap(BASE_PRODUCT_DATA))
      .mockResolvedValueOnce(makeSnap({ quantity: 15 }));
    txUpdate = vi.fn();
    txSet = vi.fn();
    vi.mocked(runTransaction).mockImplementation(async (_db, fn) =>
      fn({ get: txGet, set: txSet, update: txUpdate } as unknown as Transaction),
    );

    await deactivateProduct('UPVC6MT', 'Prueba');
    const auditCall = txSet.mock.calls[0][1] as { details: string };
    expect(auditCall.details).toContain('15 unidades');
  });

  it('throws when product does not exist', async () => {
    txGet = vi.fn().mockResolvedValue(makeSnap(undefined));
    txUpdate = vi.fn();
    txSet = vi.fn();
    vi.mocked(runTransaction).mockImplementation(async (_db, fn) =>
      fn({ get: txGet, set: txSet, update: txUpdate } as unknown as Transaction),
    );

    await expect(deactivateProduct('NONEXISTENT', 'test')).rejects.toThrow('Producto no encontrado');
  });
});

// ─── reactivateProduct ────────────────────────────────────────────────────────

describe('reactivateProduct', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reactivates an existing product', async () => {
    setupTransaction(makeSnap(BASE_PRODUCT_DATA));
    await reactivateProduct('UPVC6MT');
    expect(txUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ active: true }));
  });

  it('throws when product does not exist', async () => {
    setupTransaction(makeSnap(undefined));
    await expect(reactivateProduct('NONEXISTENT')).rejects.toThrow('Producto no encontrado');
  });
});

// ─── seedInitialCatalog ───────────────────────────────────────────────────────

describe('seedInitialCatalog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing when catalog already has products', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce(
      makeQuerySnap([{ id: 'UPVC6MT', data: BASE_PRODUCT_DATA }]) as never,
    );
    await seedInitialCatalog();
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('creates 4 products when catalog is empty', async () => {
    // listProducts → empty; each createProduct → combination check empty + tx
    vi.mocked(getDocs).mockResolvedValue(makeQuerySnap([]) as never);
    setupTransaction(makeSnap(undefined));

    await seedInitialCatalog();
    expect(runTransaction).toHaveBeenCalledTimes(4);
  });
});
