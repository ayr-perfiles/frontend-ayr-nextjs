import type { RouteConfig } from '@/core/contracts';

export const tradingRoutes: RouteConfig[] = [
  {
    path: '/admin/trading/catalog',
    component: 'modules/trading/routes/catalog/page',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    path: '/admin/trading/inventory',
    component: 'modules/trading/routes/inventory/page',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR'],
  },
];

