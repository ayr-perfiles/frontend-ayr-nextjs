import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SalesMetrics } from "./SalesMetrics";

describe("SalesMetrics Component (Wiring Test)", () => {
  it("renderiza rótulos dinámicos cuando metricLabel es 'Cotizado'", () => {
    render(
      <SalesMetrics
        totalRevenue={5000}
        totalProfit={1000}
        totalWeight={250}
        count={5}
        metricLabel="Cotizado"
      />
    );

    // Debe mostrar textos adaptados a Cotización
    expect(screen.getByText(/Total Cotizado/i)).toBeDefined();
    expect(screen.getByText(/Cotizaciones/i)).toBeDefined();
    expect(screen.getByText(/Utilidad estimada/i)).toBeDefined();
    expect(screen.getByText(/Volumen Cotizado/i)).toBeDefined();
  });

  it("renderiza rótulos estándar cuando metricLabel es 'Vendido' o undefined", () => {
    render(
      <SalesMetrics
        totalRevenue={10000}
        totalProfit={2500}
        totalWeight={500}
        count={10}
        metricLabel="Vendido"
      />
    );

    expect(screen.getByText(/Total Vendido/i)).toBeDefined();
    expect(screen.getByText(/Ventas/i)).toBeDefined();
    expect(screen.getByText(/Utilidad Real/i)).toBeDefined();
    expect(screen.getByText(/Volumen Despachado/i)).toBeDefined();
  });
});
