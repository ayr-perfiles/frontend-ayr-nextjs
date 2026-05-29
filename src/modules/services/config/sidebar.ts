import type { MenuItem } from '@/core/contracts';

export const servicesSidebarItems: MenuItem[] = [
  {
    label: 'Catálogo',
    href: '/admin/services/catalog',
    icon: 'Wrench',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
];
