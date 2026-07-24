import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SaleDetailsModal } from "./SaleDetailsModal";
import { Sale } from "@/types";

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: { user: { email: "vendedor@ayrsteel.com" }, role: "ADMIN" as string },
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("@/context/ConfirmContext", () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

vi.mock("@/services/salesService", () => ({
  annulSale: vi.fn(),
}));

vi.mock("@/modules/metallic-roofing/services/productionService", () => ({
  getQuoteFulfillmentLogs: vi.fn().mockResolvedValue([]),
}));

function buildQuote(productionStatus: string | undefined): Sale {
  return {
    id: "C-000030",
    status: "QUOTATION",
    customerName: "MADICOP S.A.C.",
    documentNumber: "20601234567",
    totalAmount: 1200,
    sellerId: "vendedor@ayrsteel.com",
    businessLines: ["metallic-roofing"],
    timestamp: new Date(),
    ...(productionStatus !== undefined ? { productionStatus } : {}),
    items: [
      {
        sku: "COB030ROJO",
        businessLine: "metallic-roofing",
        quantity: 100,
        unitPrice: 12,
        unitValue: 10.169,
        baseCost: 8,
        unitWeight: 5,
      },
    ],
  } as unknown as Sale;
}

async function waitForFulfillmentLoaded() {
  await waitFor(() =>
    expect(screen.queryByText(/cargando producci[oó]n/i)).not.toBeTruthy(),
  );
}

describe("SaleDetailsModal - botón Mandar a producción (RED PHASE)", () => {
  beforeEach(() => {
    mockAuth.role = "ADMIN";
  });

  it("RED 1+2: PENDING+ADMIN muestra 'Mandar a producción' (no 'PRODUCIR'); la MISMA cotización en CONFIRMED es lo inverso", async () => {
    // NOTA: el caso CONFIRMED-solo NO ancla por sí mismo (con el código viejo, sin gate,
    // ADMIN+CONFIRMED ya "coincide" con el resultado esperado: PRODUCIR se muestra siempre
    // hoy). Por eso va ENCADENADO con el caso PENDING en el mismo test (mismo doc, mismo
    // render tree, remount vía `key`) — la mitad PENDING es la que falla en rojo y es la
    // que endurece este test real.
    const { rerender } = render(
      <SaleDetailsModal key="pending" sale={buildQuote("PENDING")} onClose={vi.fn()} />,
    );
    await waitForFulfillmentLoaded();

    // FAILS IN RED! El botón "Mandar a producción" todavía no existe en el componente.
    expect(screen.getByText(/mandar a producci[oó]n/i)).toBeTruthy();
    // FAILS IN RED! Hoy "PRODUCIR" se muestra sin mirar productionStatus.
    expect(screen.queryByText("PRODUCIR")).not.toBeTruthy();

    rerender(<SaleDetailsModal key="confirmed" sale={buildQuote("CONFIRMED")} onClose={vi.fn()} />);
    await waitForFulfillmentLoaded();

    expect(screen.getByText("PRODUCIR")).toBeTruthy();
    expect(screen.queryByText(/mandar a producci[oó]n/i)).not.toBeTruthy();
  });

  it("RED 3: Cotización LEGACY sin campo productionStatus (como las 23 de prod) -> se trata como PENDING", async () => {
    render(<SaleDetailsModal sale={buildQuote(undefined)} onClose={vi.fn()} />);
    await waitForFulfillmentLoaded();

    // FAILS IN RED! Hoy (sin gate) una legacy sin productionStatus muestra PRODUCIR directo.
    expect(screen.getByText(/mandar a producci[oó]n/i)).toBeTruthy();
    expect(screen.queryByText("PRODUCIR")).not.toBeTruthy();
  });

  it("RED 4: PENDING + metallic + OPERATOR -> NO muestra NINGUNO de los dos botones", async () => {
    mockAuth.role = "OPERATOR";
    render(<SaleDetailsModal sale={buildQuote("PENDING")} onClose={vi.fn()} />);
    await waitForFulfillmentLoaded();

    // FAILS IN RED! Hoy canProduce incluye OPERATOR y muestra PRODUCIR sin mirar productionStatus.
    expect(screen.queryByText("PRODUCIR")).not.toBeTruthy();
    // "Mandar a producción" es ADMIN+SUPERVISOR únicamente (por ahora) -> OPERATOR tampoco lo ve.
    expect(screen.queryByText(/mandar a producci[oó]n/i)).not.toBeTruthy();
  });
});

describe("SaleDetailsModal - rendering Documento y Flags (RED PHASE)", () => {
  beforeEach(() => {
    mockAuth.role = "ADMIN";
  });

  it("RED 4: Venta nueva del POS (customerDocument presente, documentNumber vacío) -> RUC/DNI muestra customerDocument", async () => {
    const sale = buildQuote("PENDING");
    sale.customerDocument = "72248284";
    sale.documentNumber = ""; // Vacio
    
    render(<SaleDetailsModal sale={sale} onClose={vi.fn()} />);
    
    // Debería mostrar el RUC/DNI extraído de customerDocument
    expect(screen.getByText("72248284")).toBeTruthy();
  });

  it("RED 5: Venta legacy (documentNumber presente, SIN customerDocument) -> RUC/DNI muestra fallback legacy", async () => {
    const sale = buildQuote("PENDING");
    sale.customerDocument = undefined;
    sale.documentNumber = "20608931156";
    
    render(<SaleDetailsModal sale={sale} onClose={vi.fn()} />);
    
    // Debería seguir mostrando el fallback
    expect(screen.getByText("20608931156")).toBeTruthy();
  });

  it("RED 6: Venta importada (customerDocument = RUC, documentNumber = BBV1-324) -> Muestra comprobante aparte", async () => {
    const sale = buildQuote("PENDING");
    sale.customerDocument = "76334430";
    sale.documentNumber = "BBV1-324";
    
    render(<SaleDetailsModal sale={sale} onClose={vi.fn()} />);
    
    // El RUC debe ser 76334430, y "BBV1-324" debe mostrarse rotulado como Comprobante, no como RUC/DNI.
    // Asumiremos que el label será "Comprobante" o similar
    const rucElement = screen.getByText("76334430");
    expect(rucElement).toBeTruthy();
    
    const comprobanteElement = screen.getByText("BBV1-324");
    expect(comprobanteElement).toBeTruthy();
    
    // Verificamos que el comprobante se muestre con su respectivo rótulo
    expect(screen.getByText(/Comprobante/i)).toBeTruthy();
  });

  it("RED 7: allFlags con 'sin costo' -> se renderiza visible en el modal (chips)", async () => {
    const sale = buildQuote("PENDING");
    sale.allFlags = ["sin costo"];
    
    render(<SaleDetailsModal sale={sale} onClose={vi.fn()} />);
    
    // Debería existir un badge/chip con el texto
    expect(screen.getByText(/sin costo/i)).toBeTruthy();
  });
});
