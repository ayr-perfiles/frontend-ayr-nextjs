import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CartSummary } from "../CartSummary";
import type { CartItem } from "@/services/salesService";

/**
 * `CartSummary` no tenía tests (deuda: 1 solo consumidor y cero red). E3 lo extiende con
 * `actions?`, así que se cierra la deuda de paso: se cubren AMBOS modos — el por defecto
 * (2 botones, comportamiento histórico) y el nuevo (acciones a medida).
 */

const item = (o: Partial<CartItem> & { sku: string }): CartItem =>
  ({
    productName: o.sku,
    quantity: 2,
    unitPrice: 118,
    unitValue: 100,
    baseCost: 60,
    businessLine: "metallic-roofing",
    isCoil: false,
    ...o,
  }) as CartItem;

const baseProps = {
  cart: [item({ sku: "COB030ROJO" })],
  totalWeight: 4,
  totalValue: 200,
  totalIGV: 36,
  totalAmount: 236,
  projectedProfit: 80,
  marginPercent: 40,
  minMarginAlert: 20,
  isSubmitting: false,
  onRemove: vi.fn(),
};

describe("CartSummary — modo por defecto (sin `actions`): comportamiento historico", () => {
  it("renderiza los 2 botones COTIZAR y VENDER", () => {
    render(<CartSummary {...baseProps} onQuote={vi.fn()} onSell={vi.fn()} />);
    expect(screen.getByText("COTIZAR")).toBeTruthy();
    expect(screen.getByText("VENDER")).toBeTruthy();
  });

  it("COTIZAR dispara onQuote y VENDER dispara onSell", () => {
    const onQuote = vi.fn();
    const onSell = vi.fn();
    render(<CartSummary {...baseProps} onQuote={onQuote} onSell={onSell} />);

    fireEvent.click(screen.getByText("COTIZAR"));
    expect(onQuote).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("VENDER"));
    expect(onSell).toHaveBeenCalledTimes(1);
  });

  it("con el carrito vacio los 2 botones quedan deshabilitados", () => {
    render(<CartSummary {...baseProps} cart={[]} onQuote={vi.fn()} onSell={vi.fn()} />);
    expect(screen.getByText("COTIZAR").closest("button")?.disabled).toBe(true);
    expect(screen.getByText("VENDER").closest("button")?.disabled).toBe(true);
  });

  it("con isSubmitting los 2 botones quedan deshabilitados", () => {
    render(<CartSummary {...baseProps} isSubmitting onQuote={vi.fn()} onSell={vi.fn()} />);
    expect(screen.getByText("COTIZAR").closest("button")?.disabled).toBe(true);
    expect(screen.getByText("VENDER").closest("button")?.disabled).toBe(true);
  });

  it("muestra el nombre del item del carrito", () => {
    render(<CartSummary {...baseProps} onQuote={vi.fn()} onSell={vi.fn()} />);
    expect(screen.getByText(/COB030ROJO/)).toBeTruthy();
  });
});

describe("CartSummary — modo `actions` (E3)", () => {
  it("con `actions` NO renderiza COTIZAR/VENDER", () => {
    render(
      <CartSummary {...baseProps} actions={<button>GUARDAR CAMBIOS</button>} />,
    );
    expect(screen.queryByText("COTIZAR")).toBeNull();
    expect(screen.queryByText("VENDER")).toBeNull();
  });

  it("con `actions` renderiza lo que le pasan", () => {
    render(
      <CartSummary {...baseProps} actions={<button>GUARDAR CAMBIOS</button>} />,
    );
    expect(screen.getByText("GUARDAR CAMBIOS")).toBeTruthy();
  });

  it("`actions` gana aunque tambien vengan onQuote/onSell", () => {
    const onQuote = vi.fn();
    render(
      <CartSummary
        {...baseProps}
        onQuote={onQuote}
        onSell={vi.fn()}
        actions={<button>GUARDAR CAMBIOS</button>}
      />,
    );
    expect(screen.queryByText("COTIZAR")).toBeNull();
    expect(screen.getByText("GUARDAR CAMBIOS")).toBeTruthy();
    expect(onQuote).not.toHaveBeenCalled();
  });

  it("el resumen de totales se sigue mostrando en modo `actions`", () => {
    render(<CartSummary {...baseProps} actions={<button>X</button>} />);
    // El total con IGV es el numero que el usuario mira para confirmar.
    // Aparece en mas de un lugar del resumen; alcanza con que se siga renderizando.
    expect(screen.getAllByText(/236\.00/).length).toBeGreaterThan(0);
  });
});
