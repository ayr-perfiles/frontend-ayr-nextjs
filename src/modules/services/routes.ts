import type { RouteConfig } from '@/core/contracts';

export const servicesRoutes: RouteConfig[] = [
  {
    path: '/admin/services/catalog',
    component: 'modules/services/routes/catalog/page',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR'],
  },
];

