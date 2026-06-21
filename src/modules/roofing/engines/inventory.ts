import { db } from '@/lib/firebase/clientApp';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import type {
  InventoryEngine,
  InventoryFilters,
  InventoryView,
  StockMetrics,
} from '@/core/contracts';
import type { RoofingProduct, RoofingStock } from '../types';

export const roofingInventoryEngine: InventoryEngine = {
  async getInventoryView(filters: InventoryFilters): Promise<InventoryView> {
    const catalogRef = collection(db, 'roofing_catalog');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const constraints: any[] = [];
    if (filters.status === 'ACTIVE') {
      constraints.push(where('isActive', '==', true));
    } else if (filters.status === 'INACTIVE') {
      constraints.push(where('isActive', '==', false));
    }

    const q = constraints.length > 0 ? query(catalogRef, ...constraints) : query(catalogRef);
    const snapshot = await getDocs(q);

    let items: RoofingProduct[] = snapshot.docs.map(
      d => ({ sku: d.id, ...d.data() } as RoofingProduct),
    );

    // Full-text search client-side (Algolia se usará en fase posterior)
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      items = items.filter(
        p =>
          p.sku.toLowerCase().includes(term) ||
          p.displayName.toLowerCase().includes(term),
      );
    }

    return { items, totalCount: items.length };
  },

  async calculateMetrics(sku: string): Promise<StockMetrics> {
    const stockSnap = await getDoc(doc(db, 'roofing_stock', sku));

    if (!stockSnap.exists()) {
      return { totalQuantity: 0, totalValue: 0 };
    }

    const data = stockSnap.data() as RoofingStock;
    const totalQuantity = Number(data.quantity ?? 0);
    const totalValue = Number(
      (data.totalValue ?? totalQuantity * data.avgCost).toFixed(2),
    );

    return { totalQuantity, totalValue };
  },
};
