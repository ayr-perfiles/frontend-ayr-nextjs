import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductionBlockedAnnulModal } from "../ProductionBlockedAnnulModal";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("ProductionBlockedAnnulModal", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("render con quotationId + activeLogIds -> muestra ambos en el body", () => {
    render(
      <ProductionBlockedAnnulModal
        open={true}
        onClose={vi.fn()}
        quotationId="COT-X-1"
        activeLogIds={["LOG-1", "LOG-2"]}
      />,
    );

    expect(screen.getByText(/COT-X-1/)).toBeInTheDocument();
    expect(screen.getByText(/2 proceso/i)).toBeInTheDocument();
  });

  it("open=false -> no renderiza nada", () => {
    const { container } = render(
      <ProductionBlockedAnnulModal open={false} onClose={vi.fn()} quotationId="COT-X-2" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("click 'Ir a anular producción' -> navega a la cola y cierra el modal", () => {
    const onClose = vi.fn();
    render(
      <ProductionBlockedAnnulModal open={true} onClose={onClose} quotationId="COT-X-3" />,
    );

    fireEvent.click(screen.getByText(/ir a anular producción/i));

    expect(mockPush).toHaveBeenCalledWith("/admin/lines/metallic-roofing/production/queue");
    expect(onClose).toHaveBeenCalled();
  });

  it("click 'Cerrar' -> llama onClose sin navegar", () => {
    const onClose = vi.fn();
    render(
      <ProductionBlockedAnnulModal open={true} onClose={onClose} quotationId="COT-X-4" />,
    );

    fireEvent.click(screen.getByText(/^cerrar$/i));

    expect(onClose).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
