import type { BusinessLineModule } from '@/core/contracts';
import { ServiceProductSchema } from './schemas/catalog';
import { servicesRoutes } from './routes';
import { servicesSidebarItems } from './config/sidebar';
import { servicesPermissions } from './config/permissions';

export const servicesModule: BusinessLineModule = {
  id: 'services',
  displayName: 'Servicios',
  icon: 'Wrench',
  catalogSchema: ServiceProductSchema,
  routes: servicesRoutes,
  sidebarItems: servicesSidebarItems,
  permissions: servicesPermissions,
  // No production and no inventory for services
  productionEngine: undefined,
  inventoryEngine: undefined,
};
