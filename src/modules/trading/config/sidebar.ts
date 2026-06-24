import type { MenuItem } from '@/core/contracts';

export const tradingSidebarItems: MenuItem[] = [
  {
    label: 'Catálogo',
    href: '/admin/lines/trading/catalog',
    icon: 'BookOpen',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Inventario',
    href: '/admin/lines/trading/inventory',
    icon: 'Warehouse',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
];
