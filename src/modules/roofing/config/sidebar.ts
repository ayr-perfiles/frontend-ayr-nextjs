import type { MenuItem } from '@/core/contracts';

export const roofingSidebarItems: MenuItem[] = [
  {
    label: 'Catálogo PVC',
    href: '/admin/roofing/catalog',
    icon: 'Package',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Inventario PVC',
    href: '/admin/roofing/inventory',
    icon: 'Warehouse',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Ventas PVC',
    href: '/admin/roofing/sales',
    icon: 'ShoppingCart',
    roles: ['ADMIN', 'SUPERVISOR', 'OPERATOR'],
  },
];
