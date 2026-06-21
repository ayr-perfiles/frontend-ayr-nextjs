import { db, auth } from '@/lib/firebase/clientApp';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  QueryConstraint,
} from 'firebase/firestore';
import { RoofingProductSchema, type RoofingProductInput } from '../schemas/catalog';
import { generateSKU, combinationKey } from '../domain/skuGenerator';
import type { RoofingProduct } from '../types';

const COLLECTION = 'roofing_catalog';
const AUDIT_COLLECTION = 'audit_logs';

type RoofingAuditAction =
  | 'CREATE_ROOFING_PRODUCT'
  | 'UPDATE_ROOFING_PRODUCT'
  | 'DEACTIVATE_ROOFING_PRODUCT'
  | 'REACTIVATE_ROOFING_PRODUCT';

// ─── helpers ──────────────────────────────────────────────────────────────────

function currentUserEmail(): string {
  return auth.currentUser?.email ?? 'sistema';
}

function buildAudit(action: RoofingAuditAction, entityId: string, details: string) {
  return { action, entityId, userEmail: currentUserEmail(), details, timestamp: serverTimestamp() };
}

/** Strip internal Firestore fields and attach sku from document id. */
function toProduct(id: string, data: Record<string, unknown>): RoofingProduct {
   
  const { _combinationKey: _ck, ...rest } = data;
  return { sku: id, ...rest } as RoofingProduct;
}

// ─── pure helper (exported for components) ────────────────────────────────────

export function generateDisplayName(
  product: Pick<RoofingProductInput, 'family' | 'material' | 'color' | 'thickness' | 'width' | 'length'>,
): string {
  const lengthStr = product.length.toFixed(2);
  const widthStr = product.width.toFixed(3);
  const colorPart = product.color ? ` ${product.color}` : '';
  return `${product.family ?? 'TC5'} ${product.material}${colorPart} ${product.thickness}MM X ${widthStr} X ${lengthStr}MT`;
}

// ─── reads ────────────────────────────────────────────────────────────────────

export async function listProducts(filters?: {
  active?: boolean;
  material?: string;
  color?: string;
  searchTerm?: string;
}): Promise<RoofingProduct[]> {
  const constraints: QueryConstraint[] = [orderBy('displayName')];

  if (filters?.active !== undefined) {
    constraints.push(where('active', '==', filters.active));
  }
  if (filters?.material) {
    constraints.push(where('material', '==', filters.material));
  }
  if (filters?.color) {
    constraints.push(where('color', '==', filters.color));
  }

  const snapshot = await getDocs(query(collection(db, COLLECTION), ...constraints));
  let products = snapshot.docs.map(d => toProduct(d.id, d.data() as Record<string, unknown>));

  if (filters?.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    products = products.filter(
      p =>
        p.sku.toLowerCase().includes(term) ||
        p.displayName.toLowerCase().includes(term),
    );
  }

  return products;
}

export async function getProduct(sku: string): Promise<RoofingProduct | null> {
  const snap = await getDoc(doc(db, COLLECTION, sku));
  if (!snap.exists()) return null;
  return toProduct(snap.id, snap.data() as Record<string, unknown>);
}

// ─── writes (all in transactions; reads before writes) ───────────────────────

export async function createProduct(input: RoofingProductInput): Promise<RoofingProduct> {
  // 1. Validate with Zod
  const parsed = RoofingProductSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Datos de producto inválidos.');
  }
  const data = parsed.data;

  // 2. Auto-generate SKU if not provided
  const sku = data.sku ?? generateSKU({
    material: data.material,
    length: data.length,
    color: data.color ?? 'ROJO',
  });

  // 3. Auto-generate displayName if not provided
  const displayName =
    data.displayName ??
    generateDisplayName({
      family: data.family,
      material: data.material,
      color: data.color,
      thickness: data.thickness,
      width: data.width,
      length: data.length,
    });

  // 4. Check combination uniqueness outside tx (Firestore txs don't allow collection queries)
  const comboKey = combinationKey({
    material: data.material,
    color: data.color ?? '',
    thickness: data.thickness,
    width: data.width,
    length: data.length,
  });

  const comboSnap = await getDocs(
    query(collection(db, COLLECTION), where('_combinationKey', '==', comboKey), limit(1)),
  );
  if (!comboSnap.empty) {
    throw new Error('Combinación duplicada: ya existe un producto con ese material, color y medidas.');
  }

  // 5. Transaction: verify SKU uniqueness + write atomically
  const productRef = doc(db, COLLECTION, sku);
  const auditRef = doc(collection(db, AUDIT_COLLECTION));

  return runTransaction(db, async (tx) => {
    // ALL READS FIRST
    const existingSnap = await tx.get(productRef);
    if (existingSnap.exists()) {
      throw new Error(`Producto ya existe: el SKU '${sku}' ya está registrado.`);
    }

    // THEN WRITES
    const payload = {
      displayName,
      family: data.family,
      material: data.material,
      color: data.color ?? '',
      thickness: data.thickness,
      width: data.width,
      length: data.length,
      ...(data.weight !== undefined && { weight: data.weight }),
      unit: data.unit,
      active: data.active,
      avgCost: 0,
      _combinationKey: comboKey,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    tx.set(productRef, payload);
    tx.set(auditRef, buildAudit('CREATE_ROOFING_PRODUCT', sku, `Producto creado: ${displayName}`));

     
    const { _combinationKey: _ck, createdAt: _ca, updatedAt: _ua, ...productFields } = payload;
    return { sku, ...productFields, createdAt: null, updatedAt: null } as RoofingProduct;
  });
}

