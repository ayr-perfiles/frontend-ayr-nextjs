import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { TableFilters, type FilterGroup } from "./TableFilters";

/**
 * TANDA 21 — CUSTODIO DE COMPORTAMIENTO de `TableFilters`, escrito contra la
 * implementación ACTUAL y en verde ANTES del re-skin. Es la RED del re-skin.
 *
 * `lucide-react` NO se mockea (mismo criterio que `RowActionsMenu.test.tsx`).
 *
 * Lo que se ancla sale de la firma real (`TableFiltersProps` + `FilterGroup`):
 * las 3 secciones opcionales (search / filterGroups / dateRange), el conteo de
 * filtros activos que gobierna el badge, el modo `multiple`, y las dos ramas de
 * "Limpiar Todo" (con y sin `onClearAll`).
 */
describe("TableFilters — comportamiento", () => {
  const group = (over: Partial<FilterGroup> = {}): FilterGroup => ({
    id: "status",
    label: "Estado",
    options: [
      { value: "ALL", label: "Todos" },
      { value: "ACTIVE", label: "Activos" },
      { value: "INACTIVE", label: "Inactivos" },
    ],
    value: "ALL",
    onChange: vi.fn(),
    ...over,
  });

  const openPanel = () => fireEvent.click(screen.getByRole("button", { name: /Filtros/i }));

  it("sin search, sin filterGroups y sin dateRange no renderiza ningún control", () => {
    render(<TableFilters />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("el input de búsqueda propaga lo tipeado", () => {
    const onChange = vi.fn();
    render(<TableFilters search={{ value: "", onChange }} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "abc" } });
    expect(onChange).toHaveBeenCalledWith("abc");
  });

  it("el botón de limpiar del input solo aparece con valor, y usa onClear cuando existe", () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    const { rerender } = render(<TableFilters search={{ value: "", onChange, onClear }} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);

    rerender(<TableFilters search={{ value: "x", onChange, onClear }} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClear).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("sin onClear, el botón de limpiar cae a onChange('')", () => {
    const onChange = vi.fn();
    render(<TableFilters search={{ value: "x", onChange }} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("el panel arranca CERRADO y abre al click en Filtros", () => {
    render(<TableFilters filterGroups={[group()]} />);
    expect(screen.queryByText("Activos")).toBeNull();
    openPanel();
    expect(screen.getByText("Activos")).toBeDefined();
    expect(screen.getByText("Filtros Avanzados")).toBeDefined();
  });

  it("elegir una opción single dispara onChange con SU valor", () => {
    const onChange = vi.fn();
    render(<TableFilters filterGroups={[group({ onChange })]} />);
    openPanel();
    fireEvent.click(screen.getByText("Activos"));
    expect(onChange).toHaveBeenCalledWith("ACTIVE");
  });

  it("modo multiple: agrega el valor no seleccionado y quita el seleccionado", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TableFilters filterGroups={[group({ multiple: true, value: [], onChange })]} />,
    );
    openPanel();
    fireEvent.click(screen.getByText("Activos"));
    expect(onChange).toHaveBeenCalledWith(["ACTIVE"]);

    onChange.mockClear();
    rerender(
      <TableFilters filterGroups={[group({ multiple: true, value: ["ACTIVE"], onChange })]} />,
    );
    fireEvent.click(screen.getByText("Activos"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("el badge de filtros activos cuenta solo lo que NO es el valor por defecto", () => {
    const { rerender } = render(<TableFilters filterGroups={[group({ value: "ALL" })]} />);
    expect(screen.queryByText("1")).toBeNull();

    rerender(<TableFilters filterGroups={[group({ value: "ACTIVE" })]} />);
    expect(screen.getByText("1")).toBeDefined();
  });

  it("additionalActiveCount suma al badge", () => {
    render(<TableFilters filterGroups={[group()]} additionalActiveCount={2} />);
    expect(screen.getByText("2")).toBeDefined();
  });

  it("una fecha cargada cuenta como filtro activo y propaga los dos extremos", () => {
    const setStartDate = vi.fn();
    const setEndDate = vi.fn();
    render(
      <TableFilters
        dateRange={{ startDate: "2026-01-01", endDate: "", setStartDate, setEndDate }}
      />,
    );
    expect(screen.getByText("1")).toBeDefined();
    openPanel();

    const inputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(inputs[0], { target: { value: "2026-02-02" } });
    expect(setStartDate).toHaveBeenCalledWith("2026-02-02");
    fireEvent.change(inputs[1], { target: { value: "2026-03-03" } });
    expect(setEndDate).toHaveBeenCalledWith("2026-03-03");
  });

  it("Limpiar Todo delega en onClearAll cuando lo hay, sin tocar nada más", () => {
    const onClearAll = vi.fn();
    const onChange = vi.fn();
    render(
      <TableFilters filterGroups={[group({ value: "ACTIVE", onChange })]} onClearAll={onClearAll} />,
    );
    openPanel();
    fireEvent.click(screen.getByText(/Limpiar Todo/i));
    expect(onClearAll).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("sin onClearAll, Limpiar Todo resetea search, grupos y fechas", () => {
    const searchOnChange = vi.fn();
    const single = vi.fn();
    const multi = vi.fn();
    const setStartDate = vi.fn();
    const setEndDate = vi.fn();
    render(
      <TableFilters
        search={{ value: "x", onChange: searchOnChange }}
        filterGroups={[
          group({ id: "a", value: "ACTIVE", onChange: single }),
          group({ id: "b", multiple: true, value: ["ACTIVE"], onChange: multi }),
        ]}
        dateRange={{ startDate: "2026-01-01", endDate: "2026-02-02", setStartDate, setEndDate }}
      />,
    );
    openPanel();
    fireEvent.click(screen.getByText(/Limpiar Todo/i));
    expect(searchOnChange).toHaveBeenCalledWith("");
    expect(single).toHaveBeenCalledWith("ALL"); // primera opción del grupo
    expect(multi).toHaveBeenCalledWith([]); // array vacío, no la primera opción
    expect(setStartDate).toHaveBeenCalledWith("");
    expect(setEndDate).toHaveBeenCalledWith("");
  });

  it("Limpiar Todo NO se ofrece cuando no hay ningún filtro activo", () => {
    render(<TableFilters filterGroups={[group()]} />);
    openPanel();
    expect(screen.queryByText(/Limpiar Todo/i)).toBeNull();
  });

  it("rightSlot vive en la barra y extraContent SOLO dentro del panel", () => {
    render(
      <TableFilters
        filterGroups={[group()]}
        rightSlot={<span>SLOT</span>}
        extraContent={<span>EXTRA</span>}
      />,
    );
    expect(screen.getByText("SLOT")).toBeDefined();
    expect(screen.queryByText("EXTRA")).toBeNull();
    openPanel();
    expect(screen.getByText("EXTRA")).toBeDefined();
  });

  /**
   * ⚠️ El Escape se emite en `document`, NO en `window`, y el motivo está
   * MEDIDO con una sonda descartable, no supuesto: desde la Tanda 21 el panel
   * es un `Sheet` del kit (Radix Dialog), que instala su listener en
   * `ownerDocument`. Un `fireEvent.keyDown(window, …)` NO baja a `document`
   * (window es el ancestro de la cadena, no el descendiente), así que el
   * listener nunca lo ve. Medido: `window` → NO cierra; `document` → cierra;
   * `document.body` → cierra.
   *
   * `document` es además MÁS fiel a la realidad que `window`: un Escape de
   * usuario nace en el elemento con foco y burbujea por `document` antes de
   * llegar a `window`. **La aserción no cambió** — cambió dónde se emite el
   * evento sintético. Mismo caso que el `pointerDown` de `RowActionsMenu` en
   * la Tanda 20, y que sigue discriminando está probado por mutación.
   */
  it("Escape cierra el panel", () => {
    render(<TableFilters filterGroups={[group()]} />);
    openPanel();
    expect(screen.getByText("Filtros Avanzados")).toBeDefined();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Filtros Avanzados")).toBeNull();
  });
});
