import { describe, it, expect } from "vitest";
import { getProductionUnitAndValue } from "./unitLogic";

describe("getProductionUnitAndValue", () => {
  it("returns mlProduced and 'ML' for COBERTURA", () => {
    const result = getProductionUnitAndValue(
      { sku: "COB-1", piecesProduced: 10, mlProduced: 15 },
      { "COB-1": "COBERTURA" }
    );
    expect(result).toEqual({ value: 15, unitLabel: "ML" });
  });

  it("returns null and 'ML' for COBERTURA if mlProduced is missing", () => {
    const result = getProductionUnitAndValue(
      { sku: "COB-2", piecesProduced: 25 },
      { "COB-2": "COBERTURA" }
    );
    expect(result).toEqual({ value: null, unitLabel: "ML" });
  });

  it("returns piecesProduced and 'piezas' for PLANCHA", () => {
    const result = getProductionUnitAndValue(
      { sku: "PLA-1", piecesProduced: 50, mlProduced: 100 },
      { "PLA-1": "PLANCHA" }
    );
    expect(result).toEqual({ value: 50, unitLabel: "piezas" });
  });

  it("returns piecesProduced and 'piezas' for unknown/missing family", () => {
    const result = getProductionUnitAndValue(
      { sku: "UNK-1", piecesProduced: 30 },
      {}
    );
    expect(result).toEqual({ value: 30, unitLabel: "piezas" });
  });
});
