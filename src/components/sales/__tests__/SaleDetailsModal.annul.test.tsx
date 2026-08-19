import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SaleDetailsModal } from "../SaleDetailsModal";
import { Sale } from "@/types";

const { mockAuth, mockAnnulSale, mockToast, mockPush } = vi.hoisted(() => ({
  mockAuth: { user: { email: "vendedor@ayrsteel.com" }, role: "ADMIN" as string },
  mockAnnulSale: vi.fn(),
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  mockPush: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("@/context/ConfirmContext", () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

vi.mock("@/services/salesService", () => ({
  annulSale: mockAnnulSale,
}));

vi.mock("@/modules/metallic-roofing/services/productionService", () => ({
  getQuoteFulfillmentLogs: vi.fn().mockResolvedValue([]),
}));

vi.mock("react-hot-toast", () => ({
  default: mockToast,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

function buildCompletedSale(): Sale {
  return {
    id: "V-000099",
    status: "COMPLETED",
    customerName: "CLIENTE TEST",
    documentNumber: "F001-99",
    totalAmount: 500,
    sellerId: "vendedor@ayrsteel.com",
    businessLines: ["drywall"],
    timestamp: new Date(),
    items: [
      {
        sku: "GENERIC",
        businessLine: "",
        quantity: 1,
        unitPrice: 500,
        unitValue: 423.7,
        baseCost: 200,
        unitWeight: 0,
      },
    ],
  } as unknown as Sale;
}

describe("SaleDetailsModal - handleAnnul (FASE F)", () => {
  beforeEach(() => {
    mockAuth.role = "ADMIN";
    mockAnnulSale.mockReset();
    mockToast.success.mockReset();
    mockToast.error.mockReset();
    mockToast.dismiss.mockReset();
    mockPush.mockReset();
  });

  it("happy path: annulSale resuelve -> toast.success + onSuccess + onClose llamados, sin modal de bloqueo", async () => {
    mockAnnulSale.mockResolvedValue({ success: true });
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(<SaleDetailsModal sale={buildCompletedSale()} onClose={onClose} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole("button", { name: /anular esta venta/i }));

    await waitFor(() => expect(mockAnnulSale).toHaveBeenCalledWith({ saleId: "V-000099" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalled();
    expect(screen.queryByText(/no se puede anular la venta/i)).not.toBeInTheDocument();
  });

  it("block error: annulSale rechaza con failed-precondition + details.quotationId -> abre el modal de bloqueo, dismiss el toast de loading, resetea isAnnuling", async () => {
    mockAnnulSale.mockRejectedValue({
      code: "functions/failed-precondition",
      message: "No se puede anular la venta: la cotización vinculada COT-BLOCK-1 tiene producción activa.",
      details: { quotationId: "COT-BLOCK-1", activeLogIds: ["LOG-A"] },
    });
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(<SaleDetailsModal sale={buildCompletedSale()} onClose={onClose} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole("button", { name: /anular esta venta/i }));

    await waitFor(() => expect(mockAnnulSale).toHaveBeenCalled());

    // Modal de bloqueo visible con el quotationId correcto.
    await waitFor(() => expect(screen.getByText(/COT-BLOCK-1/)).toBeInTheDocument());
    expect(mockToast.dismiss).toHaveBeenCalledWith("annul");
    expect(mockToast.error).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    // isAnnuling reseteado -> botón vuelve a su label normal, no queda en "PROCESANDO...".
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /anular esta venta/i })).toBeInTheDocument(),
    );
  });

  it("otro error (no bloqueo): annulSale rechaza con not-found -> toast.error, sin modal de bloqueo", async () => {
    mockAnnulSale.mockRejectedValue({
      code: "functions/not-found",
      message: "La venta no existe.",
    });

    render(<SaleDetailsModal sale={buildCompletedSale()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /anular esta venta/i }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("La venta no existe.", { id: "annul" }));
    expect(screen.queryByText(/no se puede anular la venta/i)).not.toBeInTheDocument();
  });
});
