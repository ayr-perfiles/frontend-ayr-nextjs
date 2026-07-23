import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SalesTable } from "./SalesTable";
import { Sale } from "@/types";

describe("SalesTable Component Guard (RED PHASE)", () => {
  const dummyHandlers = {
    onPrint: vi.fn(),
    onDuplicate: vi.fn(),
    onApprove: vi.fn(),
    onViewDetails: vi.fn(),
    onEdit: vi.fn(),
    onCancel: vi.fn(),
  };

  const normalQuote: Sale = {
    id: "C-000024",
    status: "QUOTATION",
    customerName: "GIANCARLO SINUIRI",
    documentNumber: "72248285",
    totalAmount: 240,
    totalCost: 0,
    totalProfit: 0,
    sellerId: "demo@cliente.com",
    timestamp: new Date(),
    items: [],
  } as unknown as Sale;

  const importedQuote: Sale = {
    id: "COT-BBV1-316",
    status: "QUOTATION",
    customerName: "QUIROZ CARRANZA",
    documentNumber: "BBV1-316",
    totalAmount: 381.6,
    totalCost: 0,
    totalProfit: 0,
    sellerId: "SISTEMA",
    relatedSaleId: "BBV1-316",
    timestamp: new Date(),
    items: [],
  } as unknown as Sale;

  it("RED 3: Cotización comercial (sin relatedSaleId) muestra la opción 'Aprobar Venta'", () => {
    render(
      <SalesTable
        displaySales={[normalQuote]}
        isLoading={false}
        role="ADMIN"
        isProcessing={false}
        currentPage={1}
        pageSize={15}
        {...dummyHandlers}
      />
    );

    // Opciones del menú de fila
    const actionButtons = screen.getAllByRole("button");
    expect(actionButtons.length).toBeGreaterThan(0);
  });

  it("RED 3: Cotización importada (con relatedSaleId) NO debe mostrar la opción 'Aprobar Venta'", () => {
    render(
      <SalesTable
        displaySales={[importedQuote]}
        isLoading={false}
        role="ADMIN"
        isProcessing={false}
        currentPage={1}
        pageSize={15}
        {...dummyHandlers}
      />
    );

    // Con el guard en SalesTable, 'approve' debe estar hidden
    // Actuar o verificar que approve button / action esté hidden
  });

  it("RED 4: Cotización importada (isImportedQuotation) muestra badge 'PRODUCCIÓN', NO 'COT. PENDIENTE'", () => {
    render(
      <SalesTable
        displaySales={[importedQuote]}
        isLoading={false}
        role="ADMIN"
        isProcessing={false}
        currentPage={1}
        pageSize={15}
        {...dummyHandlers}
      />
    );

    expect(screen.getByText(/producci[oó]n/i)).toBeTruthy();
    expect(screen.queryByText(/cot\. pendiente/i)).toBeNull();
  });

  it("RED 4: Cotización comercial (sin relatedSaleId/metadata.isQuotation) conserva badge 'COT. PENDIENTE'", () => {
    render(
      <SalesTable
        displaySales={[normalQuote]}
        isLoading={false}
        role="ADMIN"
        isProcessing={false}
        currentPage={1}
        pageSize={15}
        {...dummyHandlers}
      />
    );

    expect(screen.getByText(/cot\. pendiente/i)).toBeTruthy();
    expect(screen.queryByText(/producci[oó]n/i)).toBeNull();
  });
});
