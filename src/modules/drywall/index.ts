import type { BusinessLineModule } from '@/core/contracts';
import { drywallProductionEngine } from './engines/production';
import { drywallInventoryEngine } from './engines/inventory';
import { drywallCatalogSchema } from './schemas/catalog';
import { drywallRoutes } from './routes';
import { drywallSidebarItems } from './config/sidebar';
import { drywallPermissions } from './config/permissions';

export const drywallModule: BusinessLineModule = {
  id: 'drywall',
  displayName: 'Drywall (Perfilería)',
  icon: 'Factory',

  productionEngine: drywallProductionEngine,
  inventoryEngine: drywallInventoryEngine,
  catalogSchema: drywallCatalogSchema,

  routes: drywallRoutes,
  sidebarItems: drywallSidebarItems,
  permissions: drywallPermissions,
};
