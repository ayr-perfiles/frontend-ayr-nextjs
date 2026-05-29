import type { MenuItem } from '@/core/contracts';

export const roofingSidebarItems: MenuItem[] = [
  {
    label: 'Catálogo',
    href: '/admin/roofing/catalog',
    icon: 'BookOpen',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Inventario',
    href: '/admin/roofing/inventory',
    icon: 'Warehouse',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Ventas',
    href: '/admin/roofing/sales',
    icon: 'ShoppingCart',
    roles: ['ADMIN', 'SUPERVISOR', 'OPERATOR'],
  },
];
