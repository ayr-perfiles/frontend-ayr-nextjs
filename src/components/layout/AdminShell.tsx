'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/clientApp';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/context/AuthContext';
import {
  User, LogOut, PanelLeft, Menu,
} from 'lucide-react';
import Sidebar from './Sidebar';

type Viewport = 'lg' | 'md' | 'sm';

// ── Search result types ───────────────────────────────────────────────────

type ClienteResult = { type: 'cliente'; name: string; ruc: string };
type SkuResult    = { type: 'sku'; sku: string; desc: string };
type SearchResult  = ClienteResult | SkuResult;

const DEMO_RESULTS: SearchResult[] = [
  { type: 'cliente', name: 'Constructora Andina S.A.C.',    ruc: '20512345678' },
  { type: 'cliente', name: 'Inversiones Huachipa E.I.R.L.', ruc: '20498765432' },
  { type: 'cliente', name: 'Vivienda Norte SRL',            ruc: '20587654321' },
  { type: 'sku', sku: 'COB035ROJO', desc: 'Cobertura aluzinc 0.35mm roja' },
  { type: 'sku', sku: 'P64GALV045', desc: 'Parante drywall 64mm 0.45mm' },
  { type: 'sku', sku: 'UPVC6MT',    desc: 'Cobertura UPVC 6m' },
];

// ── Header ────────────────────────────────────────────────────────────────

function HeaderComponent({
  role,
  pathname,
  viewport,
  collapsed,
  onToggle,
}: {
  role: UserRole;
  pathname: string;
  viewport: Viewport;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { user } = useAuth();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isLg = viewport === 'lg';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.querySelector('input')?.focus();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setSearchOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const results = useMemo((): SearchResult[] => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return DEMO_RESULTS;
    return DEMO_RESULTS.filter((r) =>
      r.type === 'cliente'
        ? r.name.toLowerCase().includes(q) || r.ruc.includes(q)
        : r.sku.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q),
    );
  }, [searchQ]);

  const customers = results.filter((r): r is ClienteResult => r.type === 'cliente');
  const skus      = results.filter((r): r is SkuResult => r.type === 'sku');

  const displayName = user?.email?.split('@')[0] ?? 'Usuario';
  const initials = displayName.slice(0, 2).toUpperCase();
  const roleLabel =
    role === 'ADMIN' ? 'Administrador' : role === 'SUPERVISOR' ? 'Supervisor' : 'Operador';

  const segmentLabels: Record<string, string> = {
    admin: "Inicio",
    lines: "Líneas",
    "metallic-roofing": "Metallic Roofing",
    drywall: "Drywall",
    roofing: "Roofing",
    trading: "Trading",
    services: "Services",
    production: "Producción",
    sales: "Ventas",
    coils: "Bobinas",
    "cut-orders": "Órdenes de Corte",
    strips: "Flejes",
    finishes: "Acabados",
    inventory: "Inventario",
    catalog: "Catálogo",
    purchases: "Compras",
    crm: "CRM",
    kardex: "Kardex productos",
    users: "Usuarios",
    audit: "Auditoría",
    settings: "Configuración",
    setup: "Setup",
    "catalog-import": "Importar Catálogo",
    reports: "Reportes",
    customers: "Clientes",
    import: "Importar",
    new: "Nuevo",
    operator: "Operador",
    "bulk-import": "Importación masiva",
    queue: "Cola de Producción",
  };

  const pathSegments = pathname.split("/").filter(Boolean);
  const breadcrumbItems = pathSegments.map((segment) => {
    const label = segmentLabels[segment];
    if (label) return label;
    if (segment.length > 15 || !isNaN(Number(segment))) return "Detalle";
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  });

  return (
    <header
      className="sticky top-0 z-20 shrink-0 grid items-center"
      style={{
        height: 56,
        gap: isLg ? 24 : 12,
        gridTemplateColumns: isLg
          ? 'auto minmax(0,1fr) minmax(0,480px) auto'
          : 'auto minmax(0,1fr) auto',
        padding: isLg ? '0 20px' : '0 12px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        title={isLg ? (collapsed ? 'Expandir' : 'Contraer') : 'Menú'}
        className="w-9 h-9 grid place-items-center rounded-[var(--radius-md)] transition-colors shrink-0"
        style={{ color: 'var(--color-fg-muted)', background: 'transparent' }}
        onMouseEnter={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.background = 'var(--color-surface-muted)';
          btn.style.color = 'var(--color-fg)';
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.background = 'transparent';
          btn.style.color = 'var(--color-fg-muted)';
        }}
      >
        {isLg ? <PanelLeft size={20} /> : <Menu size={20} />}
      </button>

      {/* Breadcrumb */}
      <div className="min-w-0 flex items-center gap-1.5 text-sm md:text-base font-semibold truncate text-[var(--color-fg)]">
         {breadcrumbItems.map((item, i) => (
            <span key={i} className="flex items-center gap-1.5">
               {i > 0 && <span className="text-slate-400 font-normal">›</span>}
               <span className={i === breadcrumbItems.length - 1 ? 'text-slate-800' : 'text-slate-500 font-medium'}>
                 {item}
               </span>
            </span>
         ))}
      </div>

      {!isLg && <div className="flex-1" />}
      {isLg && <div />}

      {/* Right — role + bell + avatar */}
      <div className="flex items-center gap-2 justify-end flex-nowrap">
        <span
          className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-[var(--radius-sm)] border shrink-0"
          style={{
            letterSpacing: '0.05em',
            color:
              role === 'ADMIN'
                ? 'var(--color-role-admin)'
                : role === 'SUPERVISOR'
                  ? 'var(--color-role-supervisor)'
                  : 'var(--color-role-operator)',
            borderColor: 'currentColor',
            background: 'color-mix(in oklch, currentColor 8%, transparent)',
          }}
        >
          {isLg ? roleLabel : role.slice(0, 3)}
        </span>

        <div ref={menuRef} className="relative shrink-0">
          <div
            className="w-8 h-8 rounded-full grid place-items-center text-xs font-semibold cursor-pointer select-none border"
            style={{
              background:
                'color-mix(in oklch, var(--color-primary) 15%, var(--color-surface))',
              color: 'var(--color-primary)',
              borderColor: 'var(--color-border)',
            }}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {initials}
          </div>

          {menuOpen && (
            <div
              className="absolute right-0 rounded-[var(--radius-lg)] z-30"
              style={{
                top: 'calc(100% + 6px)',
                minWidth: 200,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-lg)',
                padding: 4,
              }}
            >
              <div
                className="px-2.5 pb-2 pt-2.5 mb-1"
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <div className="text-[13px] font-semibold">{displayName}</div>
                <div className="text-[10px] text-[var(--color-fg-muted)] truncate">
                  {user?.email}
                </div>
              </div>
              <DropdownItem
                icon={<LogOut size={14} />}
                label="Cerrar sesión"
                onClick={() => signOut(auth)}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function DropdownItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-sm)] text-[13px] cursor-pointer transition-colors"
      style={{ color: danger ? 'var(--color-danger)' : 'var(--color-fg)' }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = 'var(--color-surface-muted)')
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <span style={{ color: danger ? 'var(--color-danger)' : 'var(--color-fg-muted)' }}>
        {icon}
      </span>
      {label}
    </div>
  );
}

