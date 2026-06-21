import type { BusinessLineModule } from '@/core/contracts';
import { metallicRoofingInventoryEngine } from './engines/inventory';
import { MetallicProductSchema } from './schemas/catalog';
import { metallicRoofingRoutes } from './routes';
import { metallicRoofingSidebarItems } from './config/sidebar';
import { metallicRoofingPermissions } from './config/permissions';

/**
 * Línea de mayor ingreso (74.6% en mar-2026). v1: catálogo + inventario + ventas.
 * `productionEngine` se omite a propósito (conformado desde bobina = sprint posterior);
 * esto requiere que BusinessLineModule.productionEngine sea opcional (ver patch del core).
 */
export const metallicRoofingModule: BusinessLineModule = {
  id: 'metallic-roofing',
  displayName: 'Coberturas Aluzinc',
  icon: 'Layers',

  inventoryEngine: metallicRoofingInventoryEngine,
  catalogSchema: MetallicProductSchema,

  routes: metallicRoofingRoutes,
  sidebarItems: metallicRoofingSidebarItems,
  permissions: metallicRoofingPermissions,
};
