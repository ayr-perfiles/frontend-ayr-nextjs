import { businessLines } from '@/core/registry/businessLineRegistry';
import type { UserRole } from '@/context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────

export type NavBadge = { kind: 'warn' | 'danger'; count: number };

export type NavLeafItem = {
  id: string;
  label: string;
  icon: string;
  path: string;
  badge?: NavBadge;
  roles?: UserRole[];
};

export type NavGroupItem = {
  id: string;
  label: string;
  icon: string;
  material?: 'acero' | 'pvc';
  children: NavLeafItem[];
};

export type NavSection = {
  cross: NavLeafItem[];
  rawMaterial: NavLeafItem[];
  lines: NavGroupItem[];
  admin: NavLeafItem[];
};

export type RouteTitle = {
  title: string;
  crumb: string[] | null;
};

// ── Material map ──────────────────────────────────────────────────────────

const MATERIAL_MAP: Record<string, 'acero' | 'pvc'> = {
  drywall: 'acero',
  'metallic-roofing': 'acero',
  roofing: 'pvc',
  // trading / services: sin materia prima
};

// ── Cross-line items ──────────────────────────────────────────────────────
// Badges hardcoded en 0; los componentes reales los inyectarán via props.

const CROSS_ITEMS: NavLeafItem[] = [
  { id: 'dashboard', label: 'Panel',    icon: 'LayoutDashboard', path: '/admin' },
  { id: 'sales',     label: 'Ventas',   icon: 'Receipt',         path: '/admin/sales' },
  { id: 'customers', label: 'Clientes', icon: 'Users',           path: '/admin/customers' },
  { id: 'reports',   label: 'Reportes', icon: 'BarChart3',       path: '/admin/reports' },
];

const RAW_MATERIAL_ITEMS: NavLeafItem[] = [
  { id: 'coils-inv', label: 'Inventario Bobinas', icon: 'Layers', path: '/admin/coils' },
  { id: 'coils-fin', label: 'Acabados Bobina',    icon: 'Tag',    path: '/admin/coils/finishes' },
];

// ── Admin items (ADMIN only) ──────────────────────────────────────────────

const ADMIN_ITEMS: NavLeafItem[] = [
  { id: 'users',    label: 'Usuarios',      icon: 'UserCog',    path: '/admin/users',    roles: ['ADMIN'] },
  { id: 'audit',    label: 'Auditoría',     icon: 'ScrollText', path: '/admin/audit',    roles: ['ADMIN'] },
  { id: 'settings', label: 'Configuración', icon: 'Settings',   path: '/admin/settings', roles: ['ADMIN'] },
];

// ── Line groups from registry ─────────────────────────────────────────────
// Only registered modules appear. trading/services will appear here
// automatically once their modules are registered in businessLineRegistry.ts.

const LINE_GROUPS: NavGroupItem[] = businessLines.map((mod) => ({
  id: mod.id,
  label: mod.displayName,
  icon: mod.icon,
  material: MATERIAL_MAP[mod.id],
  children: mod.sidebarItems.map((item) => ({
    id: item.href.split('/').pop() ?? item.href,
    label: item.label,
    icon: item.icon,
    path: item.href,
    roles: item.roles as UserRole[] | undefined,
  })),
}));

// ── NAV ───────────────────────────────────────────────────────────────────

export const NAV: NavSection = {
  cross: CROSS_ITEMS,
  rawMaterial: RAW_MATERIAL_ITEMS,
  lines: LINE_GROUPS,
  admin: ADMIN_ITEMS,
};

// ── ROUTE_TITLES ──────────────────────────────────────────────────────────

export const ROUTE_TITLES: Record<string, RouteTitle> = {
  '/admin':            { title: 'Panel general',  crumb: null },
  '/admin/sales':      { title: 'Ventas',         crumb: null },
  '/admin/customers':  { title: 'Clientes',       crumb: null },
  '/admin/reports':    { title: 'Reportes',       crumb: null },
  '/admin/coils':      { title: 'Inventario de Bobinas', crumb: ['Materia Prima'] },
  '/admin/coils/finishes': { title: 'Acabados de Bobina', crumb: ['Materia Prima'] },
  '/admin/users':      { title: 'Usuarios',       crumb: ['Administración'] },
  '/admin/audit':      { title: 'Auditoría',      crumb: ['Administración'] },
  '/admin/settings':   { title: 'Configuración',  crumb: ['Administración'] },
};

for (const line of LINE_GROUPS) {
  for (const child of line.children) {
    ROUTE_TITLES[child.path] = { title: child.label, crumb: [line.label] };
  }
}
