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
import { MetallicProductSchema, type MetallicProductInput } from '../schemas/catalog';
import { generateSKU, combinationKey } from '../domain/skuGenerator';
import type { MetallicProduct } from '../types';

const COLLECTION = 'metallic_roofing_catalog';
const AUDIT_COLLECTION = 'audit_logs';

type MetallicAuditAction =
  | 'CREATE_METALLIC_PRODUCT'
  | 'UPDATE_METALLIC_PRODUCT'
  | 'DEACTIVATE_METALLIC_PRODUCT'
  | 'REACTIVATE_METALLIC_PRODUCT';

// ─── helpers ──────────────────────────────────────────────────────────────────

function currentUserEmail(): string {
  return auth.currentUser?.email ?? 'sistema';
}

function buildAudit(action: MetallicAuditAction, entityId: string, details: string) {
  return { action, entityId, userEmail: currentUserEmail(), details, timestamp: serverTimestamp() };
}

function toProduct(id: string, data: Record<string, unknown>): MetallicProduct {
  const { _combinationKey: _ck, ...rest } = data;
  return { sku: id, ...rest } as MetallicProduct;
}

// ─── pure helper (exported for components) ────────────────────────────────────

export function generateDisplayName(
  product: Pick<MetallicProductInput, 'family' | 'finish' | 'thickness' | 'width' | 'length'>,
): string {
  const widthPart = product.width ? ` X ${product.width.toFixed(3)}` : '';
  const lengthPart = product.length ? ` X ${product.length.toFixed(2)}MT` : '';
  return `${product.family} ${product.finish} ${product.thickness}MM${widthPart}${lengthPart}`.trim();
}

// ─── reads ────────────────────────────────────────────────────────────────────

export async function listProducts(filters?: {
  active?: boolean;
  family?: string;
  finish?: string;

  searchTerm?: string;
}): Promise<MetallicProduct[]> {
  const constraints: QueryConstraint[] = [orderBy('displayName')];

  if (filters?.active !== undefined) constraints.push(where('active', '==', filters.active));
  if (filters?.family) constraints.push(where('family', '==', filters.family));
  if (filters?.finish) constraints.push(where('finish', '==', filters.finish));


  const snapshot = await getDocs(query(collection(db, COLLECTION), ...constraints));
  let products = snapshot.docs.map((d) => toProduct(d.id, d.data() as Record<string, unknown>));

  if (filters?.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    products = products.filter(
      (p) => p.sku.toLowerCase().includes(term) || p.displayName.toLowerCase().includes(term),
    );
  }

  return products;
}

export async function getProduct(sku: string): Promise<MetallicProduct | null> {
  const snap = await getDoc(doc(db, COLLECTION, sku));
  if (!snap.exists()) return null;
  return toProduct(snap.id, snap.data() as Record<string, unknown>);
}

// ─── writes (all in transactions; reads before writes) ───────────────────────

export async function createProduct(input: MetallicProductInput): Promise<MetallicProduct> {
  const parsed = MetallicProductSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Datos de producto inválidos.');
  }
  const data = parsed.data;

  // SKU manual recomendado; autogenerado solo si no llega.
  const sku =
    data.sku ??
    generateSKU({
      family: data.family,
      finish: data.finish,
      thickness: data.thickness,
      length: data.length,
    });

  const displayName =
    data.displayName ??
    generateDisplayName({
      family: data.family,
      finish: data.finish,
      thickness: data.thickness,
      width: data.width,
      length: data.length,
    });

  const comboKey = combinationKey({
    family: data.family,
    finish: data.finish,
    thickness: data.thickness,
    width: data.width,
    length: data.length,
  });

  // Unicidad por combinación FUERA de la tx (Firestore no permite queries dentro de tx).
  const comboSnap = await getDocs(
    query(collection(db, COLLECTION), where('_combinationKey', '==', comboKey), limit(1)),
  );
  if (!comboSnap.empty) {
    throw new Error('Combinación duplicada: ya existe un producto con esa familia, acabado y medidas.');
  }

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
      finish: data.finish,

      thickness: data.thickness,
      ...(data.width !== undefined && { width: data.width }),
      ...(data.length !== undefined && { length: data.length }),
      unit: data.unit,
      active: data.active,
      avgCost: 0,
      ...(data.widthMm !== undefined && { widthMm: data.widthMm }),
      ...(data.densityFactor !== undefined && { densityFactor: data.densityFactor }),
      ...(data.metaSource !== undefined && { metaSource: data.metaSource }),
      _combinationKey: comboKey,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    tx.set(productRef, payload);
    tx.set(auditRef, buildAudit('CREATE_METALLIC_PRODUCT', sku, `Producto creado: ${displayName}`));

    const { _combinationKey: _ck, createdAt: _ca, updatedAt: _ua, ...productFields } = payload;
    return { sku, ...productFields, createdAt: null, updatedAt: null } as MetallicProduct;
  });
}

export async function updateProduct(sku: string, updates: Partial<MetallicProductInput>): Promise<void> {
  if ('sku' in updates) {
    throw new Error('El SKU no se puede modificar una vez creado.');
  }

  const productRef = doc(db, COLLECTION, sku);
  const auditRef = doc(collection(db, AUDIT_COLLECTION));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(productRef);
    if (!snap.exists()) {
      throw new Error(`Producto no encontrado: SKU '${sku}'.`);
    }
    tx.update(productRef, { ...updates, updatedAt: serverTimestamp() });
    tx.set(
      auditRef,
      buildAudit('UPDATE_METALLIC_PRODUCT', sku, `Campos actualizados: ${Object.keys(updates).join(', ')}`),
    );
  });
}

export async function deactivateProduct(sku: string, reason: string): Promise<void> {
  const productRef = doc(db, COLLECTION, sku);
  const stockRef = doc(db, 'metallic_roofing_stock', sku);
  const auditRef = doc(collection(db, AUDIT_COLLECTION));

  await runTransaction(db, async (tx) => {
    const [productSnap, stockSnap] = await Promise.all([tx.get(productRef), tx.get(stockRef)]);
    if (!productSnap.exists()) {
      throw new Error(`Producto no encontrado: SKU '${sku}'.`);
    }
    const stockQty = stockSnap.exists() ? ((stockSnap.data()?.quantity as number) ?? 0) : 0;
    const details =
      stockQty > 0
        ? `Desactivado con ${stockQty} unidades en stock. Razón: ${reason}`
        : `Desactivado. Razón: ${reason}`;
    tx.update(productRef, { active: false, updatedAt: serverTimestamp() });
    tx.set(auditRef, buildAudit('DEACTIVATE_METALLIC_PRODUCT', sku, details));
  });
}

export async function reactivateProduct(sku: string): Promise<void> {
  const productRef = doc(db, COLLECTION, sku);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(productRef);
    if (!snap.exists()) {
      throw new Error(`Producto no encontrado: SKU '${sku}'.`);
    }
    tx.update(productRef, { active: true, updatedAt: serverTimestamp() });
  });
}
