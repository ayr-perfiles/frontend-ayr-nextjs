import type { RouteConfig } from '@/core/contracts';

export const drywallRoutes: RouteConfig[] = [
  {
    path: '/admin/inventory',
    component: 'modules/drywall/routes/inventory/page',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    path: '/admin/production',
    component: 'modules/drywall/routes/production/page',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    path: '/admin/operator',
    component: 'modules/drywall/routes/operator/page',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR', 'OPERATOR'],
  },
];
