import { render, screen, waitFor, fireEvent, renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ProductionQueuePage from "./page";
import * as useSalesModule from "@/core/hooks/useSales";
import * as productionServiceModule from "@/modules/metallic-roofing/services/productionService";
import { useTableData } from "@/hooks/useTableData";

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
  const mockGetLogs = vi.spyOn(productionServiceModule, "getQuoteFulfillmentLogs");

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

    // El primero tendrá 0 prod (PENDIENTE)
    mockGetLogs.mockResolvedValueOnce([]);
    // El segundo tendrá todo prod (CUMPLIDA)
    mockGetLogs.mockResolvedValueOnce([{ sku: "SKU2", piecesProduced: 20 }]);

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

    mockGetLogs.mockImplementation(async (quoteId: string) => {
      if (quoteId === "COT-FFA1-201") return []; // PENDIENTE
      if (quoteId === "COT-FFA1-202") return [{ sku: "SKU2", piecesProduced: 20 }]; // CUMPLIDA
      if (quoteId === "COT-FFA1-203") return [{ sku: "SKU3", piecesProduced: 12 }]; // SOBRE_PRODUCIDA
      return [];
    });

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

describe("Banner de techo (fetch cap de useSales, literal 100 en page.tsx:219)", () => {
  const mockUseSales = vi.spyOn(useSalesModule, "useSales");
  const mockGetLogs = vi.spyOn(productionServiceModule, "getQuoteFulfillmentLogs");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("con 100 cotizaciones construidas (== fetch cap de useSales), el banner 'Mostrando las primeras 100' aparece", async () => {
    const quotes = Array.from({ length: 100 }, (_, i) => ({
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

    expect(screen.getByText(/Mostrando las primeras 100/i)).toBeInTheDocument();
  });

  it("con 99 cotizaciones construidas (< fetch cap de useSales), el banner NO aparece", async () => {
    const quotes = Array.from({ length: 99 }, (_, i) => ({
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
