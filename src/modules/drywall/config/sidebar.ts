import type { MenuItem } from '@/core/contracts';

export const drywallSidebarItems: MenuItem[] = [
  {
    label: 'Catálogo',
    href: '/admin/catalog',
    icon: 'BookOpen',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Inventario',
    href: '/admin/inventory',
    icon: 'Warehouse',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Producción',
    href: '/admin/production',
    icon: 'Factory',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Terminal Móvil',
    href: '/admin/operator',
    icon: 'Smartphone',
    roles: ['ADMIN', 'SUPERVISOR', 'OPERATOR'],
  },
];
