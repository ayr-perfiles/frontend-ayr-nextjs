import { describe, it, expect } from "vitest";
import {
  nextOpenGroup,
  resolveInitialOpenGroup,
  shouldShowGroupItems,
} from "./sidebarAccordion";

describe("sidebarAccordion - nextOpenGroup (toggle exclusivo)", () => {
  it("abrir A desde null -> A", () => {
    expect(nextOpenGroup(null, "A")).toBe("A");
  });

  it("con A abierto, click en B -> B (cierra A, abre B)", () => {
    expect(nextOpenGroup("A", "B")).toBe("B");
  });

  it("con B abierto, click en B de nuevo -> null (cierra)", () => {
    expect(nextOpenGroup("B", "B")).toBeNull();
  });

  it("con A abierto, click en A -> null (cierra el mismo)", () => {
    expect(nextOpenGroup("A", "A")).toBeNull();
  });
});

describe("sidebarAccordion - resolveInitialOpenGroup (sync con ruta activa)", () => {
  it("un grupo con hasActiveChild true -> ese id", () => {
    const groups = [
      { id: "comercial", hasActiveChild: false },
      { id: "produccion", hasActiveChild: true },
      { id: "abastecimiento", hasActiveChild: false },
    ];
    expect(resolveInitialOpenGroup(groups)).toBe("produccion");
  });

  it("ningún grupo activo -> null", () => {
    const groups = [
      { id: "comercial", hasActiveChild: false },
      { id: "produccion", hasActiveChild: false },
    ];
    expect(resolveInitialOpenGroup(groups)).toBeNull();
  });

  it("dos grupos activos -> gana el primero (orden del array)", () => {
    const groups = [
      { id: "comercial", hasActiveChild: false },
      { id: "produccion", hasActiveChild: true },
      { id: "materiaPrima", hasActiveChild: true },
    ];
    expect(resolveInitialOpenGroup(groups)).toBe("produccion");
  });

  it("array vacío -> null", () => {
    expect(resolveInitialOpenGroup([])).toBeNull();
  });
});

describe("sidebarAccordion - shouldShowGroupItems (gate de render + modo colapsado)", () => {
  it("collapsed=true -> siempre true, aunque openGroup no matchee el grupo", () => {
    expect(
      shouldShowGroupItems({ collapsed: true, openGroup: "otro", groupId: "comercial" }),
    ).toBe(true);
  });

  it("collapsed=true con openGroup null -> también true", () => {
    expect(
      shouldShowGroupItems({ collapsed: true, openGroup: null, groupId: "comercial" }),
    ).toBe(true);
  });

  it("collapsed=false, openGroup matchea el grupo -> true", () => {
    expect(
      shouldShowGroupItems({ collapsed: false, openGroup: "comercial", groupId: "comercial" }),
    ).toBe(true);
  });

  it("collapsed=false, openGroup NO matchea -> false", () => {
    expect(
      shouldShowGroupItems({ collapsed: false, openGroup: "produccion", groupId: "comercial" }),
    ).toBe(false);
  });

  it("collapsed=false, openGroup null -> false (todo cerrado)", () => {
    expect(
      shouldShowGroupItems({ collapsed: false, openGroup: null, groupId: "comercial" }),
    ).toBe(false);
  });
});
