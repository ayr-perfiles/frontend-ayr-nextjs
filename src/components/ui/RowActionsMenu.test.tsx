import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { RowActionsMenu, type RowAction } from "./RowActionsMenu";

/**
 * TANDA 20 — CUSTODIO DE COMPORTAMIENTO, escrito contra la implementación
 * ACTUAL y en verde ANTES del re-skin.
 *
 * Motivo (veredicto de la Tanda 19): el re-skin NO es anclable por test
 * unitario en lo VISUAL — jsdom no computa CSS — pero el COMPORTAMIENTO sí,
 * y no existía ninguno. El bug del chevron de la Tanda 19 apareció en una
 * pieza de 1 consumidor; ésta tiene 18.
 *
 * Estos tests son la RED del re-skin: si alguno se pone rojo al cambiar las
 * tripas, es una regresión — no se ajusta el test para que pase.
 *
 * NO se mockea `lucide-react`: funciona en jsdom, y mockearlo obliga a
 * enumerar cada icono usado (patrón frágil que ya vive en
 * `TablePagination.test.tsx`).
 */
describe("RowActionsMenu — comportamiento", () => {
  const baseItems = (): RowAction[] => [
    { id: "ver", label: "Ver detalles", onClick: vi.fn() },
    { id: "anular", label: "Anular", onClick: vi.fn(), variant: "danger" },
  ];

  /**
   * ⚠️ Se abre con `pointerDown`, NO con `click`, y el motivo está MEDIDO, no
   * supuesto: Radix (que es lo que hay adentro desde la Tanda 20) abre el menú
   * en `onPointerDown`, y `fireEvent.click` de jsdom no emite ese evento — con
   * `click` los 8 tests quedaban en rojo aunque el menú abriera perfecto en el
   * navegador real (verificado por captura: el panel se despliega y el trigger
   * se resalta).
   *
   * **Lo que cambió es CÓMO se maneja el componente, no QUÉ se le exige:** las
   * aserciones de abajo son las mismas que corrieron en verde contra la
   * implementación anterior. Que siguen discriminando está probado por
   * mutación, no por confianza (ver el registro de la Tanda 20).
   */
  const openMenu = () => {
    // El trigger por defecto no tiene texto: es el único button al montar.
    fireEvent.pointerDown(screen.getAllByRole("button")[0], {
      button: 0,
      ctrlKey: false,
      pointerType: "mouse",
    });
  };

  it("arranca CERRADO: no muestra los items", () => {
    render(<RowActionsMenu items={baseItems()} />);
    expect(screen.queryByText("Ver detalles")).toBeNull();
    expect(screen.queryByText("Anular")).toBeNull();
  });

  it("abre al click en el trigger y muestra los items", () => {
    render(<RowActionsMenu items={baseItems()} />);
    openMenu();
    expect(screen.getByText("Ver detalles")).toBeDefined();
    expect(screen.getByText("Anular")).toBeDefined();
  });

  it("dispara el onClick del item y CIERRA el menu", () => {
    const items = baseItems();
    render(<RowActionsMenu items={items} />);
    openMenu();

    fireEvent.click(screen.getByText("Ver detalles"));

    expect(items[0].onClick).toHaveBeenCalledTimes(1);
    // y el menu se cerro
    expect(screen.queryByText("Ver detalles")).toBeNull();
  });

  it("un item DESHABILITADO no dispara su onClick", () => {
    const onClick = vi.fn();
    render(
      <RowActionsMenu items={[{ id: "x", label: "Bloqueada", onClick, disabled: true }]} />,
    );
    openMenu();

    fireEvent.click(screen.getByText("Bloqueada"));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("un item en LOADING no dispara su onClick", () => {
    const onClick = vi.fn();
    render(
      <RowActionsMenu items={[{ id: "x", label: "Procesando", onClick, loading: true }]} />,
    );
    openMenu();

    fireEvent.click(screen.getByText("Procesando"));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("un item HIDDEN no se renderiza", () => {
    render(
      <RowActionsMenu
        items={[
          { id: "a", label: "Visible", onClick: vi.fn() },
          { id: "b", label: "Oculta", onClick: vi.fn(), hidden: true },
        ]}
      />,
    );
    openMenu();

    expect(screen.getByText("Visible")).toBeDefined();
    expect(screen.queryByText("Oculta")).toBeNull();
  });

  it("renderiza items de SECCIONES distintas", () => {
    render(
      <RowActionsMenu
        items={[
          { id: "a", label: "Editar", onClick: vi.fn(), section: "gestion" },
          { id: "b", label: "Borrar", onClick: vi.fn(), section: "peligro" },
        ]}
      />,
    );
    openMenu();

    expect(screen.getByText("Editar")).toBeDefined();
    expect(screen.getByText("Borrar")).toBeDefined();
  });

  it("acepta un trigger custom", () => {
    render(<RowActionsMenu items={baseItems()} trigger={<span>Acciones</span>} />);
    expect(screen.getByText("Acciones")).toBeDefined();
  });
});
