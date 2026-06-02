import type { BusinessLineModule } from '@/core/contracts';
import { roofingInventoryEngine } from './engines/inventory';
import { RoofingProductSchema } from './schemas/catalog';
import { roofingRoutes } from './routes';
import { roofingSidebarItems } from './config/sidebar';
import { roofingPermissions } from './config/permissions';

export const roofingModule: BusinessLineModule = {
  id: 'roofing',
  displayName: 'Coberturas PVC',
  icon: 'Home',

  productionEngine: undefined, // No production for PVC anymore
  inventoryEngine: roofingInventoryEngine,
  catalogSchema: RoofingProductSchema,

  routes: roofingRoutes,
  sidebarItems: roofingSidebarItems,
  permissions: roofingPermissions,
};
