import type { InventoryEngine } from '@/core/contracts';
import { fetchInventory, getStock, getStockMovements } from '../services/inventoryService';
import { adjustStock } from '../services/stockAdjustmentService';

export const tradingInventoryEngine: InventoryEngine = {
  getInventoryView: async (filters) => {
    const result = await fetchInventory(filters as any);
    return {
      items: result,
      totalCount: result.length,
    };
  },
  calculateMetrics: async (sku) => {
    const stock = await getStock(sku);
    if (!stock) return { totalQuantity: 0, totalValue: 0 };
    return {
      totalQuantity: stock.quantity || 0,
      totalValue: stock.totalValue || 0,
    };
  },
};
