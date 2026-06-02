import type { MenuItem } from '@/core/contracts';

export const roofingSidebarItems: MenuItem[] = [
  {
    label: 'Catálogo',
    href: '/admin/lines/roofing/catalog',
    icon: 'BookOpen',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Inventario',
    href: '/admin/lines/roofing/inventory',
    icon: 'Warehouse',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Ventas',
    href: '/admin/lines/roofing/sales',
    icon: 'ShoppingCart',
    roles: ['ADMIN', 'SUPERVISOR', 'OPERATOR'],
  },
];
