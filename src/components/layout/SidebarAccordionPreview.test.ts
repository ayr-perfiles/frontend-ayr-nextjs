import { describe, it, expect } from "vitest";
import { filterGroupsByRole, NAV_GROUPS, type NavGroup, type NavEntry } from "./SidebarAccordionPreview";

describe("SidebarAccordion - filterGroupsByRole (gate por rol, decisión A)", () => {
  it("ADMIN ve todos los items de Administración y Cola de Producción", () => {
    const filtered = filterGroupsByRole(NAV_GROUPS, "ADMIN");
    const admin = filtered.find((g) => g.id === "administracion") as NavGroup | undefined;
    expect(admin).toBeDefined();
    expect(admin!.items.map((i) => i.id)).toEqual(["kardex", "usuarios", "auditoria", "configuracion"]);

    const produccion = filtered.find((g) => g.id === "produccion") as NavGroup;
    expect(produccion.items.some((i) => i.id === "cola-produccion")).toBe(true);
  });

  it("OPERATOR no ve el grupo Administración (0 items visibles -> grupo omitido entero)", () => {
    const filtered = filterGroupsByRole(NAV_GROUPS, "OPERATOR");
    expect(filtered.some((g) => g.id === "administracion")).toBe(false);
  });

  it("OPERATOR no ve Cola de Producción, pero sí el resto del grupo Producción", () => {
    const filtered = filterGroupsByRole(NAV_GROUPS, "OPERATOR");
    const produccion = filtered.find((g) => g.id === "produccion") as NavGroup;
    expect(produccion).toBeDefined();
    expect(produccion.items.some((i) => i.id === "cola-produccion")).toBe(false);
    expect(produccion.items.length).toBeGreaterThan(0);
  });

  it("SUPERVISOR sí ve Cola de Producción pero no Administración", () => {
    const filtered = filterGroupsByRole(NAV_GROUPS, "SUPERVISOR");
    expect(filtered.some((g) => g.id === "administracion")).toBe(false);
    const produccion = filtered.find((g) => g.id === "produccion") as NavGroup;
    expect(produccion.items.some((i) => i.id === "cola-produccion")).toBe(true);
  });

  it("grupo sintético con 0 items visibles para el rol se omite entero", () => {
    const groups: NavEntry[] = [
      {
        id: "soloAdmin",
        label: "Solo Admin",
        icon: "Settings",
        items: [{ id: "x", label: "X", href: "/x", icon: "Settings", roles: ["ADMIN"] }],
      },
    ];
    expect(filterGroupsByRole(groups, "OPERATOR")).toEqual([]);
  });

  it("lineasNegocio pasa siempre (sin gate de rol declarado en el árbol)", () => {
    const filtered = filterGroupsByRole(NAV_GROUPS, "OPERATOR");
    expect(filtered.some((g) => g.id === "lineasNegocio")).toBe(true);
  });

  it("role null oculta todos los items gateados", () => {
    const filtered = filterGroupsByRole(NAV_GROUPS, null);
    expect(filtered.some((g) => g.id === "administracion")).toBe(false);
    const produccion = filtered.find((g) => g.id === "produccion") as NavGroup;
    expect(produccion.items.some((i) => i.id === "cola-produccion")).toBe(false);
  });
});
