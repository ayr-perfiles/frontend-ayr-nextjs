"use client";

// Página de validación del front "Sidebar acordeón m2" (PARKED, ver CLAUDE.md).
// Standalone a propósito: vive FUERA de /admin porque src/app/admin/layout.tsx
// envuelve TODO lo que cuelga de /admin/* en <AdminShell> (que monta el
// Sidebar real) — no hay forma de optar afuera de eso por página. Poner esta
// ruta bajo /admin, como decía el spec original, hubiera violado el gate
// "NO usar AdminShell" sin remedio. Se replica acá, self-contained, el mismo
// gate ADMIN-only que usa src/app/admin/layout.tsx (AuthGuard + ROUTE_PERMISSIONS),
// con su propio <AuthProvider> porque el de layout.tsx no llega hasta acá.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap } from "lucide-react";
import { AuthProvider, useAuth, type UserRole } from "@/context/AuthContext";
import SidebarAccordionPreview, {
  NAV_GROUPS,
  filterGroupsByRole,
  isNavLineGroup,
  type SidebarAccordionPreviewState,
} from "@/components/layout/SidebarAccordionPreview";

const ROLES: UserRole[] = ["ADMIN", "SUPERVISOR", "OPERATOR"];

// ── Todas las rutas reales del árbol (para el dropdown de pathname mock) ──
function collectAllHrefs(): { label: string; href: string }[] {
  const out: { label: string; href: string }[] = [];
  for (const group of NAV_GROUPS) {
    if (isNavLineGroup(group)) {
      for (const line of group.lines) {
        out.push({ label: `${line.displayName} · Catálogo`, href: `/admin/lines/${line.id}/catalog` });
        if (line.inventoryEngine) {
          out.push({ label: `${line.displayName} · Inventario`, href: `/admin/lines/${line.id}/inventory` });
        }
      }
    } else {
      for (const item of group.items) {
        out.push({ label: `${group.label} · ${item.label}`, href: item.href });
      }
    }
  }
  return out;
}

// ── Panel de control + read-outs (decisión E) ──────────────────────────────

