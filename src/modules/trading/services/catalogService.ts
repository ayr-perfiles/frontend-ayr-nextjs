import { db, auth } from '@/lib/firebase/clientApp';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  QueryConstraint,
} from 'firebase/firestore';
import { TradingProductSchema, type TradingProductInput } from '../schemas/catalog';
import { generateDisplayName as buildDisplayName } from '../domain/skuGenerator';
import type { TradingProduct, TradingCategory } from '../types';

const COLLECTION = 'trading_catalog';
const AUDIT_COLLECTION = 'audit_logs';

type TradingAuditAction =
  | 'CREATE_TRADING_PRODUCT'
  | 'UPDATE_TRADING_PRODUCT'
  | 'DEACTIVATE_TRADING_PRODUCT'
  | 'REACTIVATE_TRADING_PRODUCT';

// ─── helpers ──────────────────────────────────────────────────────────────────

function currentUserEmail(): string {
  return auth.currentUser?.email ?? 'sistema';
}

function buildAudit(action: TradingAuditAction, entityId: string, details: string) {
  return { action, entityId, userEmail: currentUserEmail(), details, timestamp: serverTimestamp() };
}

function toProduct(id: string, data: Record<string, unknown>): TradingProduct {
  return { sku: id, ...data } as TradingProduct;
}

// ─── pure helper (exported for components) ────────────────────────────────────

export function generateDisplayName(
  product: { category: TradingCategory; color?: string; spec?: string },
): string {
  return buildDisplayName(product);
}

// ─── reads ────────────────────────────────────────────────────────────────────

export async function listProducts(filters?: {
  active?: boolean;
  category?: TradingCategory;
  searchTerm?: string;
}): Promise<TradingProduct[]> {
  const constraints: QueryConstraint[] = [orderBy('displayName')];

  if (filters?.active !== undefined) constraints.push(where('active', '==', filters.active));
  if (filters?.category) constraints.push(where('category', '==', filters.category));

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

export async function getProduct(sku: string): Promise<TradingProduct | null> {
  const snap = await getDoc(doc(db, COLLECTION, sku));
  if (!snap.exists()) return null;
  return toProduct(snap.id, snap.data() as Record<string, unknown>);
}

// ─── writes (all in transactions; reads before writes) ───────────────────────

export async function createProduct(input: TradingProductInput): Promise<TradingProduct> {
  const parsed = TradingProductSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Datos de producto inválidos.');
  }
  const data = parsed.data;
  const sku = data.sku;

  const displayName = data.displayName || generateDisplayName({
    category: data.category,
    color: data.color,
    spec: data.spec
  });

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
      category: data.category,
      color: data.color ?? '',
      spec: data.spec ?? '',
      unit: data.unit,
      active: data.active,
      avgCost: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    tx.set(productRef, payload);
    tx.set(auditRef, buildAudit('CREATE_TRADING_PRODUCT', sku, `Producto creado: ${displayName}`));

    const { createdAt: _ca, updatedAt: _ua, ...productFields } = payload;
    return { sku, ...productFields, createdAt: null, updatedAt: null } as TradingProduct;
  });
}

export async function updateProduct(sku: string, updates: Partial<TradingProductInput>): Promise<void> {
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
      buildAudit('UPDATE_TRADING_PRODUCT', sku, `Campos actualizados: ${Object.keys(updates).join(', ')}`),
    );
  });
}

export async function deactivateProduct(sku: string, reason: string): Promise<void> {
  const productRef = doc(db, COLLECTION, sku);
  const stockRef = doc(db, 'trading_stock', sku);
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
    tx.set(auditRef, buildAudit('DEACTIVATE_TRADING_PRODUCT', sku, details));
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
