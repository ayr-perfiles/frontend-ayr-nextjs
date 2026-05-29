import type { MenuItem } from '@/core/contracts';

export const tradingSidebarItems: MenuItem[] = [
  {
    label: 'Catálogo',
    href: '/admin/trading/catalog',
    icon: 'BookOpen',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Inventario',
    href: '/admin/trading/inventory',
    icon: 'Warehouse',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
];
