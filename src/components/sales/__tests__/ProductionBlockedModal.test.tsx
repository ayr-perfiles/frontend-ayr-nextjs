import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductionBlockedModal } from "../ProductionBlockedModal";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("ProductionBlockedModal", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("render con quotationId + activeLogIds -> muestra ambos en el body", () => {
    render(
      <ProductionBlockedModal
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
      <ProductionBlockedModal open={false} onClose={vi.fn()} quotationId="COT-X-2" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("click 'Ir a anular producción' -> navega a la cola y cierra el modal", () => {
    const onClose = vi.fn();
    render(
      <ProductionBlockedModal open={true} onClose={onClose} quotationId="COT-X-3" />,
    );

    fireEvent.click(screen.getByText(/ir a anular producción/i));

    expect(mockPush).toHaveBeenCalledWith("/admin/lines/metallic-roofing/production/queue");
    expect(onClose).toHaveBeenCalled();
  });

  it("click 'Cerrar' -> llama onClose sin navegar", () => {
    const onClose = vi.fn();
    render(
      <ProductionBlockedModal open={true} onClose={onClose} quotationId="COT-X-4" />,
    );

    fireEvent.click(screen.getByText(/^cerrar$/i));

    expect(onClose).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// ── E3: copy opcional (el modal ahora lo usan anular Y editar) ────────────────
describe("ProductionBlockedModal — copy opcional (E3)", () => {
  it("sin props de copy usa los defaults de ANULAR (retrocompatible)", () => {
    render(<ProductionBlockedModal open onClose={vi.fn()} quotationId="COT-E3-1" />);
    expect(screen.getByText("No se puede anular la venta")).toBeTruthy();
    expect(screen.getByText(/Debés anular la producción primero/)).toBeTruthy();
    expect(screen.getByText("Ir a anular producción")).toBeTruthy();
  });

  it("con title/body/ctaLabel muestra la copy de EDITAR y NO la de anular", () => {
    render(
      <ProductionBlockedModal
        open
        onClose={vi.fn()}
        quotationId="C-000021"
        title="No se puede editar la cotización"
        body={<>Tiene producción activa. Anulá la producción para poder editarla.</>}
        ctaLabel="Ir a la cola de producción"
      />,
    );
    expect(screen.getByText("No se puede editar la cotización")).toBeTruthy();
    expect(screen.getByText(/para poder editarla/)).toBeTruthy();
    expect(screen.getByText("Ir a la cola de producción")).toBeTruthy();

    expect(screen.queryByText("No se puede anular la venta")).toBeNull();
    expect(screen.queryByText("Ir a anular producción")).toBeNull();
  });

  it("el contador de procesos activos se sigue mostrando con copy custom", () => {
    render(
      <ProductionBlockedModal
        open
        onClose={vi.fn()}
        quotationId="C-000021"
        activeLogIds={["L-1", "L-2"]}
        title="No se puede editar la cotización"
      />,
    );
    expect(screen.getByText(/2 procesos de producción activos/)).toBeTruthy();
  });
});
