import type { RouteConfig } from '@/core/contracts';

export const tradingRoutes: RouteConfig[] = [
  {
    path: '/admin/lines/trading/catalog',
    component: 'modules/trading/routes/catalog/page',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    path: '/admin/lines/trading/inventory',
    component: 'modules/trading/routes/inventory/page',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR'],
  },
];

