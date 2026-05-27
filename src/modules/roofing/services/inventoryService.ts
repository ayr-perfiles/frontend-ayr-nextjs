import { db } from '@/lib/firebase/clientApp';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  QueryConstraint,
  Timestamp,
} from 'firebase/firestore';
import type { RoofingProduct, RoofingStock, RoofingStockMovement } from '../types';

const CATALOG_COL = 'roofing_catalog';
const STOCK_COL = 'roofing_stock';
const MOVEMENTS_COL = 'roofing_stock_movements';

export interface InventoryItem extends RoofingStock {
  product: RoofingProduct | null;
}

export interface InventoryFilters {
  searchTerm?: string;
  material?: string;
  color?: string;
  showOnlyWithStock?: boolean;
  showOnlyNegative?: boolean;
}

export interface StockMovement extends RoofingStockMovement {
  id: string;
}

// ─── reads ────────────────────────────────────────────────────────────────────

export async function fetchInventory(filters: InventoryFilters): Promise<InventoryItem[]> {
  // 1. Load all stock docs
  const stockSnap = await getDocs(collection(db, STOCK_COL));
  const stockMap = new Map<string, RoofingStock>();
  for (const d of stockSnap.docs) {
    stockMap.set(d.id, { sku: d.id, ...d.data() } as RoofingStock);
  }

  // 2. Load catalog to enrich items
  const catalogConstraints: QueryConstraint[] = [orderBy('displayName')];
  if (filters.material) {
    catalogConstraints.push(where('material', '==', filters.material));
  }
  if (filters.color) {
    catalogConstraints.push(where('color', '==', filters.color));
  }

  const catalogSnap = await getDocs(query(collection(db, CATALOG_COL), ...catalogConstraints));
  let products = catalogSnap.docs.map(
    d => ({ sku: d.id, ...d.data() } as RoofingProduct),
  );

  // 3. Client-side search filter
  if (filters.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    products = products.filter(
      p =>
        p.sku.toLowerCase().includes(term) ||
        p.displayName.toLowerCase().includes(term),
    );
  }

  // 4. Build enriched list (one row per cataloged product)
  let items: InventoryItem[] = products.map(product => {
    const stock = stockMap.get(product.sku);
    const quantity = stock?.quantity ?? 0;
    const avgCost = stock?.avgCost ?? product.avgCost ?? 0;
    return {
      sku: product.sku,
      productName: product.displayName,
      quantity,
      avgCost,
      totalValue: Number((quantity * avgCost).toFixed(2)),
      lastUpdate: stock?.lastUpdate ?? null,
      product,
    };
  });

  // 5. Apply stock filters
  if (filters.showOnlyWithStock) {
    items = items.filter(i => i.quantity > 0);
  }
  if (filters.showOnlyNegative) {
    items = items.filter(i => i.quantity < 0);
  }

  return items;
}

export async function getStock(sku: string): Promise<RoofingStock | null> {
  const snap = await getDoc(doc(db, STOCK_COL, sku));
  if (!snap.exists()) return null;
  return { sku: snap.id, ...snap.data() } as RoofingStock;
}

export async function getStockMovements(
  sku: string,
  filters?: { startDate?: Date; endDate?: Date; type?: string },
): Promise<StockMovement[]> {
  const constraints: QueryConstraint[] = [
    where('sku', '==', sku),
    orderBy('createdAt', 'desc'),
  ];

  if (filters?.type) {
    constraints.push(where('type', '==', filters.type));
  }
  if (filters?.startDate) {
    constraints.push(where('createdAt', '>=', Timestamp.fromDate(filters.startDate)));
  }
  if (filters?.endDate) {
    const end = new Date(filters.endDate);
    end.setHours(23, 59, 59, 999);
    constraints.push(where('createdAt', '<=', Timestamp.fromDate(end)));
  }

  const snap = await getDocs(query(collection(db, MOVEMENTS_COL), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as StockMovement));
}

export async function fetchInventoryKpis(): Promise<{
  totalProducts: number;
  totalPieces: number;
  negativeCount: number;
}> {
  const [catalogSnap, stockSnap] = await Promise.all([
    getDocs(query(collection(db, CATALOG_COL), where('active', '==', true))),
    getDocs(collection(db, STOCK_COL)),
  ]);

  const totalProducts = catalogSnap.size;
  let totalPieces = 0;
  let negativeCount = 0;

  for (const d of stockSnap.docs) {
    const qty = (d.data().quantity as number) ?? 0;
    totalPieces += qty;
    if (qty < 0) negativeCount++;
  }

  return { totalProducts, totalPieces, negativeCount };
}
