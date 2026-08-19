"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useAuth, UserRole } from "@/context/AuthContext";
import { businessLines } from "@/core/registry/businessLineRegistry";
import type { BusinessLineModule, MenuItem } from "@/core/contracts";
import { getProductionQueueCount } from "@/core/sales/services/salesService";
import {
  nextOpenGroup,
  resolveInitialOpenGroup,
  shouldShowGroupItems,
} from "./sidebarAccordion";
import {
  LayoutDashboard,
  Factory,
  ShoppingCart,
  BarChart3,
  Settings,
  ChevronRight,
  Zap,
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
  PanelLeft,
  ListChecks,
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
  PanelLeft,
  ListChecks,
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
        <Icon
          size={18}
          className={`shrink-0 ${active ? "text-[var(--color-primary)]" : "text-[var(--color-fg-subtle)] group-hover:text-[var(--color-fg)]"}`}
        />
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
  groupId,
  openGroup,
  onToggleGroup,
  collapsed,
  children,
  hasVisibleChildren = true,
}: {
  icon: string;
  title: string;
  groupId: string;
  openGroup: string | null;
  onToggleGroup: (groupId: string) => void;
  collapsed: boolean;
  children: React.ReactNode;
  hasVisibleChildren?: boolean;
}) {
  if (!hasVisibleChildren) return null;

  const Icon = getIcon(icon);
  const isExpanded = openGroup === groupId;
  const showItems = shouldShowGroupItems({ collapsed, openGroup, groupId });

  return (
    <div className="space-y-1.5">
      {!collapsed && (
        <button
          type="button"
          onClick={() => onToggleGroup(groupId)}
          className={`
            w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-200
            ${
              isExpanded
                ? "text-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
            }
          `}
        >
          <Icon
            size={14}
            className={
              isExpanded
                ? "text-[var(--color-primary)]"
                : "text-[var(--color-fg-subtle)] opacity-70"
            }
          />
          <span className="flex-1 text-left truncate">{title}</span>
          <ChevronRight
            size={14}
            className={`shrink-0 transition-transform duration-200 ${
              isExpanded ? "rotate-90 text-[var(--color-primary)]" : "text-[var(--color-fg-subtle)]"
            }`}
          />
        </button>
      )}
      {collapsed && (
        <div className="h-px bg-[var(--color-border)] mx-4 my-2 opacity-50" />
      )}
      {showItems && <div className="space-y-0.5">{children}</div>}
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
  collapsed = false,
}: {
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const { user, role } = useAuth();

  const [openLines, setOpenLines] = useState<Record<string, boolean>>({
    drywall: true,
  });

  const toggleLine = (id: string) => {
    setOpenLines((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isRoleAllowed = (allowedRoles?: string[]) => {
    if (!allowedRoles) return true;
    return allowedRoles.includes(role || "");
  };

  // Cola de Producción: link + badge visibles solo para ADMIN/SUPERVISOR (mismo gate que el fetch de abajo).
  const canSeeProductionQueue = role === "ADMIN" || role === "SUPERVISOR";
  const [productionQueueCount, setProductionQueueCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!canSeeProductionQueue) return;
    let isMounted = true;
    getProductionQueueCount()
      .then((count) => {
        if (isMounted) setProductionQueueCount(count);
      })
      .catch((err) => {
        console.warn("No se pudo obtener el conteo de la cola de producción:", err);
      });
    return () => {
      isMounted = false;
    };
  }, [canSeeProductionQueue]);

  // ── Predicados de ruta activa por ítem (nombrados, reusados tal cual abajo
  // en cada NavItem y para derivar qué grupo top contiene la ruta activa) ──
  const isPanelActive = pathname === "/admin";
  const isSalesActive = pathname === "/admin/sales";
  const isQuotationsActive = pathname === "/admin/quotations";
  const isCustomersActive = pathname === "/admin/customers";
  const isReportsActive = pathname.startsWith("/admin/reports");

  const productionLines = businessLines.filter(
    (l) => l.productionEngine || l.id === "metallic-roofing",
  );
  const isAnyProductionLineActive = productionLines.some(
    (l) => pathname === `/admin/lines/${l.id}/production`,
  );
  const isQueueActive =
    pathname === "/admin/lines/metallic-roofing/production/queue";

  const isPurchasesActive = pathname.startsWith("/admin/purchases");
  const isCutOrdersActive = pathname === "/admin/coils/cut-orders";

  const isCoilsActive = pathname === "/admin/coils";
  const isStripsActive = pathname === "/admin/coils/strips";
  const isFinishesActive = pathname === "/admin/coils/finishes";

  const isAnyLineCatalogOrInventoryActive = businessLines.some(
    (l) =>
      pathname === `/admin/lines/${l.id}/catalog` ||
      pathname === `/admin/lines/${l.id}/inventory`,
  );

  const isKardexActive = pathname === "/admin/kardex";
  const isUsersActive = pathname === "/admin/users";
  const isAuditActive = pathname === "/admin/audit";
  const isSettingsActive = pathname === "/admin/settings";

  // ── Acordeón EXCLUSIVO de los 6 grupos top (distinto de `openLines`,
  // que sigue siendo el acordeón no-exclusivo por-línea dentro de "Líneas de negocio") ──
  const groupsForSync = [
    {
      id: "comercial",
      hasActiveChild:
        isPanelActive ||
        isSalesActive ||
        isQuotationsActive ||
        isCustomersActive ||
        isReportsActive,
    },
    {
      id: "produccion",
      hasActiveChild: isAnyProductionLineActive || isQueueActive,
    },
    {
      id: "abastecimiento",
      hasActiveChild: isPurchasesActive || isCutOrdersActive,
    },
    {
      id: "materiaPrima",
      hasActiveChild: isCoilsActive || isStripsActive || isFinishesActive,
    },
    {
      id: "lineasNegocio",
      hasActiveChild: isAnyLineCatalogOrInventoryActive,
    },
    {
      id: "administracion",
      hasActiveChild:
        isKardexActive || isUsersActive || isAuditActive || isSettingsActive,
    },
  ];

  const [openGroup, setOpenGroup] = useState<string | null>(() =>
    resolveInitialOpenGroup(groupsForSync),
  );

  useEffect(() => {
    setOpenGroup(resolveInitialOpenGroup(groupsForSync));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleToggleGroup = (groupId: string) => {
    setOpenGroup((current) => nextOpenGroup(current, groupId));
  };

  return (
    <aside
      className={`
        bg-white border-r border-[var(--color-border)] flex flex-col h-screen sticky top-0 z-40 transition-all duration-300 ease-in-out
        ${collapsed ? "w-[72px]" : "w-[260px]"}
      `}
    >
      {/* BRAND */}
      <div
        className={`p-4 h-14 flex items-center border-b border-[var(--color-border)] ${collapsed ? "justify-center px-0" : "justify-between"}`}
      >
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
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 p-3 space-y-6 overflow-y-auto custom-scrollbar">
        {/* COMERCIAL */}
        <Group
          icon="TrendingUp"
          title="Comercial"
          groupId="comercial"
          openGroup={openGroup}
          onToggleGroup={handleToggleGroup}
          collapsed={collapsed}
        >
          <NavItem
            icon="LayoutDashboard"
            label="Panel"
            href="/admin"
            active={isPanelActive}
            collapsed={collapsed}
          />
          <NavItem
            icon="ShoppingCart"
            label="Ventas"
            href="/admin/sales"
            active={isSalesActive}
            collapsed={collapsed}
          />
          {/* <NavItem
            icon="Upload"
            label="Importar Ventas"
            href="/admin/sales/import"
            active={pathname === "/admin/sales/import"}
            collapsed={collapsed}
          /> */}
          <NavItem
            icon="FileText"
            label="Cotizaciones"
            href="/admin/quotations"
            active={isQuotationsActive}
            collapsed={collapsed}
          />
          <NavItem
            icon="Contact2"
            label="Clientes"
            href="/admin/customers"
            active={isCustomersActive}
            collapsed={collapsed}
          />
          <NavItem
            icon="BarChart3"
            label="Reportes"
            href="/admin/reports"
            active={isReportsActive}
            collapsed={collapsed}
          />
        </Group>

        {/* PRODUCCIÓN */}
        <Group
          icon="Factory"
          title="Producción"
          groupId="produccion"
          openGroup={openGroup}
          onToggleGroup={handleToggleGroup}
          collapsed={collapsed}
          hasVisibleChildren={productionLines.length > 0 || canSeeProductionQueue}
        >
          {productionLines.map((l) => (
            <NavItem
              key={l.id}
              icon="Factory"
              label={`Producción ${l.displayName.split(" ")[0]}`}
              href={`/admin/lines/${l.id}/production`}
              active={pathname === `/admin/lines/${l.id}/production`}
              collapsed={collapsed}
            />
          ))}
          {canSeeProductionQueue && (
            <NavItem
              icon="ListChecks"
              label="Cola de Producción"
              href="/admin/lines/metallic-roofing/production/queue"
              active={isQueueActive}
              badge={productionQueueCount}
              collapsed={collapsed}
            />
          )}
        </Group>

        {/* ABASTECIMIENTO */}
        <Group
          icon="Truck"
          title="Abastecimiento"
          groupId="abastecimiento"
          openGroup={openGroup}
          onToggleGroup={handleToggleGroup}
          collapsed={collapsed}
        >
          <NavItem
            icon="PackagePlus"
            label="Compras"
            href="/admin/purchases"
            active={isPurchasesActive}
            collapsed={collapsed}
          />
          <NavItem
            icon="Scissors"
            label="Órdenes de corte"
            href="/admin/coils/cut-orders"
            active={isCutOrdersActive}
            collapsed={collapsed}
          />
        </Group>

        {/* MATERIA PRIMA */}
        <Group
          icon="Layers"
          title="Materia prima"
          groupId="materiaPrima"
          openGroup={openGroup}
          onToggleGroup={handleToggleGroup}
          collapsed={collapsed}
        >
          <NavItem
            icon="Layers"
            label="Inventario Bobinas"
            href="/admin/coils"
            active={isCoilsActive}
            collapsed={collapsed}
          />
          <NavItem
            icon="AlignJustify"
            label="Inventario Flejes"
            href="/admin/coils/strips"
            active={isStripsActive}
            collapsed={collapsed}
          />
          <NavItem
            icon="Tag"
            label="Acabados"
            href="/admin/coils/finishes"
            active={isFinishesActive}
            collapsed={collapsed}
          />
        </Group>

        {/* LÍNEAS DE NEGOCIO */}
        <Group
          icon="Boxes"
          title="Líneas de negocio"
          groupId="lineasNegocio"
          openGroup={openGroup}
          onToggleGroup={handleToggleGroup}
          collapsed={collapsed}
        >
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
          <Group
            icon="Settings"
            title="Administración"
            groupId="administracion"
            openGroup={openGroup}
            onToggleGroup={handleToggleGroup}
            collapsed={collapsed}
          >
            <NavItem
              icon="History"
              label="Kardex productos"
              href="/admin/kardex"
              active={isKardexActive}
              collapsed={collapsed}
            />
            <NavItem
              icon="Users"
              label="Usuarios"
              href="/admin/users"
              active={isUsersActive}
              collapsed={collapsed}
            />
            <NavItem
              icon="ShieldAlert"
              label="Auditoría"
              href="/admin/audit"
              active={isAuditActive}
              collapsed={collapsed}
            />
            <NavItem
              icon="Settings"
              label="Configuración"
              href="/admin/settings"
              active={isSettingsActive}
              collapsed={collapsed}
            />
          </Group>
        )}
      </nav>

      {/* USER FOOTER */}
      <div
        className={`p-4 border-t border-[var(--color-border)] bg-slate-50/50 relative ${collapsed ? "flex justify-center" : ""}`}
      >
        {!collapsed && (
          <div className="flex items-center justify-between px-1 opacity-60">
            <span className="text-[10px] font-bold text-slate-400">v1.1</span>
            <div
              className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter ${
                (process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV) ===
                "production"
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                  : (process.env.NEXT_PUBLIC_APP_ENV ||
                        process.env.NODE_ENV) === "test"
                    ? "bg-amber-50 text-amber-600 border border-amber-100"
                    : "bg-slate-100 text-slate-500 border border-slate-200"
              }`}
            >
              {process.env.NEXT_PUBLIC_APP_ENV === "production" ||
              process.env.NODE_ENV === "production"
                ? "produccion"
                : process.env.NEXT_PUBLIC_APP_ENV === "test"
                  ? "test"
                  : "desarrollo"}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
