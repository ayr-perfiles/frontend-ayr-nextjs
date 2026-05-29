import type { InventoryEngine } from '@/core/contracts';
import { fetchInventory, getStock, getStockMovements } from '../services/inventoryService';
import { adjustStock } from '../services/stockAdjustmentService';

export const tradingInventoryEngine: InventoryEngine = {
  fetchInventory: async (filters) => {
    // Adapt filters if necessary
    return fetchInventory(filters as any);
  },
  getStock: async (sku) => getStock(sku),
  getStockMovements: async (sku, filters) => getStockMovements(sku, filters),
  adjustStock: async (input) => adjustStock(input as any),
};
