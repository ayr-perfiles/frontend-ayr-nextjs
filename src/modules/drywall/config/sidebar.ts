import type { MenuItem } from '@/core/contracts';

export const drywallSidebarItems: MenuItem[] = [
  {
    label: 'Catálogo',
    href: '/admin/lines/drywall/catalog',
    icon: 'BookOpen',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Producción',
    href: '/admin/lines/drywall/production',
    icon: 'Factory',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Terminal Móvil',
    href: '/admin/lines/drywall/operator',
    icon: 'Smartphone',
    roles: ['ADMIN', 'SUPERVISOR', 'OPERATOR'],
  },
];