// ── AdminShell ────────────────────────────────────────────────────────────

interface AdminShellProps {
  /** Omit in production; set to 'dev' or 'emul' to show the env banner */
  env?: 'dev' | 'emul' | 'prod';
  children: React.ReactNode;
}

export default function AdminShell({ env = 'prod', children }: AdminShellProps) {
  const { role } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Viewport states
  const [viewport, setViewport] = useState<Viewport>('lg');
  const [collapsed, setCollapsed] = useState(false); // Only for lg
  const [isOpen, setIsOpen] = useState(false); // For sm/md drawer/overlay

  // Initialize and listen to viewports
  useEffect(() => {
    const sm = window.matchMedia('(max-width: 767px)');
    const md = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    const lg = window.matchMedia('(min-width: 1024px)');

    const update = () => {
      if (sm.matches) setViewport('sm');
      else if (md.matches) setViewport('md');
      else if (lg.matches) setViewport('lg');
    };

    update();
    sm.addEventListener('change', update);
    md.addEventListener('change', update);
    lg.addEventListener('change', update);

    return () => {
      sm.removeEventListener('change', update);
      md.removeEventListener('change', update);
      lg.removeEventListener('change', update);
    };
  }, []);

  // Persist collapsed state for desktop
  useEffect(() => {
    const saved = localStorage.getItem('ayr-sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('ayr-sidebar-collapsed', String(next));
      return next;
    });
  };

  const toggleOpen = () => setIsOpen((prev) => !prev);

  // Auto-close on path change (for mobile/tablet)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  if (!role) return null;

  const withEnv = env !== 'prod';

  // Layout calculations
  const isLg = viewport === 'lg';
  const isMd = viewport === 'md';
  const isSm = viewport === 'sm';

  // Sidebar effective state
  const effectiveCollapsed = (isLg && collapsed) || (isMd && !isOpen);
  const showSidebar = isLg || isMd || isOpen;

  // Sidebar width & Main margin
  let sidebarWidth = 0;
  if (isLg) sidebarWidth = collapsed ? 72 : 260;
  else if (isMd) sidebarWidth = 72;
  else sidebarWidth = 0; // Fixed 0 for main margin, sidebar is overlay

  // Padding based on viewport
  const mainPadding = isLg ? 24 : isMd ? 16 : 12;

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col overflow-x-hidden">
      {withEnv && (
        <div
          className="shrink-0 flex items-center justify-center text-[11px] font-medium uppercase text-white z-50 sticky top-0"
          style={{
            height: 24,
            background:
              env === 'dev' ? 'var(--color-env-dev)' : 'var(--color-env-emul)',
            borderBottom: '1px solid rgb(0 0 0 / 0.1)',
            letterSpacing: '0.06em',
          }}
        >
          {env === 'dev'
            ? 'Entorno: DEV — datos no productivos'
            : 'Entorno: EMULADOR — Firebase local'}
        </div>
      )}

      <div className="flex flex-1 relative min-h-0">
        {/* Backdrop for mobile/tablet overlay */}
        {((isSm || isMd) && isOpen) && (
          <div
            className={`fixed inset-0 bg-black/5 z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setIsOpen(false)}
          />
        )}

        <div
          className="fixed top-0 bottom-0 left-0 z-40 transition-all duration-300 ease-in-out"
          style={{
            transform: showSidebar
              ? 'translateX(0)'
              : 'translateX(-100%)',
            top: withEnv ? 24 : 0,
            width: isSm ? '100%' : ((isMd && !isOpen) || (isLg && collapsed)) ? 72 : 260,
          }}
        >
          <Sidebar
            collapsed={effectiveCollapsed}
          />
        </div>

        <div
          className="flex flex-col flex-1 min-w-0 transition-all duration-300 ease-in-out"
          style={{
            marginLeft: sidebarWidth,
          }}
        >
          <HeaderComponent
            role={role}
            pathname={pathname}
            viewport={viewport}
            collapsed={collapsed}
            onToggle={isLg ? toggleCollapsed : toggleOpen}
          />

          <main
            className="flex-1 min-h-0 overflow-y-auto"
            style={{ padding: mainPadding }}
          >
            <div className="max-w-[1280px] mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
