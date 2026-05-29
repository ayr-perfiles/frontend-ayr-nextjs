'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/clientApp';
import { useAuth } from '@/context/AuthContext';
import { NAV, ROUTE_TITLES } from './navItems';
import type { NavSection, NavLeafItem, NavGroupItem } from './navItems';
import type { UserRole } from '@/context/AuthContext';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Receipt, Users, BarChart3, Layers, Factory, Home,
  ShoppingCart, Wrench, UserCog, ScrollText, Settings, ChevronRight,
  PanelLeft, Package, BookOpen, Truck, Clipboard, Cog,
  User, LogOut, Database, Warehouse, Smartphone, Menu, Tag,
} from 'lucide-react';

type Viewport = 'lg' | 'md' | 'sm';

// ── Icon resolution ───────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Receipt, Users, BarChart3, Layers, Factory, Home,
  ShoppingCart, Wrench, UserCog, ScrollText, Settings, ChevronRight,
  PanelLeft, Package, BookOpen, Truck, Clipboard, Cog,
  User, LogOut, Database, Warehouse, Smartphone, Tag,
};

function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Package;
}

// ── Role filter ───────────────────────────────────────────────────────────

function filterNavForRole(nav: NavSection, role: UserRole): NavSection {
  if (role === 'ADMIN') return nav;
  if (role === 'SUPERVISOR') return { ...nav, admin: [] };

  // OPERATOR: dashboard + sales only; lines filtered by item roles
  const cross = nav.cross.filter((i) => i.id === 'dashboard' || i.id === 'sales');
  const rawMaterial = nav.rawMaterial.filter((i) => !i.roles || i.roles.includes('OPERATOR'));
  const lines = nav.lines
    .map((line) => ({
      ...line,
      children: line.children.filter(
        (c) => !c.roles || c.roles.includes('OPERATOR'),
      ),
    }))
    .filter((line) => line.children.length > 0);

  return { cross, rawMaterial, lines, admin: [] };
}

// ── NavLeaf ───────────────────────────────────────────────────────────────

