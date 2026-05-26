import type { RouteConfig } from '@/core/contracts';

export const roofingRoutes: RouteConfig[] = [
  {
    path: '/admin/roofing/catalog',
    component: 'modules/roofing/routes/catalog/page',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    path: '/admin/roofing/inventory',
    component: 'modules/roofing/routes/inventory/page',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    path: '/admin/roofing/sales',
    component: 'modules/roofing/routes/sales/page',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR', 'OPERATOR'],
  },
];
