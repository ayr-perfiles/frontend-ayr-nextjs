import type { RouteConfig } from '@/core/contracts';

export const metallicRoofingRoutes: RouteConfig[] = [
  {
    path: '/admin/lines/metallic-roofing/inventory',
    component: 'components/inventory/InventoryPage',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR', 'OPERATOR'],
  },
  {
    path: '/admin/lines/metallic-roofing/catalog',
    component: 'components/catalog/CatalogPage',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR'],
  },
];
