"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { UserRole } from "@/context/AuthContext";
import type { BusinessLineModule } from "@/core/contracts";
import { businessLines } from "@/core/registry/businessLineRegistry";
import { nextOpenGroup, resolveInitialOpenGroup } from "./sidebarAccordion";
import {
  TrendingUp,
  Factory,
  Truck,
  Layers,
  Boxes,
  Settings,
  ChevronRight,
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Contact2,
  BarChart3,
  ListChecks,
  PackagePlus,
  Scissors,
  AlignJustify,
  Tag,
  History,
  Users,
  ShieldAlert,
  BookOpen,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────
// Réplica del árbol real de src/components/layout/sidebar.tsx (recon
// PASO 0). NO diverge de ese árbol — cualquier cambio de menú real debe
// reflejarse acá a mano hasta que exista un swap real (fuera de scope).

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
  roles?: UserRole[];
  soon?: boolean;
  badge?: number;
};

export type NavGroup = {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
};

// Caso especial: "Líneas de negocio" no es una lista plana de NavItem —
// cada línea es un LineGroup con su propio sub-acordeón (Catálogo/Inventario).
// Ver decisión B del spec: nivel externo exclusivo m2, nivel interno intacto.
export type NavLineGroup = {
  id: "lineasNegocio";
  label: string;
  icon: string;
  lines: BusinessLineModule[];
};

export type NavEntry = NavGroup | NavLineGroup;

export function isNavLineGroup(entry: NavEntry): entry is NavLineGroup {
  return entry.id === "lineasNegocio";
}

// ── Árbol NAV_GROUPS ─────────────────────────────────────────────────────
// Grupo "Producción": mismo criterio dinámico que sidebar.tsx
// (productionLines = businessLines con productionEngine, o metallic-roofing
// a propósito aunque su engine todavía no exista — ver sidebar.test.ts).

const productionLines = businessLines.filter(
  (l) => l.productionEngine || l.id === "metallic-roofing",
);

export const NAV_GROUPS: NavEntry[] = [
  {
    id: "comercial",
    label: "Comercial",
    icon: "TrendingUp",
    items: [
      { id: "panel", label: "Panel", href: "/admin", icon: "LayoutDashboard" },
      { id: "ventas", label: "Ventas", href: "/admin/sales", icon: "ShoppingCart" },
      { id: "cotizaciones", label: "Cotizaciones", href: "/admin/quotations", icon: "FileText" },
      { id: "clientes", label: "Clientes", href: "/admin/customers", icon: "Contact2" },
      { id: "reportes", label: "Reportes", href: "/admin/reports", icon: "BarChart3" },
    ],
  },
  {
    id: "produccion",
    label: "Producción",
    icon: "Factory",
    items: [
      ...productionLines.map((l) => ({
        id: `produccion-${l.id}`,
        label: `Producción ${l.displayName.split(" ")[0]}`,
        href: `/admin/lines/${l.id}/production`,
        icon: "Factory",
      })),
      {
        id: "cola-produccion",
        label: "Cola de Producción",
        href: "/admin/lines/metallic-roofing/production/queue",
        icon: "ListChecks",
        roles: ["ADMIN", "SUPERVISOR"] as UserRole[],
        // badge real viene de getProductionQueueCount (data-fetching) —
        // fuera de scope de este literal, ver decisión "sin data-fetching".
      },
    ],
  },
  {
    id: "abastecimiento",
    label: "Abastecimiento",
    icon: "Truck",
    items: [
      { id: "compras", label: "Compras", href: "/admin/purchases", icon: "PackagePlus" },
      { id: "ordenes-corte", label: "Órdenes de corte", href: "/admin/coils/cut-orders", icon: "Scissors" },
    ],
  },
  {
    id: "materiaPrima",
    label: "Materia prima",
    icon: "Layers",
    items: [
      { id: "bobinas", label: "Inventario Bobinas", href: "/admin/coils", icon: "Layers" },
      { id: "flejes", label: "Inventario Flejes", href: "/admin/coils/strips", icon: "AlignJustify" },
      { id: "acabados", label: "Acabados", href: "/admin/coils/finishes", icon: "Tag" },
    ],
  },
  {
    id: "lineasNegocio",
    label: "Líneas de negocio",
    icon: "Boxes",
    lines: businessLines,
  },
  {
    id: "administracion",
    label: "Administración",
    icon: "Settings",
    items: [
      { id: "kardex", label: "Kardex productos", href: "/admin/kardex", icon: "History", roles: ["ADMIN"] as UserRole[] },
      { id: "usuarios", label: "Usuarios", href: "/admin/users", icon: "Users", roles: ["ADMIN"] as UserRole[] },
      { id: "auditoria", label: "Auditoría", href: "/admin/audit", icon: "ShieldAlert", roles: ["ADMIN"] as UserRole[] },
      { id: "configuracion", label: "Configuración", href: "/admin/settings", icon: "Settings", roles: ["ADMIN"] as UserRole[] },
    ],
  },
];