function PreviewControls({
  pathname,
  onPathnameChange,
  role,
  onRoleChange,
  state,
}: {
  pathname: string;
  onPathnameChange: (v: string) => void;
  role: UserRole;
  onRoleChange: (v: UserRole) => void;
  state: SidebarAccordionPreviewState | null;
}) {
  const allHrefs = useMemo(() => collectAllHrefs(), []);

  const hiddenItems = useMemo(() => {
    const visible = filterGroupsByRole(NAV_GROUPS, role);
    const visibleIds = new Set(
      visible.flatMap((g) => (isNavLineGroup(g) ? [] : g.items.map((i) => i.id))),
    );
    return NAV_GROUPS.flatMap((g) => (isNavLineGroup(g) ? [] : g.items)).filter(
      (i) => !visibleIds.has(i.id),
    );
  }, [role]);

  const activeItemLabel = useMemo(() => {
    if (!state?.activeItemId) return null;
    for (const g of NAV_GROUPS) {
      if (isNavLineGroup(g)) continue;
      const found = g.items.find((i) => i.id === state.activeItemId);
      if (found) return `${g.label} · ${found.label}`;
    }
    return state.activeItemId;
  }, [state]);

  const openGroupLabel = useMemo(() => {
    if (!state?.openGroup) return "Ninguno";
    const g = NAV_GROUPS.find((g) => g.id === state.openGroup);
    return g?.label ?? state.openGroup;
  }, [state]);

  return (
    <div
      className="flex flex-col gap-5 rounded-[var(--radius-xl)] p-5"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-md)" }}
    >
      <div>
        <h2 className="text-sm font-bold text-[var(--color-fg)] mb-1">Simulación</h2>
        <p className="text-[12.5px] text-[var(--color-fg-muted)]">
          Cambia ruta y rol sin navegar de verdad ni re-loguearte. El sidebar de la izquierda reacciona en vivo.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-fg-subtle)]">
          Ruta simulada (pathname)
        </span>
        <select
          value={pathname}
          onChange={(e) => onPathnameChange(e.target.value)}
          className="rounded-[var(--radius-md)] border px-2.5 py-2 text-[13px]"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          {allHrefs.map((h) => (
            <option key={h.href} value={h.href}>
              {h.label} — {h.href}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-fg-subtle)]">
          Rol simulado
        </span>
        <select
          value={role}
          onChange={(e) => onRoleChange(e.target.value as UserRole)}
          className="rounded-[var(--radius-md)] border px-2.5 py-2 text-[13px]"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <div className="border-t pt-4 flex flex-col gap-3" style={{ borderColor: "var(--color-border)" }}>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-fg-subtle)]">
          Read-outs en vivo
        </h3>

        <div className="text-[13px]">
          <span className="text-[var(--color-fg-muted)]">Grupo abierto: </span>
          <span className="font-semibold text-[var(--color-fg)]">{openGroupLabel}</span>
        </div>

        <div className="text-[13px]">
          <span className="text-[var(--color-fg-muted)]">Item activo: </span>
          <span className="font-semibold text-[var(--color-fg)]">{activeItemLabel ?? "Ninguno"}</span>
        </div>

        <div className="text-[13px]">
          <span className="text-[var(--color-fg-muted)]">
            Items ocultos por rol ({hiddenItems.length}):
          </span>
          {hiddenItems.length === 0 ? (
            <div className="text-[var(--color-fg-subtle)] mt-1">Ninguno — {role} ve todo.</div>
          ) : (
            <ul className="mt-1 list-disc pl-5 text-[var(--color-fg)]">
              {hiddenItems.map((i) => (
                <li key={i.id}>{i.label}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Contenido gateado (requiere sesión ADMIN real) ─────────────────────────

function SidebarPreviewContent() {
  const { user, role, loading, authError } = useAuth();
  const router = useRouter();

  const [pathname, setPathname] = useState("/admin/coils");
  const [simulatedRole, setSimulatedRole] = useState<UserRole>("ADMIN");
  const [state, setState] = useState<SidebarAccordionPreviewState | null>(null);

  useEffect(() => {
    if (loading || authError) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (role !== "ADMIN") {
      router.push("/admin");
    }
  }, [user, role, loading, authError, router]);

  if (loading || (user && !role && !authError)) {
    return (
      <div className="flex h-screen items-center justify-center gap-3" style={{ background: "var(--color-background)" }}>
        <Loader2 className="animate-spin text-[var(--color-fg-subtle)]" size={28} />
        <span className="text-[var(--color-fg-muted)]">Cargando…</span>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--color-background)" }}>
        <div className="text-center">
          <Zap className="mx-auto mb-3 text-[var(--color-danger)]" size={28} />
          <p className="text-[var(--color-fg-muted)]">No se pudo verificar la sesión. Recargá la página.</p>
        </div>
      </div>
    );
  }

  if (!user || role !== "ADMIN") return null;

  return (
    <div className="min-h-screen p-8" style={{ background: "var(--color-background)" }}>
      <div className="max-w-[1100px] mx-auto flex flex-col gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-fg-subtle)]">
            AYR Steel · Preview interno
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-fg)]">
            Sidebar acordeón — modelo 2 (panel hundido)
          </h1>
          <p className="text-[13px] text-[var(--color-fg-muted)] mt-1">
            Página de validación, NO reemplaza el sidebar real (src/components/layout/sidebar.tsx, sin tocar).
            Feature branch feat/sidebar-accordion-preview.
          </p>
        </div>

        <div className="flex gap-8 items-start flex-wrap">
          <div
            className="shrink-0 rounded-[var(--radius-xl)] overflow-hidden"
            style={{ width: 272, height: 760, boxShadow: "var(--shadow-lg)", background: "var(--color-surface)" }}
          >
            <SidebarAccordionPreview pathname={pathname} role={simulatedRole} onStateChange={setState} />
          </div>

          <div className="flex-1 min-w-[320px]">
            <PreviewControls
              pathname={pathname}
              onPathnameChange={setPathname}
              role={simulatedRole}
              onRoleChange={setSimulatedRole}
              state={state}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SidebarPreviewPage() {
  return (
    <AuthProvider>
      <SidebarPreviewContent />
    </AuthProvider>
  );
}
