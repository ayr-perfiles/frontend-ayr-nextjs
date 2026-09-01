import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { TablePagination } from "./TablePagination";

/**
 * TANDA 21 — CUSTODIO DE COMPORTAMIENTO de `TablePagination`, escrito contra la
 * implementación ACTUAL y en verde ANTES del re-skin. Es la RED del re-skin: un
 * rojo posterior es una regresión, no una aserción a ajustar.
 *
 * Archivo SEPARADO de `TablePagination.test.tsx` a propósito, y el motivo está
 * medido: ese archivo mockea `lucide-react` enumerando SOLO `ChevronLeft` y
 * `ChevronRight`. Ese patrón es frágil por construcción — cualquier ícono nuevo
 * que entre por una primitiva del kit deja el mock incompleto y el test rojo por
 * el harness, no por el componente. Acá NO se mockea `lucide-react`: funciona en
 * jsdom. Mismo criterio que `RowActionsMenu.test.tsx` (Tanda 20).
 *
 * Lo que se ancla sale de la firma real (`TablePaginationProps`): los dos
 * valores de `mode`, los bordes de habilitación de cada flecha, y el selector de
 * tamaño con sus dos props obligatorias.
 */
describe("TablePagination — comportamiento", () => {
  const base = () => ({
    currentPage: 2,
    pageSize: 10,
    totalItems: 100,
    onPageChange: vi.fn(),
  });

  const prevBtn = () => screen.getAllByRole("button")[0];
  const nextBtn = () => screen.getAllByRole("button")[1];

  it("la flecha ANTERIOR pide la página previa", () => {
    const p = base();
    render(<TablePagination {...p} />);
    fireEvent.click(prevBtn());
    expect(p.onPageChange).toHaveBeenCalledWith(1);
  });

  it("la flecha SIGUIENTE pide la página posterior", () => {
    const p = base();
    render(<TablePagination {...p} />);
    fireEvent.click(nextBtn());
    expect(p.onPageChange).toHaveBeenCalledWith(3);
  });

  it("en la página 1 la flecha ANTERIOR está deshabilitada y NO dispara", () => {
    const p = { ...base(), currentPage: 1 };
    render(<TablePagination {...p} />);
    expect((prevBtn() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(prevBtn());
    expect(p.onPageChange).not.toHaveBeenCalled();
  });

  it("mode=pages: en la última página la flecha SIGUIENTE está deshabilitada y NO dispara", () => {
    const p = { ...base(), currentPage: 10 }; // 100 items / 10 = 10 páginas
    render(<TablePagination {...p} />);
    expect((nextBtn() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(nextBtn());
    expect(p.onPageChange).not.toHaveBeenCalled();
  });

  it("mode=pages: con una sola página NO se renderizan los controles", () => {
    render(<TablePagination {...base()} currentPage={1} totalItems={5} />);
    expect(screen.queryByText(/Página/i)).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("mode=pages: muestra el total de páginas", () => {
    render(<TablePagination {...base()} />);
    expect(screen.getByText(/DE 10/)).toBeDefined();
  });

  it("mode=cursor: muestra el rango MOSTRANDO x-y y NO el total de páginas", () => {
    render(<TablePagination {...base()} mode="cursor" />);
    expect(screen.getByText(/MOSTRANDO/i)).toBeDefined();
    expect(screen.getByText(/11-/)).toBeDefined();
    expect(screen.queryByText(/DE 10\b/)).toBeNull();
  });

  it("mode=cursor: los controles se renderizan aunque haya una sola página", () => {
    render(<TablePagination {...base()} currentPage={1} totalItems={5} mode="cursor" />);
    expect(screen.getByText(/Página/i)).toBeDefined();
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(2);
  });

  it("mode=cursor: SIGUIENTE se deshabilita cuando ya se mostró el último item", () => {
    const p = { ...base(), currentPage: 3, pageSize: 10, totalItems: 30 };
    render(<TablePagination {...p} mode="cursor" />);
    expect((nextBtn() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(nextBtn());
    expect(p.onPageChange).not.toHaveBeenCalled();
  });

  it("el selector de tamaño devuelve un NÚMERO, no el string del option", () => {
    const onPageSizeChange = vi.fn();
    render(
      <TablePagination
        {...base()}
        pageSizeOptions={[10, 25, 50]}
        onPageSizeChange={onPageSizeChange}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "25" } });
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });

  it("sin onPageSizeChange NO se renderiza el selector de tamaño", () => {
    render(<TablePagination {...base()} pageSizeOptions={[10, 25]} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("Mostrar:")).toBeNull();
  });

  it("totalLabel se usa tal cual lo pasa el consumidor", () => {
    render(<TablePagination {...base()} totalLabel="bobinas" />);
    expect(screen.getByText(/bobinas/)).toBeDefined();
  });
});