// ── filterGroupsByRole (pura, testeada aislada) ─────────────────────────────
// Decisión A: gate por item vía `roles?`. Item sin `roles` = visible para
// todos. Grupo cuyos items visibles quedan en 0 -> se omite el grupo entero
// (cabecera incluida). `lineasNegocio` no tiene gate de rol hoy -> pasa tal
// cual (mismo criterio que sidebar.tsx real, donde ningún LineGroup gatea).
export function filterGroupsByRole(
  groups: NavEntry[],
  role: UserRole | null,
): NavEntry[] {
  const isItemVisible = (item: NavItem) =>
    !item.roles || (role !== null && item.roles.includes(role));

  return groups.reduce<NavEntry[]>((acc, group) => {
    if (isNavLineGroup(group)) {
      acc.push(group);
      return acc;
    }
    const visibleItems = group.items.filter(isItemVisible);
    if (visibleItems.length === 0) return acc;
    acc.push({ ...group, items: visibleItems });
    return acc;
  }, []);
}

// ── Icon Mapping ─────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  TrendingUp,
  Factory,
  Truck,
  Layers,
  Boxes,
  Settings,
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Contact2,
  BarChart3,
  ListChecks,
  PackagePlus,
  Scissors,
  AlignJustify,
  Tag,
  History,
  Users,
  ShieldAlert,
};

function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Layers;
}

const LINE_COLORS: Record<string, string> = {
  drywall: "var(--lob-drywall)",
  roofing: "var(--lob-pvc)",
  "metallic-roofing": "var(--lob-aluzinc)",
  trading: "var(--lob-reventa)",
  services: "var(--lob-servicios)",
};

// ── Panel con transición de alto ────────────────────────────────────────
// Porteado 1:1 del proto (uploads/sidebar-acordeon.jsx). El primer render
// NO anima: fija el alto final y sale. Medir-y-colapsar en el montaje
// pintaba todos los grupos cerrados a alto completo durante al menos un
// frame — e indefinidamente donde rAF no corre (pestaña de fondo, iframe
// sin pintar, captura, impresión).
function Panel({ open, children }: { open: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const [h, setH] = useState<number | "auto">(open ? "auto" : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!mounted.current) {
      mounted.current = true;
      setH(open ? "auto" : 0);
      return;
    }
    if (open) {
      setH(el.scrollHeight);
      const t = setTimeout(() => setH("auto"), 210);
      return () => clearTimeout(t);
    }
    setH(el.scrollHeight);
    const raf = requestAnimationFrame(() => setH(0));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  return (
    <div
      className="overflow-hidden transition-[height] duration-200 ease-in-out"
      style={{ height: h === "auto" ? "auto" : `${h}px` }}
    >
      <div ref={ref}>{children}</div>
    </div>
  );
}

// ── Cabecera de grupo (m2) ──────────────────────────────────────────────

function GroupHeader({
  icon: Icon,
  label,
  open,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors duration-150 text-[10.5px] font-bold uppercase tracking-wider
        ${open ? "text-[var(--color-fg)]" : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-fg)]"}`}
    >
      <Icon
        size={16}
        className={`shrink-0 ${open ? "text-[var(--color-primary)]" : "text-[var(--color-fg-muted)] opacity-85"}`}
      />
      <span className="flex-1 truncate">{label}</span>
      <ChevronRight
        size={14}
        className={`shrink-0 text-[var(--color-fg-subtle)] transition-transform duration-200 ${open ? "rotate-90" : ""}`}
      />
    </button>
  );
}

