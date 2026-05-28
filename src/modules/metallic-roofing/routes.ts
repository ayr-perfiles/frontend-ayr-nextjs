import type { RouteConfig } from '@/core/contracts';

export const metallicRoofingRoutes: RouteConfig[] = [
  {
    path: '/admin/metallic-roofing',
    component: 'components/inventory/InventoryPage',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR', 'OPERATOR'],
  },
  {
    path: '/admin/metallic-roofing/catalog',
    component: 'components/catalog/CatalogPage',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR'],
  },
];
