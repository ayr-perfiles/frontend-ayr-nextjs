import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { DataTable, type ColumnDef } from "./DataTable";

/**
 * TANDA 21 — CUSTODIO DE COMPORTAMIENTO de `DataTable`, escrito contra la
 * implementación ACTUAL y en verde ANTES del re-skin. Es la RED del re-skin.
 *
 * `lucide-react` NO se mockea — `EmptyState` importa 15 íconos y enumerarlos a
 * mano sería justamente el patrón frágil que la Tanda 20 decidió no propagar.
 *
 * Lo que se ancla sale de la firma real (`DataTableProps<T>` + `ColumnDef<T>`):
 * las TRES ramas de render (skeleton / emptyState / filas), la numeración
 * derivada de `currentPage`+`pageSize`, `getRowKey`, `onRowClick`,
 * `getRowClassName` y el banner "Actualizando..." del refetch con datos vivos.
 */
type Row = { id: string; name: string };

describe("DataTable — comportamiento", () => {
  const rows: Row[] = [
    { id: "a", name: "Alfa" },
    { id: "b", name: "Beta" },
  ];

  const columns: ColumnDef<Row>[] = [
    { key: "name", header: "Nombre", render: (r) => <span>{r.name}</span> },
  ];

  const base = () => ({
    columns,
    data: rows,
    getRowKey: (r: Row) => r.id,
    currentPage: 1,
    pageSize: 10,
    emptyState: { icon: "Package", title: "Sin datos", description: "No hay nada." },
  });

  it("renderiza los headers de las columnas", () => {
    render(<DataTable {...base()} />);
    expect(screen.getByText("Nombre")).toBeDefined();
  });

  it("renderiza una fila por dato, usando el render de la columna", () => {
    render(<DataTable {...base()} />);
    expect(screen.getByText("Alfa")).toBeDefined();
    expect(screen.getByText("Beta")).toBeDefined();
    expect(screen.getAllByRole("row")).toHaveLength(3); // 1 header + 2 filas
  });

  it("getRowKey se invoca una vez por fila", () => {
    const getRowKey = vi.fn((r: Row) => r.id);
    render(<DataTable {...base()} getRowKey={getRowKey} />);
    expect(getRowKey).toHaveBeenCalledTimes(2);
  });

  it("onRowClick recibe la FILA clickeada, no el índice", () => {
    const onRowClick = vi.fn();
    render(<DataTable {...base()} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText("Beta"));
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });

  it("sin onRowClick, clickear una fila no rompe ni dispara nada", () => {
    render(<DataTable {...base()} />);
    fireEvent.click(screen.getByText("Alfa"));
    expect(screen.getByText("Alfa")).toBeDefined();
  });

  it("con 0 filas y sin carga muestra el emptyState, no una tabla vacía", () => {
    render(<DataTable {...base()} data={[]} />);
    expect(screen.getByText("Sin datos")).toBeDefined();
    expect(screen.getByText("No hay nada.")).toBeDefined();
  });

  it("isLoading con 0 filas muestra el SKELETON y ningún dato", () => {
    render(<DataTable {...base()} data={[]} isLoading />);
    expect(screen.queryByText("Sin datos")).toBeNull();
    expect(screen.queryByText("Nombre")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("isLoading CON filas conserva los datos y agrega el aviso de refetch", () => {
    render(<DataTable {...base()} isLoading />);
    expect(screen.getByText("Alfa")).toBeDefined();
    expect(screen.getByText(/Actualizando/i)).toBeDefined();
  });

  it("la numeración de filas se deriva de currentPage y pageSize", () => {
    render(<DataTable {...base()} currentPage={3} pageSize={10} />);
    expect(screen.getByText("21")).toBeDefined();
    expect(screen.getByText("22")).toBeDefined();
  });

  it("showRowNumber=false quita la columna # y su celda", () => {
    render(<DataTable {...base()} showRowNumber={false} />);
    expect(screen.queryByText("#")).toBeNull();
    expect(screen.queryByText("1")).toBeNull();
  });

  it("el segundo argumento de render es el número de fila, no el índice", () => {
    const render2: ColumnDef<Row>[] = [
      { key: "n", header: "N", render: (_r, n) => <span>fila-{n}</span> },
    ];
    render(<DataTable {...base()} columns={render2} currentPage={2} pageSize={10} />);
    expect(screen.getByText("fila-11")).toBeDefined();
    expect(screen.getByText("fila-12")).toBeDefined();
  });

  it("getRowClassName se aplica a la fila que lo devuelve", () => {
    const getRowClassName = (r: Row) => (r.id === "b" ? "fila-marcada" : "");
    const { container } = render(<DataTable {...base()} getRowClassName={getRowClassName} />);
    const marcadas = container.querySelectorAll("tr.fila-marcada");
    expect(marcadas).toHaveLength(1);
    expect(marcadas[0].textContent).toContain("Beta");
  });
});