// ── Ítem hoja (m2: ficha blanca con borde, activo azul lleno) ───────────
// El proto no reserva ícono por-ítem (solo el marcador `mk`); acá SÍ se
// agrega el ícono real del item (decisión de alcance: "iconos... de cada
// item que reporta el recon") además del marcador, para no perder la
// distinción visual que sí tiene el menú real hoy.

function ItemM2({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = getIcon(item.icon);

  if (item.soon) {
    return (
      <div className="flex items-center gap-2.5 rounded-md border border-dashed border-[var(--color-border)] bg-transparent px-2.5 py-1.5 pl-[11px] text-[12.5px] font-medium text-[var(--color-fg-subtle)] cursor-default">
        <span className="w-[3px] h-[13px] rounded-sm bg-[var(--color-border-strong)] shrink-0" />
        <Icon size={14} className="shrink-0" />
        <span className="flex-1 truncate">{item.label}</span>
        <span className="shrink-0 text-[9.5px] font-bold uppercase tracking-wide text-[var(--color-fg-subtle)] bg-[var(--color-surface-muted)] border border-[var(--color-border)] px-1.5 py-0.5 rounded-full">
          Pronto
        </span>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 rounded-md border px-2.5 py-1.5 pl-[11px] text-[12.5px] font-medium transition-colors
        ${
          active
            ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white font-semibold"
            : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
        }`}
    >
      <span
        className={`w-[3px] h-[13px] rounded-sm shrink-0 ${active ? "bg-white/60" : "bg-[var(--color-border-strong)]"}`}
      />
      <Icon size={14} className="shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span
          className={`shrink-0 text-[10px] font-bold rounded-full px-1.5 py-0.5 tabular-nums ${
            active ? "text-white bg-white/25" : "text-[var(--color-warning)] bg-[var(--color-warning-soft)]"
          }`}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// ── Grupo m2 estándar (items NavItem planos) ─────────────────────────────

function GroupM2({
  group,
  open,
  onToggle,
  activeMap,
}: {
  group: NavGroup;
  open: boolean;
  onToggle: () => void;
  activeMap: Record<string, boolean>;
}) {
  if (group.items.length === 0) return null;
  const Icon = getIcon(group.icon);

  return (
    <div
      className={`rounded-lg mb-1 ${open ? "bg-[var(--color-surface-muted)] shadow-[inset_0_0_0_1px_var(--color-border)]" : ""}`}
    >
      <GroupHeader icon={Icon} label={group.label} open={open} onClick={onToggle} />
      <Panel open={open}>
        <div className="flex flex-col gap-0.5 px-[7px] pb-[7px] pt-1">
          {group.items.map((item) => (
            <ItemM2 key={item.id} item={item} active={!!activeMap[item.id]} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ── LineGroup standalone (decisión B) ────────────────────────────────────
// Réplica del LineGroup de sidebar.tsx, sin la prop `collapsed` (decisión
// F: preview siempre expandido). NO se importa del original — sidebar.tsx
// no lo exporta y no se toca ese archivo en este front.

function LineGroupItem({
  line,
  open,
  onToggle,
  pathname,
}: {
  line: BusinessLineModule;
  open: boolean;
  onToggle: () => void;
  pathname: string;
}) {
  const color = LINE_COLORS[line.id] || "var(--color-primary)";
  const isCatalogActive = pathname === `/admin/lines/${line.id}/catalog`;
  const isInventoryActive = pathname === `/admin/lines/${line.id}/inventory`;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 pl-[11px] text-[12.5px] font-semibold text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)] transition-colors"
      >
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="flex-1 text-left truncate">{line.displayName}</span>
        <ChevronRight size={14} className={`shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-[var(--color-border)] pl-2 py-1">
          <Link
            href={`/admin/lines/${line.id}/catalog`}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition-all
              ${
                isCatalogActive
                  ? "text-[var(--color-primary)] font-bold bg-[var(--color-primary-soft)]"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-muted)]"
              }`}
          >
            <BookOpen size={14} /> Catálogo
          </Link>
          {line.inventoryEngine && (
            <Link
              href={`/admin/lines/${line.id}/inventory`}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition-all
                ${
                  isInventoryActive
                    ? "text-[var(--color-primary)] font-bold bg-[var(--color-primary-soft)]"
                    : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-muted)]"
                }`}
            >
              <Warehouse size={14} /> Inventario
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function LineasNegocioGroup({
  group,
  open,
  onToggle,
  pathname,
  openLines,
  onToggleLine,
}: {
  group: NavLineGroup;
  open: boolean;
  onToggle: () => void;
  pathname: string;
  openLines: Record<string, boolean>;
  onToggleLine: (id: string) => void;
}) {
  const Icon = getIcon(group.icon);

  return (
    <div
      className={`rounded-lg mb-1 ${open ? "bg-[var(--color-surface-muted)] shadow-[inset_0_0_0_1px_var(--color-border)]" : ""}`}
    >
      <GroupHeader icon={Icon} label={group.label} open={open} onClick={onToggle} />
      <Panel open={open}>
        <div className="flex flex-col gap-1.5 px-[7px] pb-[7px] pt-1">
          {group.lines.map((line) => (
            <LineGroupItem
              key={line.id}
              line={line}
              open={!!openLines[line.id]}
              onToggle={() => onToggleLine(line.id)}
              pathname={pathname}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────
// Standalone/controlado: recibe `pathname` y `role` por prop (no usa
// usePathname()/useAuth() propios) para que la página preview pueda
// simular navegación y rol sin re-login ni router real (decisión E).
// NO se monta en AdminShell — ver gates del spec.

export type SidebarAccordionPreviewState = {
  openGroup: string | null;
  activeItemId: string | null;
};

export default function SidebarAccordionPreview({
  pathname,
  role,
  onStateChange,
}: {
  pathname: string;
  role: UserRole | null;
  /** Read-out para la página preview (decisión E) — no usado por el árbol real. */
  onStateChange?: (state: SidebarAccordionPreviewState) => void;
}) {
  const [openLines, setOpenLines] = useState<Record<string, boolean>>({});
  const toggleLine = (id: string) =>
    setOpenLines((prev) => ({ ...prev, [id]: !prev[id] }));

  // ── Predicados de ruta activa (copiados 1:1 de sidebar.tsx — decisión D,
  // NO unificar === vs startsWith acá) ──
  const isPanelActive = pathname === "/admin";
  const isSalesActive = pathname === "/admin/sales";
  const isQuotationsActive = pathname === "/admin/quotations";
  const isCustomersActive = pathname === "/admin/customers";
  const isReportsActive = pathname.startsWith("/admin/reports");
  const isQueueActive = pathname === "/admin/lines/metallic-roofing/production/queue";
  const isPurchasesActive = pathname.startsWith("/admin/purchases");
  const isCutOrdersActive = pathname === "/admin/coils/cut-orders";
  const isCoilsActive = pathname === "/admin/coils";
  const isStripsActive = pathname === "/admin/coils/strips";
  const isFinishesActive = pathname === "/admin/coils/finishes";
  const isKardexActive = pathname === "/admin/kardex";
  const isUsersActive = pathname === "/admin/users";
  const isAuditActive = pathname === "/admin/audit";
  const isSettingsActive = pathname === "/admin/settings";

  const productionLineActiveMap: Record<string, boolean> = {};
  productionLines.forEach((l) => {
    productionLineActiveMap[`produccion-${l.id}`] = pathname === `/admin/lines/${l.id}/production`;
  });
  const isAnyProductionLineActive = Object.values(productionLineActiveMap).some(Boolean);

  const isAnyLineCatalogOrInventoryActive = businessLines.some(
    (l) => pathname === `/admin/lines/${l.id}/catalog` || pathname === `/admin/lines/${l.id}/inventory`,
  );

  const activeMap: Record<string, boolean> = {
    panel: isPanelActive,
    ventas: isSalesActive,
    cotizaciones: isQuotationsActive,
    clientes: isCustomersActive,
    reportes: isReportsActive,
    ...productionLineActiveMap,
    "cola-produccion": isQueueActive,
    compras: isPurchasesActive,
    "ordenes-corte": isCutOrdersActive,
    bobinas: isCoilsActive,
    flejes: isStripsActive,
    acabados: isFinishesActive,
    kardex: isKardexActive,
    usuarios: isUsersActive,
    auditoria: isAuditActive,
    configuracion: isSettingsActive,
  };

  const groupsForSync = [
    {
      id: "comercial",
      hasActiveChild: isPanelActive || isSalesActive || isQuotationsActive || isCustomersActive || isReportsActive,
    },
    { id: "produccion", hasActiveChild: isAnyProductionLineActive || isQueueActive },
    { id: "abastecimiento", hasActiveChild: isPurchasesActive || isCutOrdersActive },
    { id: "materiaPrima", hasActiveChild: isCoilsActive || isStripsActive || isFinishesActive },
    { id: "lineasNegocio", hasActiveChild: isAnyLineCatalogOrInventoryActive },
    { id: "administracion", hasActiveChild: isKardexActive || isUsersActive || isAuditActive || isSettingsActive },
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

  const visibleGroups = filterGroupsByRole(NAV_GROUPS, role);

  const activeItemId = Object.keys(activeMap).find((id) => activeMap[id]) ?? null;

  useEffect(() => {
    onStateChange?.({ openGroup, activeItemId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openGroup, activeItemId]);

  return (
    <aside className="w-[272px] h-full bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col">
      <div className="h-[58px] flex items-center gap-2.5 px-[15px] border-b border-[var(--color-border)] shrink-0">
        <div className="w-[29px] h-[29px] rounded-[7px] shrink-0 bg-[var(--color-primary)] grid place-items-center text-white font-mono font-semibold text-[11.5px]">
          AY
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[13.5px] font-bold tracking-tight">AYR Steel</span>
          <span className="text-[10.5px] text-[var(--color-fg-subtle)]">ERP · Operaciones</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-[9px] custom-scrollbar">
        {visibleGroups.map((group) => {
          const isOpen = openGroup === group.id;
          if (isNavLineGroup(group)) {
            return (
              <LineasNegocioGroup
                key={group.id}
                group={group}
                open={isOpen}
                onToggle={() => handleToggleGroup(group.id)}
                pathname={pathname}
                openLines={openLines}
                onToggleLine={toggleLine}
              />
            );
          }
          return (
            <GroupM2
              key={group.id}
              group={group}
              open={isOpen}
              onToggle={() => handleToggleGroup(group.id)}
              activeMap={activeMap}
            />
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-[var(--color-border)] p-[9px] flex items-center gap-2.5">
        <div className="w-[31px] h-[31px] rounded-full shrink-0 grid place-items-center text-[11px] font-bold text-[var(--color-primary)] bg-[var(--color-primary-soft)] border border-[var(--color-border)]">
          {role ? role.slice(0, 2) : "—"}
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-[12.5px] font-semibold truncate">Vista previa</span>
          <span className="text-[10.5px] text-[var(--color-fg-muted)] truncate">{role ?? "Sin rol"}</span>
        </div>
      </div>
    </aside>
  );
}
