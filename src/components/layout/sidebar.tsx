"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/clientApp";
import { useAuth, UserRole } from "@/context/AuthContext";
import { businessLines } from "@/core/registry/businessLineRegistry";
import type { BusinessLineModule, MenuItem } from "@/core/contracts";
import {
  LayoutDashboard,
  Factory,
  ShoppingCart,
  BarChart3,
  Settings,
  ChevronRight,
  Zap,
  LogOut,
  Users,
  ShieldAlert,
  Smartphone,
  Package,
  Layers,
  Warehouse,
  BookOpen,
  Contact2,
  Scissors,
  Tag,
  History,
  Wrench,
  Truck,
  PackagePlus,
  PackageCheck,
  AlignJustify,
  Boxes,
  FileText,
  UserCog,
  ScrollText,
  MoreVertical,
  User,
  PanelLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Icon Mapping ──────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Factory,
  ShoppingCart,
  BarChart3,
  Settings,
  Users,
  ShieldAlert,
  Smartphone,
  Package,
  Layers,
  Warehouse,
  BookOpen,
  Contact2,
  Scissors,
  Tag,
  History,
  Wrench,
  Truck,
  PackagePlus,
  PackageCheck,
  AlignJustify,
  Boxes,
  FileText,
  UserCog,
  ScrollText,
  MoreVertical,
  User,
  PanelLeft,
};

function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Layers;
}

// ── Business Line Colors ──────────────────────────────────────────────────

const LINE_COLORS: Record<string, string> = {
  drywall: "var(--lob-drywall)",
  roofing: "var(--lob-pvc)",
  "metallic-roofing": "var(--lob-aluzinc)",
  trading: "var(--lob-reventa)",
  services: "var(--lob-servicios)",
};

// ── Components ────────────────────────────────────────────────────────────

interface NavItemProps {
  icon: string;
  label: string;
  href: string;
  active?: boolean;
  soon?: boolean;
  badge?: number;
  alertDot?: boolean;
  collapsed?: boolean;
}

function NavItem({
  icon,
  label,
  href,
  active,
  soon,
  badge,
  alertDot,
  collapsed,
}: NavItemProps) {
  const Icon = getIcon(icon);
  return (
    <div className="group relative">
      <Link
        href={soon ? "#" : href}
        className={`
          flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 relative
          ${soon ? "opacity-50 cursor-not-allowed" : ""}
          ${
            active
              ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-bold shadow-sm shadow-blue-50"
              : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-fg)]"
          }
          ${collapsed ? "justify-center px-0" : ""}
        `}
      >
        <Icon size={18} className={`shrink-0 ${active ? "text-[var(--color-primary)]" : "text-[var(--color-fg-subtle)] group-hover:text-[var(--color-fg)]"}`} />
        {!collapsed && (
          <>
            <span className="text-[13px] flex-1 truncate">{label}</span>
            {soon && (
              <span className="text-[9px] font-black bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-md uppercase tracking-widest">
                Próximamente
              </span>
            )}
            {badge !== undefined && badge > 0 && (
              <span className="text-[10px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full tabular-nums">
                {badge}
              </span>
            )}
            {alertDot && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse" />
            )}
          </>
        )}
      </Link>
      
      {/* Tooltip for collapsed mode */}
      {collapsed && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-slate-900 text-white text-[11px] font-bold rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-xl">
          {label}
          {badge !== undefined && badge > 0 ? ` · ${badge} sin acabado` : ""}
        </div>
      )}
    </div>
  );
}

