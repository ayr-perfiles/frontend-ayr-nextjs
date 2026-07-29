import { describe, it, expect } from "vitest";
import { computeCoberturaPrefill } from "./coberturaPrefill";

describe("computeCoberturaPrefill", () => {
  it("cobertura fresca (1000, 10, 100) -> cantidad: '100', longitud: '10'", () => {
    expect(computeCoberturaPrefill(1000, 10, 100)).toEqual({ cantidad: "100", longitud: "10" });
  });

  it("cobertura parcial (600, 10, 100) -> cantidad: '60', longitud: '10'", () => {
    expect(computeCoberturaPrefill(600, 10, 100)).toEqual({ cantidad: "60", longitud: "10" });
  });

  it("sin longitud válida (1000, 0, 100) -> null", () => {
    expect(computeCoberturaPrefill(1000, 0, 100)).toBeNull();
  });

  it("sin piecesCount (1000, 10, undefined) -> null", () => {
    expect(computeCoberturaPrefill(1000, 10, undefined)).toBeNull();
  });
});
