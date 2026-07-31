import { describe, it, expect } from "vitest";
import { calculateTotalMermaSoles } from "./reportFunctions";

describe("calculateTotalMermaSoles", () => {
  it("suma scrapCostPEN ignorando VOIDED y manejando omitidos correctamente", () => {
    const input = [
      { data: () => ({ scrapCostPEN: 500 }) },                    // histórico sin status → cuenta
      { data: () => ({ scrapCostPEN: 300, status: "VOIDED" }) },  // anulado → NO cuenta
      { data: () => ({ scrapCostPEN: 200 }) },                    // sin status → cuenta
    ];
    expect(calculateTotalMermaSoles(input)).toBe(700);
  });

  it("retorna 0 si el array está vacío", () => {
    expect(calculateTotalMermaSoles([])).toBe(0);
  });

  it("maneja docs sin scrapCostPEN sin lanzar NaN", () => {
    const input = [
      { data: () => ({ status: "AVAILABLE" }) }, // sin scrapCostPEN
      { data: () => ({ scrapCostPEN: null as any }) },
      { data: () => ({}) },
    ];
    expect(calculateTotalMermaSoles(input)).toBe(0);
  });
});

import * as firestore from "firebase/firestore";
import * as stockBobinasLogic from "../stockBobinasLogic";
import * as mapper from "../stockBobinasReportMapper";

vi.mock("@/lib/firebase/clientApp", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  getDocs: vi.fn(),
  collection: vi.fn(),
}));
vi.mock("../stockBobinasLogic", () => ({ calculateStockBobinas: vi.fn() }));
vi.mock("../stockBobinasReportMapper", () => ({ mapStockBobinasToReportRows: vi.fn() }));

describe("runStockBobinas (wrapper)", () => {
  it("devuelve warnings poblado cuando hay negativeCoils y omite la fila anómala", async () => {
    // Import need to be required here due to hoisting of vi.mock
    const { runStockBobinas } = await import("./reportFunctions");
    
    (firestore.collection as any).mockImplementation((_db: any, name: string) => name);
    (firestore.getDocs as any).mockImplementation(async (colName: string) => {
      if (colName === "coils") return { docs: [] };
      if (colName === "coil_finishes") return { forEach: () => {} };
      return { docs: [] };
    });

    (stockBobinasLogic.calculateStockBobinas as any).mockReturnValue({
      rows: [{ tipo: "NORMAL", metrajeML: 100, numBobinas: 1, pesoKg: 1000 }],
      negativeCoils: [{ id: "COIL-123", currentWeight: -50 }]
    });

    (mapper.mapStockBobinasToReportRows as any).mockReturnValue([
      { tipo: "NORMAL", metrajeML: 100, numBobinas: 1, pesoKg: 1000 }
    ]);

    const result = await runStockBobinas();

    expect(result.warnings).toBeDefined();
    expect(result.warnings?.length).toBe(1);
    expect(result.warnings?.[0]).toContain("COIL-123");
    expect(result.warnings?.[0]).toContain("-50kg");

    expect(result.rows).toHaveLength(1);
    expect(result.rows.some((r: any) => r.tipo === "⚠️ ANOMALÍA")).toBe(false);
  });

  it("no devuelve warnings si no hay negativeCoils", async () => {
    const { runStockBobinas } = await import("./reportFunctions");
    
    (firestore.collection as any).mockImplementation((_db: any, name: string) => name);
    (firestore.getDocs as any).mockImplementation(async (colName: string) => {
      if (colName === "coils") return { docs: [] };
      if (colName === "coil_finishes") return { forEach: () => {} };
      return { docs: [] };
    });

    (stockBobinasLogic.calculateStockBobinas as any).mockReturnValue({
      rows: [{ tipo: "NORMAL", metrajeML: 100, numBobinas: 1, pesoKg: 1000 }],
      negativeCoils: []
    });

    (mapper.mapStockBobinasToReportRows as any).mockReturnValue([
      { tipo: "NORMAL", metrajeML: 100, numBobinas: 1, pesoKg: 1000 }
    ]);

    const result = await runStockBobinas();

    expect(result.warnings).toBeUndefined();
    expect(result.rows).toHaveLength(1);
    expect(result.rows.some((r: any) => r.tipo === "⚠️ ANOMALÍA")).toBe(false);
  });
});
