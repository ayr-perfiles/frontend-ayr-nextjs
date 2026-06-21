import type { InventoryEngine, InventoryFilters, InventoryView, StockMetrics } from '@/core/contracts';
import { fetchInventory, getStock } from '../services/inventoryService';

/** Adapta los services de aluzinc al contrato InventoryEngine del core. */
export const metallicRoofingInventoryEngine: InventoryEngine = {
  async getInventoryView(filters: InventoryFilters): Promise<InventoryView> {
    const items = await fetchInventory({ searchTerm: filters.searchTerm });
    const totalValue = items.reduce((s, i) => s + i.totalValue, 0);
    const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);
    return {
      items,
      totalCount: items.length,
      metrics: { totalQuantity, totalValue: Number(totalValue.toFixed(2)) },
    };
  },

  async calculateMetrics(sku: string): Promise<StockMetrics> {
    const stock = await getStock(sku);
    return {
      totalQuantity: stock?.quantity ?? 0,
      totalValue: stock?.totalValue ?? 0,
    };
  },
};
