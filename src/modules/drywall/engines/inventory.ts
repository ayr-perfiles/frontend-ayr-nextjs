import { db } from '@/lib/firebase/clientApp';
import { doc, getDoc } from 'firebase/firestore';
import type {
  InventoryEngine,
  InventoryFilters,
  InventoryView,
  StockMetrics,
} from '@/core/contracts';
import { fetchInventory } from '../services/inventoryService';

const DEFAULT_PAGE_SIZE = 10;

export const drywallInventoryEngine: InventoryEngine = {
  async getInventoryView(filters: InventoryFilters): Promise<InventoryView> {
    const result = await fetchInventory({
      pageSize: DEFAULT_PAGE_SIZE,
      statusFilter: filters.status ?? 'ALL',
      searchTerm: filters.searchTerm ?? '',
      startDate: filters.startDate,
      endDate: filters.endDate,
      direction: 'first',
      cursorDoc: null,
      page: 0,
    });

    return {
      items: result.coils,
      totalCount: result.totalCount ?? 0,
    };
  },

  async calculateMetrics(sku: string): Promise<StockMetrics> {
    const stockSnap = await getDoc(doc(db, 'inventory_stock', sku));

    if (!stockSnap.exists()) {
      return { totalQuantity: 0, totalValue: 0 };
    }

    const data = stockSnap.data()!;
    const totalQuantity = Number(data.totalQuantity ?? 0);
    const lastCostPerPiece = Number(data.lastCostPerPiece ?? 0);

    return {
      totalQuantity,
      totalValue: Number((totalQuantity * lastCostPerPiece).toFixed(2)),
    };
  },
};
