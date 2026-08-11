import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MetallicProductionHistory } from "./MetallicProductionHistory";
import { useMetallicProductionLogs } from "@/modules/metallic-roofing/hooks/useMetallicProductionLogs";
import { useAuth } from "@/context/AuthContext";
import { ConfirmProvider } from "@/context/ConfirmContext";

vi.mock("@/modules/metallic-roofing/hooks/useMetallicProductionLogs");
vi.mock("@/context/AuthContext");

const renderComponent = (logs: any[], skuToFamily: Record<string, string> = {}) => {
  vi.mocked(useAuth).mockReturnValue({ role: "ADMIN" } as any);
  vi.mocked(useMetallicProductionLogs).mockReturnValue({
    logs,
    loading: false,
    refresh: vi.fn(),
  } as any);

  render(
    <ConfirmProvider>
      <MetallicProductionHistory skuToFamily={skuToFamily} />
    </ConfirmProvider>
  );
};

describe("MetallicProductionHistory", () => {
  const baseLog = {
    id: "log-1",
    timestamp: { toDate: () => new Date("2026-07-28") },
    perCoilBreakdown: [{ coilId: "C-1", costPEN: 100 }],
    status: "ACTIVE",
    costPerPiece: 5.5,
  };

  it("renders '{ml} ML' and does not show 'pzas' for COBERTURA", () => {
    renderComponent(
      [{ ...baseLog, sku: "COB1", piecesProduced: 20, mlProduced: 45.5 }],
      { COB1: "COBERTURA" }
    );
    expect(screen.getByText("+45.5 ML")).toBeInTheDocument();
    expect(screen.queryByText(/pzas/)).not.toBeInTheDocument();
  });

  it("renders '{n} piezas' for PLANCHA", () => {
    renderComponent(
      [{ ...baseLog, sku: "PLA1", piecesProduced: 30, mlProduced: 50 }],
      { PLA1: "PLANCHA" }
    );
    expect(screen.getByText("+30 piezas")).toBeInTheDocument();
    expect(screen.queryByText(/pzas/)).not.toBeInTheDocument();
  });

  it("shows canonical quote number without COT- in 'Cotización' column if source.type='QUOTE'", () => {
    renderComponent(
      [
        {
          ...baseLog,
          sku: "COB1",
          piecesProduced: 10,
          source: { type: "QUOTE", id: "COT-12345" },
        },
      ],
      { COB1: "COBERTURA" }
    );
    expect(screen.getByText("12345")).toBeInTheDocument();
  });

  it("shows '—' in 'Cotización' column if no source", () => {
    renderComponent([{ ...baseLog, sku: "COB1", piecesProduced: 10 }], { COB1: "COBERTURA" });
    const emptyCells = screen.getAllByText("—");
    expect(emptyCells.length).toBeGreaterThan(0);
  });

  it("has header 'Costo x Unidad' instead of 'Costo x Pieza'", () => {
    renderComponent([], {});
    expect(screen.getByText("Costo x Unidad")).toBeInTheDocument();
    expect(screen.queryByText("Costo x Pieza")).not.toBeInTheDocument();
  });

  it("Fila PLANCHA -> parentesis NO contiene 'ML'", () => {
    renderComponent(
      [{ ...baseLog, sku: "PLA1", piecesProduced: 30, mlProduced: 10, reportedWeight: 15 }],
      { PLA1: "PLANCHA" }
    );
    expect(screen.queryByText(/\(10 ML \/ 15 kg\)/)).not.toBeInTheDocument();
    expect(screen.getByText("(15 kg)")).toBeInTheDocument();
  });

  it("Fila COBERTURA -> parentesis muestra '{kg} kg'", () => {
    renderComponent(
      [{ ...baseLog, sku: "COB1", piecesProduced: 30, mlProduced: 45.5, reportedWeight: 20 }],
      { COB1: "COBERTURA" }
    );
    expect(screen.getByText("(20 kg)")).toBeInTheDocument();
  });

  it("Cotizacion con source.type='QUOTE' -> elemento clickeable que llama onOpenQuote", () => {
    const onOpenQuoteMock = vi.fn();
    
    vi.mocked(useAuth).mockReturnValue({ role: "ADMIN" } as any);
    vi.mocked(useMetallicProductionLogs).mockReturnValue({
      logs: [{ ...baseLog, sku: "COB1", piecesProduced: 10, source: { type: "QUOTE", id: "COT-12345" } }],
      loading: false,
      refresh: vi.fn(),
    } as any);

    render(
      <ConfirmProvider>
        <MetallicProductionHistory skuToFamily={{ COB1: "COBERTURA" }} onOpenQuote={onOpenQuoteMock} />
      </ConfirmProvider>
    );

    const button = screen.getByRole("button", { name: /12345/i });
    expect(button).toBeInTheDocument();
    button.click();
    expect(onOpenQuoteMock).toHaveBeenCalledWith("COT-12345");
  });
});