function NavLeaf({
  item,
  active,
  onClick,
  collapsed,
}: {
  item: NavLeafItem;
  active: boolean;
  onClick: () => void;
  collapsed: boolean;
}) {
  const Ic = getIcon(item.icon);

  return (
    <div className="group relative">
      <button
        onClick={onClick}
        title={item.label}
        className="w-full flex items-center gap-2.5 rounded-[var(--radius-md)] text-[13px] font-medium transition-colors relative overflow-hidden"
        style={{
          padding: collapsed ? '9px 0' : '8px 12px',
          justifyContent: collapsed ? 'center' : undefined,
          color: active ? 'var(--color-primary)' : 'var(--color-fg-muted)',
          background: active ? 'var(--color-primary-soft)' : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!active) {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.background = 'var(--color-surface-muted)';
            btn.style.color = 'var(--color-fg)';
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.background = 'transparent';
            btn.style.color = 'var(--color-fg-muted)';
          }
        }}
      >
        {active && (
          <span
            className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r"
            style={{ background: 'var(--color-primary)' }}
          />
        )}
        <Ic size={16} className="shrink-0" />
        {!collapsed && (
          <span className="flex-1 min-w-0 truncate text-left">{item.label}</span>
        )}
        {!collapsed && item.badge && item.badge.count > 0 && (
          <span
            className="shrink-0 text-[11px] font-semibold px-1.5 py-px rounded-full tabular-nums"
            style={{
              background:
                item.badge.kind === 'danger'
                  ? 'var(--color-danger-soft)'
                  : 'var(--color-warning-soft)',
              color:
                item.badge.kind === 'danger'
                  ? 'var(--color-danger)'
                  : 'oklch(0.42 0.13 75)',
            }}
          >
            {item.badge.count}
          </span>
        )}
      </button>

      {collapsed && (
        <span
          className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap px-2 py-1 text-xs font-medium rounded-[var(--radius-sm)] opacity-0 group-hover:opacity-100 z-30"
          style={{
            background: 'var(--color-fg)',
            color: 'var(--color-surface)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {item.label}
        </span>
      )}
    </div>
  );
}

// ── NavGroup ──────────────────────────────────────────────────────────────

function NavGroup({
  line,
  pathname,
  collapsed,
  open,
  onToggle,
  onNavigate,
}: {
  line: NavGroupItem;
  pathname: string;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  onNavigate: (path: string) => void;
}) {
  const hasActiveChild = line.children.some((c) => c.path === pathname);
  const Ic = getIcon(line.icon);

  const childDanger = line.children.reduce(
    (s, c) => s + (c.badge?.kind === 'danger' ? c.badge.count : 0),
    0,
  );
  const childWarn = line.children.reduce(
    (s, c) => s + (c.badge?.kind === 'warn' ? c.badge.count : 0),
    0,
  );
  const bubble =
    childDanger > 0
      ? { kind: 'danger' as const, count: childDanger }
      : childWarn > 0
        ? { kind: 'warn' as const, count: childWarn }
        : null;

  return (
    <div className="group">
      <div className="relative">
        <button
          onClick={onToggle}
          aria-expanded={open}
          className="w-full flex items-center gap-2.5 rounded-[var(--radius-md)] text-[13px] font-medium transition-colors overflow-hidden"
          style={{
            padding: collapsed ? '9px 0' : '8px 12px',
            justifyContent: collapsed ? 'center' : undefined,
            color: hasActiveChild ? 'var(--color-fg)' : 'var(--color-fg-muted)',
            background: 'transparent',
          }}
          onMouseEnter={(e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.background = 'var(--color-surface-muted)';
            btn.style.color = 'var(--color-fg)';
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.background = 'transparent';
            btn.style.color = hasActiveChild ? 'var(--color-fg)' : 'var(--color-fg-muted)';
          }}
        >
          <Ic size={16} className="shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 min-w-0 truncate text-left">{line.label}</span>
              {line.material && !bubble && (
                <span
                  className="shrink-0 w-1.5 h-1.5 rounded-full"
                  title={
                    line.material === 'acero'
                      ? 'Materia prima: acero'
                      : 'Materia prima: PVC'
                  }
                  style={{
                    background:
                      line.material === 'acero'
                        ? 'var(--color-material-acero)'
                        : 'var(--color-material-pvc)',
                  }}
                />
              )}
              {bubble && !open && (
                <span
                  className="shrink-0 text-[11px] font-semibold px-1.5 py-px rounded-full tabular-nums"
                  style={{
                    background:
                      bubble.kind === 'danger'
                        ? 'var(--color-danger-soft)'
                        : 'var(--color-warning-soft)',
                    color:
                      bubble.kind === 'danger'
                        ? 'var(--color-danger)'
                        : 'oklch(0.42 0.13 75)',
                  }}
                >
                  {bubble.count}
                </span>
              )}
              <ChevronRight
                size={14}
                className="shrink-0 transition-transform duration-150"
                style={{
                  color: 'var(--color-fg-subtle)',
                  transform: open ? 'rotate(90deg)' : undefined,
                }}
              />
            </>
          )}
        </button>

        {collapsed && (
          <span
            className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap px-2 py-1 text-xs font-medium rounded-[var(--radius-sm)] opacity-0 group-hover:opacity-100 z-30"
            style={{
              background: 'var(--color-fg)',
              color: 'var(--color-surface)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {line.label}
          </span>
        )}
      </div>

      {open && !collapsed && (
        <div className="pl-4 flex flex-col gap-0.5 mt-0.5 mb-1">
          {line.children.map((c) => (
            <NavLeaf
              key={c.id}
              item={c}
              active={c.path === pathname}
              collapsed={false}
              onClick={() => onNavigate(c.path)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────

function SidebarComponent({
  role,
  pathname,
  collapsed,
  env,
  onNavigate,
}: {
  role: UserRole;
  pathname: string;
  collapsed: boolean;
  env: 'dev' | 'emul' | 'prod';
  onNavigate: (path: string) => void;
}) {
  const nav = useMemo(() => filterNavForRole(NAV, role), [role]);

  const initialOpen = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const l of nav.lines) {
      map[l.id] = l.children.some((c) => c.path === pathname);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.lines]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initialOpen);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const l of nav.lines) {
        if (l.children.some((c) => c.path === pathname)) next[l.id] = true;
      }
      return next;
    });
  }, [pathname, nav.lines]);

  const toggleGroup = (id: string) =>
    setOpenGroups((p) => ({ ...p, [id]: !p[id] }));

  return (
    <aside
      className="flex flex-col h-full overflow-hidden"
      style={{
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* Brand */}
      <div
        className="flex items-center shrink-0"
        style={{
          height: 56,
          padding: collapsed ? '0' : '0 16px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div
            className="w-6 h-6 shrink-0 rounded-[var(--radius-sm)] grid place-items-center text-[11px] font-semibold"
            style={{
              fontFamily: 'var(--font-mono)',
              background:
                'linear-gradient(135deg, var(--color-primary) 0%, oklch(0.38 0.12 245) 100%)',
              color: 'var(--color-fg-on-primary)',
            }}
          >
            AY
          </div>
          {!collapsed && (
            <span
              className="text-[15px] font-semibold truncate"
              style={{ color: 'var(--color-fg)', letterSpacing: '-0.01em' }}
            >
              AYR Steel
            </span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav
        className="flex-1 min-h-0 overflow-y-auto"
        style={{ padding: collapsed ? '10px 6px' : '12px 8px 16px' }}
      >
        {nav.cross.length > 0 && (
          <div className="mb-3.5">
            {!collapsed && (
              <p
                className="text-[11px] font-medium uppercase px-2.5 pb-1 pt-1.5"
                style={{ letterSpacing: '0.08em', color: 'var(--color-fg-subtle)' }}
              >
                Operación
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {nav.cross.map((item) => (
                <NavLeaf
                  key={item.id}
                  item={item}
                  active={item.path === pathname}
                  collapsed={collapsed}
                  onClick={() => onNavigate(item.path)}
                />
              ))}
            </div>
          </div>
        )}

        {nav.rawMaterial.length > 0 && (
          <div className="mb-3.5">
            {!collapsed && (
              <p
                className="text-[11px] font-medium uppercase px-2.5 pb-1 pt-1.5"
                style={{ letterSpacing: '0.08em', color: 'var(--color-fg-subtle)' }}
              >
                Materia Prima / Almacén
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {nav.rawMaterial.map((item) => (
                <NavLeaf
                  key={item.id}
                  item={item}
                  active={item.path === pathname}
                  collapsed={collapsed}
                  onClick={() => onNavigate(item.path)}
                />
              ))}
            </div>
          </div>
        )}

        {nav.lines.length > 0 && (
          <div className="mb-3.5">
            {!collapsed && (
              <p
                className="text-[11px] font-medium uppercase px-2.5 pb-1 pt-1.5"
                style={{ letterSpacing: '0.08em', color: 'var(--color-fg-subtle)' }}
              >
                Líneas de negocio
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {nav.lines.map((line) => (
                <NavGroup
                  key={line.id}
                  line={line}
                  pathname={pathname}
                  collapsed={collapsed}
                  open={!!openGroups[line.id]}
                  onToggle={() => toggleGroup(line.id)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        )}

        {nav.admin.length > 0 && (
          <div className="mb-3.5">
            {!collapsed && (
              <p
                className="text-[11px] font-medium uppercase px-2.5 pb-1 pt-1.5"
                style={{ letterSpacing: '0.08em', color: 'var(--color-fg-subtle)' }}
              >
                Administración
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {nav.admin.map((item) => (
                <NavLeaf
                  key={item.id}
                  item={item}
                  active={item.path === pathname}
                  collapsed={collapsed}
                  onClick={() => onNavigate(item.path)}
                />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div
        className="shrink-0 flex items-center"
        style={{
          borderTop: '1px solid var(--color-border)',
          padding: collapsed ? '10px 6px' : '10px 14px',
          justifyContent: collapsed ? 'center' : 'space-between',
          color: 'var(--color-fg-subtle)',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {!collapsed && <span>v1.2</span>}
        {env !== 'prod' && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[11px] font-semibold uppercase text-white"
            style={{
              background:
                env === 'dev' ? 'var(--color-env-dev)' : 'var(--color-env-emul)',
              letterSpacing: '0.06em',
            }}
          >
            {env.toUpperCase()}
          </span>
        )}
        {env === 'prod' && !collapsed && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[11px] font-semibold uppercase text-white"
            style={{ background: 'var(--color-success)', letterSpacing: '0.06em' }}
          >
            PROD
          </span>
        )}
      </div>
    </aside>
  );
}

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
  const meta = ROUTE_TITLES[pathname] ?? { title: pathname, crumb: null };

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

      {/* Breadcrumb + title */}
      <div className="min-w-0">
        {isLg && meta.crumb && (
          <div
            className="flex items-center gap-1 text-[11px] mb-px"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-fg-muted)' }}
          >
            <span>admin</span>
            {meta.crumb.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                <span style={{ color: 'var(--color-fg-subtle)' }}>/</span>
                <span>{c}</span>
              </span>
            ))}
          </div>
        )}
        <div
          className={`${isLg ? 'text-xl' : 'text-base'} font-semibold truncate`}
          style={{ color: 'var(--color-fg)', letterSpacing: '-0.01em' }}
        >
          {meta.title}
        </div>
      </div>

      {/* Search - hidden on mobile small, shown as icon or compact on md */}
      {/* 
      <div
        ref={searchRef}
        className={`${viewport === 'sm' ? 'hidden' : 'relative'} flex items-center h-9 rounded-[var(--radius-md)] transition-all`}
        style={{
          background: 'var(--color-surface-sunken)',
          border: searchOpen
            ? '1px solid var(--color-border-focus)'
            : '1px solid var(--color-border)',
          padding: '0 10px',
          boxShadow: searchOpen
            ? '0 0 0 3px color-mix(in oklch, var(--color-border-focus) 18%, transparent)'
            : undefined,
        }}
      >
        <Search size={16} style={{ color: 'var(--color-fg-muted)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Buscar…"
          value={searchQ}
          onChange={(e) => {
            setSearchQ(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] px-2.5"
          style={{ color: 'var(--color-fg)', fontFamily: 'inherit' }}
        />
        {isLg && (
          <span
            className="shrink-0 text-[11px] px-1 rounded-[var(--radius-sm)]"
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-fg-muted)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderBottomWidth: 2,
              lineHeight: '14px',
            }}
          >
            ⌘K
          </span>
        )}

        {searchOpen && (
          <div
            className="absolute left-0 right-0 rounded-[var(--radius-lg)] overflow-y-auto z-30"
            style={{
              top: 'calc(100% + 6px)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-lg)',
              padding: 6,
              maxHeight: 320,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {customers.length > 0 && (
              <>
                <p
                  className="text-[11px] font-medium uppercase px-2.5 py-2"
                  style={{ letterSpacing: '0.08em', color: 'var(--color-fg-subtle)' }}
                >
                  Clientes
                </p>
                {customers.map((c) => (
                  <SearchRow
                    key={c.ruc}
                    left={<Users size={16} style={{ color: 'var(--color-fg-muted)' }} />}
                    label={c.name}
                    meta={`RUC ${c.ruc}`}
                  />
                ))}
              </>
            )}
            {skus.length > 0 && (
              <>
                <p
                  className="text-[11px] font-medium uppercase px-2.5 py-2"
                  style={{ letterSpacing: '0.08em', color: 'var(--color-fg-subtle)' }}
                >
                  Productos · SKU
                </p>
                {skus.map((s) => (
                  <SearchRow
                    key={s.sku}
                    left={<Package size={16} style={{ color: 'var(--color-fg-muted)' }} />}
                    label={s.desc}
                    meta={s.sku}
                    metaMono
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
      */}

      {/* Spacer when search is hidden */}
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

        {/* 
        {isLg && (
          <IconBtn label="Notificaciones">
            <Bell size={18} />
          </IconBtn>
        )}
        */}


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
              <DropdownItem icon={<User size={14} />} label="Mi perfil" />
              <DropdownItem
                icon={<LogOut size={14} />}
                label="Cerrar sesión"
                danger
                onClick={() => signOut(auth)}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ── Small reusable UI atoms ───────────────────────────────────────────────

function IconBtn({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      className="w-9 h-9 grid place-items-center rounded-[var(--radius-md)] border border-transparent relative shrink-0 transition-colors"
      style={{ background: 'transparent', color: 'var(--color-fg-muted)' }}
      aria-label={label}
      title={label}
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
      {children}
    </button>
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

function SearchRow({
  left,
  label,
  meta,
  metaMono,
}: {
  left: React.ReactNode;
  label: string;
  meta: string;
  metaMono?: boolean;
}) {
  return (
    <div
      className="grid items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-sm)] cursor-pointer"
      style={{ gridTemplateColumns: '16px 1fr auto' }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = 'var(--color-surface-muted)')
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {left}
      <span
        className="truncate text-[13px]"
        style={{ color: 'var(--color-fg)' }}
      >
        {label}
      </span>
      <span
        className="text-xs shrink-0 tabular-nums"
        style={{
          fontFamily: metaMono ? 'var(--font-mono)' : 'inherit',
          color: 'var(--color-fg-muted)',
        }}
      >
        {meta}
      </span>
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
  if (isLg) sidebarWidth = collapsed ? 56 : 240;
  else if (isMd) sidebarWidth = 56;
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
          className="fixed top-0 bottom-0 left-0 z-40 transition-all duration-200 ease-out"
          style={{
            transform: showSidebar
              ? 'translateX(0)'
              : 'translateX(-100%)',
            top: withEnv ? 24 : 0,
            width: isSm ? '100%' : ((isMd && !isOpen) || (isLg && collapsed)) ? 56 : 240,
          }}
        >
          <SidebarComponent
            role={role}
            pathname={pathname}
            collapsed={effectiveCollapsed}
            env={env}
            onNavigate={(path) => router.push(path)}
          />
        </div>

        <div
          className="flex flex-col flex-1 min-w-0 transition-[margin] duration-200 ease-out"
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
