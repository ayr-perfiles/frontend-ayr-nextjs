import type { BusinessLineModule } from '@/core/contracts';
import { TradingProductSchema } from './schemas/catalog';
import { tradingRoutes } from './routes';
import { tradingSidebarItems } from './config/sidebar';
import { tradingPermissions } from './config/permissions';
import { tradingInventoryEngine } from './engines/inventory';

export const tradingModule: BusinessLineModule = {
  id: 'trading',
  displayName: 'Reventa / Compra-venta',
  icon: 'ShoppingCart',
  catalogSchema: TradingProductSchema,
  routes: tradingRoutes,
  sidebarItems: tradingSidebarItems,
  permissions: tradingPermissions,
  inventoryEngine: tradingInventoryEngine,
  productionEngine: undefined, // No production for trading
};
