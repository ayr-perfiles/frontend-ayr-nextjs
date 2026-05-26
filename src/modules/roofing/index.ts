import type { BusinessLineModule } from '@/core/contracts';
import { roofingProductionEngine } from './engines/production';
import { roofingInventoryEngine } from './engines/inventory';
import { RoofingProductSchema } from './schemas/catalog';
import { roofingRoutes } from './routes';
import { roofingSidebarItems } from './config/sidebar';
import { roofingPermissions } from './config/permissions';

export const roofingModule: BusinessLineModule = {
  id: 'roofing',
  displayName: 'Coberturas PVC',
  icon: 'Home',

  productionEngine: roofingProductionEngine,
  inventoryEngine: roofingInventoryEngine,
  catalogSchema: RoofingProductSchema,

  routes: roofingRoutes,
  sidebarItems: roofingSidebarItems,
  permissions: roofingPermissions,
};
