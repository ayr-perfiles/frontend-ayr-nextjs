import { render, screen, waitFor, fireEvent, renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ProductionQueuePage from "./page";
import * as useSalesModule from "@/core/hooks/useSales";
import * as productionServiceModule from "@/modules/metallic-roofing/services/productionService";
import { useTableData } from "@/hooks/useTableData";
import type { ProductionLog } from "@/types";

vi.mock("@/components/ui/TableFilters", () => {
  return {
    TableFilters: ({ filterGroups }: any) => {
      const group = filterGroups[0];
      return (
        <button 
          data-testid="mock-filter-btn" 
          onClick={() => group.onChange(["hide_completed"])}
        >
          Mock Filter
        </button>
      );
    }
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("ProductionQueuePage", () => {
  const mockUseSales = vi.spyOn(useSalesModule, "useSales");
  const mockGetLogs = vi.spyOn(productionServiceModule, "getAllActiveFulfillmentLogs");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza EmptyState cuando no hay filas (0 filas)", async () => {
    mockUseSales.mockReturnValue({ sales: [], loading: false } as any);
    render(<ProductionQueuePage />);
    
    expect(screen.getByText("Cola de Producción (Aluzinc)")).toBeInTheDocument();
    expect(screen.getByText("No hay órdenes en cola")).toBeInTheDocument();
  });

  it("renderiza filas mixtas", async () => {
    const quotes = [
      { id: "COT-FFA1-101", documentNumber: "", customerName: "CLIENTE 1", items: [{ sku: "SKU1", quantity: 10, businessLine: "metallic-roofing" }] },
      { id: "COT-FFA1-102", documentNumber: "", customerName: "CLIENTE 2", items: [{ sku: "SKU2", quantity: 20, businessLine: "metallic-roofing" }] },
    ] as any;

    mockUseSales.mockReturnValue({ sales: quotes, loading: false } as any);

    // 1 sola query trae TODOS los logs activos; FFA1-101 sin logs (PENDIENTE), FFA1-102 parcial 10/20 (PARCIAL).
    // Ninguna CUMPLIDA a propósito: el default hideCompleted=true (desde 3f5adb2f) oculta filas CUMPLIDA,
    // y este test verifica que 2 filas con distinto avance conviven en la tabla, no el filtro de cumplidas.
    mockGetLogs.mockResolvedValueOnce([
      { sku: "SKU2", piecesProduced: 10, status: "ACTIVE", source: { type: "QUOTE" as const, id: "COT-FFA1-102" } } as unknown as ProductionLog,
    ]);

    render(<ProductionQueuePage />);

    await waitFor(() => {
      expect(screen.getByText("FFA1-101")).toBeInTheDocument();
      expect(screen.getByText("FFA1-102")).toBeInTheDocument();
    });
  });

  it("columna N Cotizacion: NUNCA muestra el documentNumber (ej. un RUC colado), siempre quoteId sin prefijo COT-", async () => {
    const quotes = [
      { id: "COT-FFA1-1264", documentNumber: "20100077044", customerName: "CLIENTE RUC COLADO", items: [{ sku: "SKU1", quantity: 10, businessLine: "metallic-roofing" }] },
    ] as any;

    mockUseSales.mockReturnValue({ sales: quotes, loading: false } as any);
    mockGetLogs.mockResolvedValueOnce([]);

    render(<ProductionQueuePage />);

    await waitFor(() => {
      expect(screen.getByText("FFA1-1264")).toBeInTheDocument();
    });
    expect(screen.queryByText("20100077044")).not.toBeInTheDocument();
    expect(screen.queryByText("COT-FFA1-1264")).not.toBeInTheDocument();
  });

  it("filtro Ocultar cumplidas oculta CUMPLIDA pero no SOBRE_PRODUCIDA", async () => {
    const quotes = [
      { id: "COT-FFA1-201", documentNumber: "", customerName: "CLIENTE 1", items: [{ sku: "SKU1", quantity: 10, businessLine: "metallic-roofing" }] },
      { id: "COT-FFA1-202", documentNumber: "", customerName: "CLIENTE 2", items: [{ sku: "SKU2", quantity: 20, businessLine: "metallic-roofing" }] },
      { id: "COT-FFA1-203", documentNumber: "", customerName: "CLIENTE 3", items: [{ sku: "SKU3", quantity: 10, businessLine: "metallic-roofing" }] },
    ] as any;

    mockUseSales.mockReturnValue({ sales: quotes, loading: false } as any);

    // 1 sola query trae todos los logs activos; COT-FFA1-201 no tiene logs (PENDIENTE).
    mockGetLogs.mockResolvedValue([
      { sku: "SKU2", piecesProduced: 20, status: "ACTIVE", source: { type: "QUOTE" as const, id: "COT-FFA1-202" } } as unknown as ProductionLog, // CUMPLIDA
      { sku: "SKU3", piecesProduced: 12, status: "ACTIVE", source: { type: "QUOTE" as const, id: "COT-FFA1-203" } } as unknown as ProductionLog, // SOBRE_PRODUCIDA
    ]);

    render(<ProductionQueuePage />);

    await waitFor(() => {
      expect(screen.getByText("FFA1-201")).toBeInTheDocument();
    });

    const mockBtn = screen.getByTestId("mock-filter-btn");
    fireEvent.click(mockBtn);

    await waitFor(() => {
      expect(screen.getByText("FFA1-201")).toBeInTheDocument();
      expect(screen.queryByText("FFA1-202")).not.toBeInTheDocument();
      expect(screen.getByText("FFA1-203")).toBeInTheDocument();
    }, { timeout: 2000 });
  });
});

describe("useTableData pipeline (pageSize de la cola de producción)", () => {
  const rows23 = Array.from({ length: 23 }, (_, i) => ({ quoteId: `COT-Q-${i}` }));

  it("pageSize 50 (fix aplicado): las 23 filas quedan accesibles en la página 1", () => {
    const { result } = renderHook(() => useTableData({ data: rows23, pageSize: 50 }));
    expect(result.current.totalFiltered).toBe(23);
    expect(result.current.pageItems).toHaveLength(23);
  });

  it("pageSize 15 (comportamiento viejo): la página 1 trunca a 15, 8 filas quedan mudas hasta pasar de página", () => {
    const { result } = renderHook(() => useTableData({ data: rows23, pageSize: 15 }));
    expect(result.current.totalFiltered).toBe(23);
    // Con pageSize 15 la página 1 NO expone las 23 -- esta es la falla que el fix (50) resuelve.
    expect(result.current.pageItems).toHaveLength(15);
    expect(result.current.pageItems).not.toHaveLength(23);
  });
});

describe("Banner de techo (fetch cap de useSales, QUEUE_FETCH_CAP en page.tsx)", () => {
  const mockUseSales = vi.spyOn(useSalesModule, "useSales");
  const mockGetLogs = vi.spyOn(productionServiceModule, "getAllActiveFulfillmentLogs");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("con 500 cotizaciones construidas (== fetch cap de useSales), el banner 'Mostrando las primeras 500' aparece", async () => {
    const quotes = Array.from({ length: 500 }, (_, i) => ({
      id: `COT-Q-${i}`,
      documentNumber: "",
      customerName: `CLIENTE ${i}`,
      items: [{ sku: "SKU1", quantity: 10, businessLine: "metallic-roofing" }],
    })) as any;

    mockUseSales.mockReturnValue({ sales: quotes, loading: false } as any);
    mockGetLogs.mockResolvedValue([]);

    render(<ProductionQueuePage />);

    await waitFor(() => {
      expect(screen.getByText("CLIENTE 0")).toBeInTheDocument();
    });

    expect(screen.getByText(/Mostrando las primeras 500/i)).toBeInTheDocument();
  });

  it("con 499 cotizaciones construidas (< fetch cap de useSales), el banner NO aparece", async () => {
    const quotes = Array.from({ length: 499 }, (_, i) => ({
      id: `COT-Q-${i}`,
      documentNumber: "",
      customerName: `CLIENTE ${i}`,
      items: [{ sku: "SKU1", quantity: 10, businessLine: "metallic-roofing" }],
    })) as any;

    mockUseSales.mockReturnValue({ sales: quotes, loading: false } as any);
    mockGetLogs.mockResolvedValue([]);

    render(<ProductionQueuePage />);

    await waitFor(() => {
      expect(screen.getByText("CLIENTE 0")).toBeInTheDocument();
    });

    expect(screen.queryByText(/Mostrando las primeras/i)).not.toBeInTheDocument();
  });
});
