import type { MenuItem } from '@/core/contracts';

export const drywallSidebarItems: MenuItem[] = [
  {
    label: 'Inventario',
    href: '/admin/inventory',
    icon: 'Database',
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
