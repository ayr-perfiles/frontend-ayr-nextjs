import type { RouteConfig } from '@/core/contracts';

export const drywallRoutes: RouteConfig[] = [
  {
    path: '/admin/lines/drywall/catalog',
    component: 'modules/drywall/routes/catalog/page',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    path: '/admin/lines/drywall/production',
    component: 'modules/drywall/routes/production/page',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    path: '/admin/lines/drywall/operator',
    component: 'modules/drywall/routes/operator/page',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR', 'OPERATOR'],
  },
];
