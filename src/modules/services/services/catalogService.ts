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
import { ServiceProductSchema, type ServiceProductInput } from '../schemas/catalog';
import type { ServiceProduct } from '../types';

const COLLECTION = 'services_catalog';
const AUDIT_COLLECTION = 'audit_logs';

type ServiceAuditAction =
  | 'CREATE_SERVICE_PRODUCT'
  | 'UPDATE_SERVICE_PRODUCT'
  | 'DEACTIVATE_SERVICE_PRODUCT'
  | 'REACTIVATE_SERVICE_PRODUCT';

// ─── helpers ──────────────────────────────────────────────────────────────────

function currentUserEmail(): string {
  return auth.currentUser?.email ?? 'sistema';
}

function buildAudit(action: ServiceAuditAction, entityId: string, details: string) {
  return { action, entityId, userEmail: currentUserEmail(), details, timestamp: serverTimestamp() };
}

function toProduct(id: string, data: Record<string, unknown>): ServiceProduct {
  return { sku: id, ...data } as ServiceProduct;
}

// ─── reads ────────────────────────────────────────────────────────────────────

export async function listProducts(filters?: {
  active?: boolean;
  searchTerm?: string;
}): Promise<ServiceProduct[]> {
  const constraints: QueryConstraint[] = [orderBy('displayName')];

  if (filters?.active !== undefined) constraints.push(where('active', '==', filters.active));

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

export async function getProduct(sku: string): Promise<ServiceProduct | null> {
  const snap = await getDoc(doc(db, COLLECTION, sku));
  if (!snap.exists()) return null;
  return toProduct(snap.id, snap.data() as Record<string, unknown>);
}

// ─── writes (all in transactions) ──────────────────────────────────────────

export async function createProduct(input: ServiceProductInput): Promise<ServiceProduct> {
  const parsed = ServiceProductSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Datos de servicio inválidos.');
  }
  const data = parsed.data;
  const sku = data.sku;

  const productRef = doc(db, COLLECTION, sku);
  const auditRef = doc(collection(db, AUDIT_COLLECTION));

  return runTransaction(db, async (tx) => {
    const existingSnap = await tx.get(productRef);
    if (existingSnap.exists()) {
      throw new Error(`Servicio ya existe: el SKU '${sku}' ya está registrado.`);
    }

    const payload = {
      displayName: data.displayName,
      description: data.description ?? '',
      unit: data.unit,
      pricePerUnit: data.pricePerUnit ?? 0,
      active: data.active,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    tx.set(productRef, payload);
    tx.set(auditRef, buildAudit('CREATE_SERVICE_PRODUCT', sku, `Servicio creado: ${data.displayName}`));

    const { createdAt: _ca, updatedAt: _ua, ...productFields } = payload;
    return { sku, ...productFields, createdAt: null, updatedAt: null } as ServiceProduct;
  });
}

export async function updateProduct(sku: string, updates: Partial<ServiceProductInput>): Promise<void> {
  if ('sku' in updates) {
    throw new Error('El SKU no se puede modificar una vez creado.');
  }

  const productRef = doc(db, COLLECTION, sku);
  const auditRef = doc(collection(db, AUDIT_COLLECTION));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(productRef);
    if (!snap.exists()) {
      throw new Error(`Servicio no encontrado: SKU '${sku}'.`);
    }
    tx.update(productRef, { ...updates, updatedAt: serverTimestamp() });
    tx.set(
      auditRef,
      buildAudit('UPDATE_SERVICE_PRODUCT', sku, `Campos actualizados: ${Object.keys(updates).join(', ')}`),
    );
  });
}

export async function deactivateProduct(sku: string, reason: string): Promise<void> {
  const productRef = doc(db, COLLECTION, sku);
  const auditRef = doc(collection(db, AUDIT_COLLECTION));

  await runTransaction(db, async (tx) => {
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists()) {
      throw new Error(`Servicio no encontrado: SKU '${sku}'.`);
    }
    tx.update(productRef, { active: false, updatedAt: serverTimestamp() });
    tx.set(auditRef, buildAudit('DEACTIVATE_SERVICE_PRODUCT', sku, `Desactivado. Razón: ${reason}`));
  });
}

export async function reactivateProduct(sku: string): Promise<void> {
  const productRef = doc(db, COLLECTION, sku);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(productRef);
    if (!snap.exists()) {
      throw new Error(`Servicio no encontrado: SKU '${sku}'.`);
    }
    tx.update(productRef, { active: true, updatedAt: serverTimestamp() });
  });
}