export async function updateProduct(
  sku: string,
  updates: Partial<RoofingProductInput>,
): Promise<void> {
  if ('sku' in updates) {
    throw new Error('El SKU no se puede modificar una vez creado.');
  }

  const productRef = doc(db, COLLECTION, sku);
  const auditRef = doc(collection(db, AUDIT_COLLECTION));

  await runTransaction(db, async (tx) => {
    // ALL READS FIRST
    const snap = await tx.get(productRef);
    if (!snap.exists()) {
      throw new Error(`Producto no encontrado: SKU '${sku}'.`);
    }

    // THEN WRITES
    tx.update(productRef, { ...updates, updatedAt: serverTimestamp() });
    tx.set(
      auditRef,
      buildAudit('UPDATE_ROOFING_PRODUCT', sku, `Campos actualizados: ${Object.keys(updates).join(', ')}`),
    );
  });
}

export async function deactivateProduct(sku: string, reason: string): Promise<void> {
  const productRef = doc(db, COLLECTION, sku);
  const stockRef = doc(db, 'roofing_stock', sku);
  const auditRef = doc(collection(db, AUDIT_COLLECTION));

  await runTransaction(db, async (tx) => {
    // ALL READS FIRST
    const [productSnap, stockSnap] = await Promise.all([tx.get(productRef), tx.get(stockRef)]);

    if (!productSnap.exists()) {
      throw new Error(`Producto no encontrado: SKU '${sku}'.`);
    }

    const stockQty = stockSnap.exists() ? (stockSnap.data()?.quantity as number ?? 0) : 0;
    const details =
      stockQty > 0
        ? `Desactivado con ${stockQty} unidades en stock. Razón: ${reason}`
        : `Desactivado. Razón: ${reason}`;

    // THEN WRITES
    tx.update(productRef, { active: false, updatedAt: serverTimestamp() });
    tx.set(auditRef, buildAudit('DEACTIVATE_ROOFING_PRODUCT', sku, details));
  });
}

export async function reactivateProduct(sku: string): Promise<void> {
  const productRef = doc(db, COLLECTION, sku);

  await runTransaction(db, async (tx) => {
    // ALL READS FIRST
    const snap = await tx.get(productRef);
    if (!snap.exists()) {
      throw new Error(`Producto no encontrado: SKU '${sku}'.`);
    }

    // THEN WRITES
    tx.update(productRef, { active: true, updatedAt: serverTimestamp() });
  });
}

export async function seedInitialCatalog(): Promise<void> {
  const existing = await listProducts();
  if (existing.length > 0) return;

  const seeds: RoofingProductInput[] = [
    { material: 'UPVC', color: 'ROJO', thickness: 1.5, width: 1.075, length: 6.00, unit: 'PIEZA' },
    { material: 'UPVC', color: 'ROJO', thickness: 1.5, width: 1.075, length: 3.60, unit: 'PIEZA' },
    { material: 'UPVC', color: 'AZUL', thickness: 1.5, width: 1.075, length: 6.00, unit: 'PIEZA' },
    { material: 'UPVC', color: 'AZUL', thickness: 1.5, width: 1.075, length: 3.60, unit: 'PIEZA' },
  ];

  for (const seed of seeds) {
    await createProduct(seed);
  }
}
