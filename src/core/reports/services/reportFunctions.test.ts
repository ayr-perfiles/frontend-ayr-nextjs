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
