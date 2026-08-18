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
  comercial: NavLeafItem[];
  produccion: NavLeafItem[];
  abastecimiento: NavLeafItem[];
  materiaPrima: NavLeafItem[];
  lineas: NavLeafItem[];
  admin: NavLeafItem[];
};

export type RouteTitle = {
  title: string;
  crumb: string[] | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────

const isProductionItem = (label: string) => {
  const l = label.toLowerCase();
  return l.includes('producción') || l.includes('terminal') || l.includes('operador') || l.includes('corte');
};

const isCatalogItem = (label: string) => {
  const l = label.toLowerCase();
  return l.includes('catálogo') || l.includes('inventario') || l.includes('stock');
};

const isCommercialItem = (label: string) => {
  const l = label.toLowerCase();
  return l.includes('ventas') || l.includes('cotización');
};

// ── Item generation ───────────────────────────────────────────────────────

const COMERCIAL_ITEMS: NavLeafItem[] = [
  { id: 'dashboard', label: 'Panel',    icon: 'LayoutDashboard', path: '/admin' },
  { id: 'sales',     label: 'Ventas',   icon: 'Receipt',         path: '/admin/sales' },
  { id: 'quotations', label: 'Cotizaciones', icon: 'FileText',   path: '/admin/quotations' },
  { id: 'customers', label: 'Clientes', icon: 'Users',           path: '/admin/customers' },
  { id: 'reports',   label: 'Reportes', icon: 'BarChart3',       path: '/admin/reports' },
];

const RAW_MATERIAL_ITEMS: NavLeafItem[] = [
  { id: 'coils-inv', label: 'Inventario Bobinas', icon: 'Layers', path: '/admin/coils' },
  { id: 'coils-fin', label: 'Acabados Bobina',    icon: 'Tag',    path: '/admin/coils/finishes' },
  { id: 'strips-inv', label: 'Inventario Flejes', icon: 'Boxes',    path: '/admin/coils/strips' },
];

const ABASTECIMIENTO_ITEMS: NavLeafItem[] = [
  { id: 'purchases',  label: 'Compras',           icon: 'Truck',    path: '/admin/purchases' },
  { id: 'cut-orders', label: 'Órdenes de Corte',  icon: 'Scissors', path: '/admin/coils/cut-orders' },
];

const ADMIN_ITEMS_BASE: NavLeafItem[] = [
  { id: 'users',    label: 'Usuarios',      icon: 'UserCog',    path: '/admin/users',    roles: ['ADMIN'] },
  { id: 'audit',    label: 'Auditoría',     icon: 'ScrollText', path: '/admin/audit',    roles: ['ADMIN'] },
  { id: 'settings', label: 'Configuración', icon: 'Settings',   path: '/admin/settings', roles: ['ADMIN'] },
];

// ── Distribution from modules ─────────────────────────────────────────────

const produccion: NavLeafItem[] = [];
const catalogos: NavLeafItem[] = [];
const comercialExtra: NavLeafItem[] = [];

businessLines.forEach((mod) => {
  mod.sidebarItems.forEach((item) => {
    const leaf: NavLeafItem = {
      id: `${mod.id}-${item.href.split('/').pop() ?? item.href}`,
      label: item.label === 'Catálogo' || item.label === 'Inventario' 
        ? `${item.label} ${mod.displayName.split(' ')[0]}` // Ej: "Catálogo Drywall"
        : item.label,
      icon: item.icon,
      path: item.href,
      roles: item.roles as UserRole[] | undefined,
    };

    if (mod.productionEngine && isProductionItem(item.label)) {
      produccion.push(leaf);
    } else if (isCatalogItem(item.label)) {
      catalogos.push(leaf);
    } else if (isCommercialItem(item.label)) {
      comercialExtra.push(leaf);
    }
  });
});

// ── NAV ───────────────────────────────────────────────────────────────────

export const NAV: NavSection = {
  comercial: [...COMERCIAL_ITEMS, ...comercialExtra],
  produccion,
  abastecimiento: ABASTECIMIENTO_ITEMS,
  materiaPrima: RAW_MATERIAL_ITEMS,
  lineas: catalogos,
  admin: ADMIN_ITEMS_BASE,
};

// ── ROUTE_TITLES ──────────────────────────────────────────────────────────

export const ROUTE_TITLES: Record<string, RouteTitle> = {
  '/admin':            { title: 'Panel general',  crumb: null },
  '/admin/sales':      { title: 'Ventas',         crumb: null },
  '/admin/quotations': { title: 'Cotizaciones',   crumb: null },
  '/admin/customers':  { title: 'Clientes',       crumb: null },
  '/admin/reports':    { title: 'Reportes',       crumb: null },
  '/admin/purchases':  { title: 'Compras',        crumb: ['Abastecimiento'] },
  '/admin/purchases/new': { title: 'Nueva Compra', crumb: ['Abastecimiento', 'Compras'] },
  '/admin/coils':      { title: 'Inventario de Bobinas', crumb: ['Materia Prima'] },
  '/admin/coils/finishes': { title: 'Acabados de Bobina', crumb: ['Materia Prima'] },
  '/admin/coils/cut-orders': { title: 'Órdenes de Corte', crumb: ['Materia Prima'] },
  '/admin/coils/strips': { title: 'Inventario de Flejes', crumb: ['Materia Prima'] },
  '/admin/users':      { title: 'Usuarios',       crumb: ['Administración'] },
  '/admin/audit':      { title: 'Auditoría',      crumb: ['Administración'] },
  '/admin/settings':   { title: 'Configuración',  crumb: ['Administración'] },
};

for (const item of catalogos) {
  ROUTE_TITLES[item.path] = { title: item.label, crumb: ['Líneas de Negocio'] };
}
for (const item of produccion) {
  ROUTE_TITLES[item.path] = { title: item.label, crumb: ['Producción'] };
}
for (const item of comercialExtra) {
  ROUTE_TITLES[item.path] = { title: item.label, crumb: ['Comercial'] };
}