function Group({
  icon,
  title,
  children,
  collapsed,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  collapsed: boolean;
}) {
  const Icon = getIcon(icon);
  return (
    <div className="space-y-1.5">
      {!collapsed && (
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Icon size={14} className="text-[var(--color-fg-subtle)] opacity-60" />
          <span className="text-[10px] font-black text-[var(--color-fg-subtle)] uppercase tracking-widest">
            {title}
          </span>
        </div>
      )}
      {collapsed && <div className="h-px bg-[var(--color-border)] mx-4 my-2 opacity-50" />}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function LineGroup({
  line,
  open,
  onToggle,
  pathname,
  collapsed,
}: {
  line: BusinessLineModule;
  open: boolean;
  onToggle: () => void;
  pathname: string;
  collapsed: boolean;
}) {
  const color = LINE_COLORS[line.id] || "var(--color-primary)";
  const isCatalogActive = pathname === `/admin/lines/${line.id}/catalog`;
  const isInventoryActive = pathname === `/admin/lines/${line.id}/inventory`;

  return (
    <div className="group/line">
      <div className="relative">
        <button
          onClick={onToggle}
          className={`
            w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200
            hover:bg-[var(--color-surface-muted)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]
            ${collapsed ? "justify-center px-0" : ""}
          `}
        >
          {collapsed ? (
            <div
              className="w-4 h-4 rounded-md shadow-sm"
              style={{ backgroundColor: color }}
            />
          ) : (
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
          )}
          {!collapsed && (
            <>
              <span className="text-[13px] font-bold flex-1 text-left truncate">
                {line.displayName}
              </span>
              <ChevronRight
                size={14}
                className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}
              />
            </>
          )}
        </button>

        {collapsed && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-slate-900 text-white text-[11px] font-bold rounded-md opacity-0 group-hover/line:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-xl">
            {line.displayName}
          </div>
        )}
      </div>

      {!collapsed && open && (
        <div className="ml-5 mt-0.5 space-y-0.5 border-l-2 border-[var(--color-border)] pl-2 py-1">
          <Link
            href={`/admin/lines/${line.id}/catalog`}
            className={`
              flex items-center gap-3 p-2 rounded-lg text-[12px] transition-all
              ${
                isCatalogActive
                  ? "text-[var(--color-primary)] font-bold bg-[var(--color-primary-soft)]"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-muted)]"
              }
            `}
          >
            <BookOpen size={14} /> Catálogo
          </Link>
          {line.inventoryEngine && (
            <Link
              href={`/admin/lines/${line.id}/inventory`}
              className={`
                flex items-center gap-3 p-2 rounded-lg text-[12px] transition-all
                ${
                  isInventoryActive
                    ? "text-[var(--color-primary)] font-bold bg-[var(--color-primary-soft)]"
                    : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-muted)]"
                }
              `}
            >
              <Warehouse size={14} /> Inventario
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Sidebar Component ────────────────────────────────────────────────

export default function Sidebar({ 
  collapsed: initialCollapsed = false,
  onToggleCollapse
}: { 
  collapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}) {
  const pathname = usePathname();
  const { user, role } = useAuth();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [openLines, setOpenLines] = useState<Record<string, boolean>>({ drywall: true });
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    setCollapsed(initialCollapsed);
  }, [initialCollapsed]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    onToggleCollapse?.(next);
    localStorage.setItem("ayr-sidebar-collapsed", String(next));
  };

  const toggleLine = (id: string) => {
    setOpenLines((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isRoleAllowed = (allowedRoles?: string[]) => {
    if (!allowedRoles) return true;
    return allowedRoles.includes(role || "");
  };

  // ── Stats/Badges Mock ────────────────────────────────────────────────────
  // En una app real, esto vendría de un store o hook global
  const coilBadge = 3;

  return (
    <aside
      className={`
        bg-white border-r border-[var(--color-border)] flex flex-col h-screen sticky top-0 z-40 transition-all duration-300 ease-in-out
        ${collapsed ? "w-[72px]" : "w-[260px]"}
      `}
    >
      {/* BRAND */}
      <div className={`p-4 h-14 flex items-center border-b border-[var(--color-border)] ${collapsed ? "justify-center px-0" : "justify-between"}`}>
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 shrink-0 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black text-sm shadow-md shadow-blue-200">
            AY
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-black text-slate-900 tracking-tight leading-tight">
                AYR Steel
              </span>
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none">
                Operaciones
              </span>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={toggleCollapse}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            title="Colapsar"
          >
            <PanelLeft size={18} />
          </button>
        )}
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 p-3 space-y-6 overflow-y-auto custom-scrollbar">
        {/* COMERCIAL */}
        <Group icon="TrendingUp" title="Comercial" collapsed={collapsed}>
          <NavItem icon="LayoutDashboard" label="Panel" href="/admin" active={pathname === "/admin"} collapsed={collapsed} />
          <NavItem icon="ShoppingCart" label="Ventas" href="/admin/sales" active={pathname === "/admin/sales"} collapsed={collapsed} />
          <NavItem icon="FileText" label="Cotizaciones" href="/admin/quotations" active={pathname === "/admin/quotations"} collapsed={collapsed} />
          <NavItem icon="Contact2" label="Clientes" href="/admin/customers" active={pathname === "/admin/customers"} collapsed={collapsed} />
          <NavItem icon="BarChart3" label="Reportes" href="/admin/reports" active={pathname.startsWith("/admin/reports")} collapsed={collapsed} />
        </Group>

        {/* PRODUCCIÓN */}
        <Group icon="Factory" title="Producción" collapsed={collapsed}>
          {businessLines
            .filter((l) => l.productionEngine || l.id === "metallic-roofing")
            .map((l) => (
              <NavItem
                key={l.id}
                icon="Factory"
                label={`Producción ${l.displayName.split(" ")[0]}`}
                href={`/admin/lines/${l.id}/production`}
                active={pathname === `/admin/lines/${l.id}/production`}
                soon={l.id === "metallic-roofing"}
                collapsed={collapsed}
              />
            ))}
        </Group>

        {/* ABASTECIMIENTO */}
        <Group icon="Truck" title="Abastecimiento" collapsed={collapsed}>
          <NavItem icon="PackagePlus" label="Compras" href="/admin/purchases" active={pathname.startsWith("/admin/purchases")} collapsed={collapsed} />
          <NavItem icon="Scissors" label="Órdenes de corte" href="/admin/coils/cut-orders" active={pathname === "/admin/coils/cut-orders"} collapsed={collapsed} />
          <NavItem icon="PackageCheck" label="Recepción de flejes" href="/admin/coils/strips-reception" active={pathname === "/admin/coils/strips-reception"} collapsed={collapsed} />
        </Group>

        {/* MATERIA PRIMA */}
        <Group icon="Layers" title="Materia prima" collapsed={collapsed}>
          <NavItem 
            icon="Layers" 
            label="Inventario Bobinas" 
            href="/admin/coils" 
            active={pathname === "/admin/coils"} 
            badge={coilBadge} 
            alertDot={coilBadge > 0}
            collapsed={collapsed} 
          />
          <NavItem icon="AlignJustify" label="Inventario Flejes" href="/admin/coils/strips" active={pathname === "/admin/coils/strips"} collapsed={collapsed} />
          <NavItem icon="Tag" label="Acabados" href="/admin/coils/finishes" active={pathname === "/admin/coils/finishes"} collapsed={collapsed} />
        </Group>

        {/* LÍNEAS DE NEGOCIO */}
        <Group icon="Boxes" title="Líneas de negocio" collapsed={collapsed}>
          {businessLines.map((l) => (
            <LineGroup
              key={l.id}
              line={l}
              open={openLines[l.id]}
              onToggle={() => toggleLine(l.id)}
              pathname={pathname}
              collapsed={collapsed}
            />
          ))}
        </Group>

        {/* ADMINISTRACIÓN */}
        {role === "ADMIN" && (
          <Group icon="Settings" title="Administración" collapsed={collapsed}>
            <NavItem icon="History" label="Kardex" href="/admin/kardex" active={pathname === "/admin/kardex"} collapsed={collapsed} />
            <NavItem icon="Users" label="Usuarios" href="/admin/users" active={pathname === "/admin/users"} collapsed={collapsed} />
            <NavItem icon="ShieldAlert" label="Auditoría" href="/admin/audit" active={pathname === "/admin/audit"} collapsed={collapsed} />
            <NavItem icon="Settings" label="Configuración" href="/admin/settings" active={pathname === "/admin/settings"} collapsed={collapsed} />
          </Group>
        )}
      </nav>

      {/* USER FOOTER */}
      <div className={`p-4 border-t border-[var(--color-border)] bg-slate-50/50 relative ${collapsed ? "flex justify-center" : ""}`}>
        {userMenuOpen && !collapsed && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-2xl shadow-xl border border-[var(--color-border)] overflow-hidden py-1.5 animate-in slide-in-from-bottom-2 duration-200">
            <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition text-left">
              <User size={16} className="text-slate-400" /> Mi Perfil
            </button>
            <div className="h-px bg-slate-100 my-1.5 mx-3" />
            <button
              onClick={() => signOut(auth)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-amber-600 hover:bg-amber-50 transition text-left"
            >
              <LogOut size={16} /> Cerrar Sesión
            </button>
          </div>
        )}

        <button
          onClick={() => (collapsed ? toggleCollapse() : setUserMenuOpen(!userMenuOpen))}
          className={`flex items-center gap-3 w-full p-2 rounded-xl transition hover:bg-white group/user ${collapsed ? "justify-center" : ""}`}
        >
          <div className="w-9 h-9 shrink-0 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs border-2 border-white shadow-sm">
            {role?.substring(0, 2).toUpperCase() || "US"}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-[13px] font-black text-slate-900 truncate">
                  {user?.displayName || user?.email?.split("@")[0] || "Usuario"}
                </p>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                  {role === "ADMIN" ? "Administrador" : role === "SUPERVISOR" ? "Supervisor" : "Operador"}
                </p>
              </div>
              <MoreVertical size={16} className={`text-slate-400 transition ${userMenuOpen ? "rotate-90 text-slate-600" : ""}`} />
            </>
          )}
        </button>
        
        {collapsed && (
          <div className="absolute left-full bottom-4 ml-3 px-2 py-1 bg-slate-900 text-white text-[11px] font-bold rounded-md opacity-0 group-hover/user:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-xl">
            {user?.displayName || user?.email?.split("@")[0]} · {role}
          </div>
        )}
      </div>
    </aside>
  );
}
