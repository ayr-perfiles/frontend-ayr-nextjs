import { describe, it, expect, vi } from "vitest";
import { getKardexMovementDisplay } from "./kardexMovementDisplay";

describe("getKardexMovementDisplay", () => {
  it("should map IN to ENTRADA with positive sign", () => {
    const result = getKardexMovementDisplay("IN");
    expect(result.sign).toBe("+");
    expect(result.label).toBe("ENTRADA");
    expect(result.className).toContain("text-emerald-700");
  });

  it("should map ENTRADA to ENTRADA with positive sign", () => {
    const result = getKardexMovementDisplay("ENTRADA");
    expect(result.sign).toBe("+");
    expect(result.label).toBe("ENTRADA");
    expect(result.className).toContain("text-emerald-700");
  });

  it("should map OUT to SALIDA with negative sign", () => {
    const result = getKardexMovementDisplay("OUT");
    expect(result.sign).toBe("-");
    expect(result.label).toBe("SALIDA");
    expect(result.className).toContain("text-red-700");
  });

  it("should map SALIDA to SALIDA with negative sign", () => {
    const result = getKardexMovementDisplay("SALIDA");
    expect(result.sign).toBe("-");
    expect(result.label).toBe("SALIDA");
    expect(result.className).toContain("text-red-700");
  });

  it("should map SCRAP to MERMA with negative sign", () => {
    const result = getKardexMovementDisplay("SCRAP");
    expect(result.sign).toBe("-");
    expect(result.label).toBe("MERMA");
    expect(result.className).toContain("text-amber-700");
    expect(result.className).toContain("bg-amber-50");
  });

  it("should map SCRAP_REVERSAL to REVERSA MERMA with positive sign", () => {
    const result = getKardexMovementDisplay("SCRAP_REVERSAL");
    expect(result.sign).toBe("+");
    expect(result.label).toBe("REVERSA MERMA");
    expect(result.className).toContain("text-emerald-700");
  });

  it("should handle unmapped types by returning raw label, empty sign, and gray color", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = getKardexMovementDisplay("AJUSTE_INVENTADO");
    
    expect(warnSpy).toHaveBeenCalledWith("[kardex] type no mapeado: AJUSTE_INVENTADO");
    expect(result.sign).toBe("");
    expect(result.label).toBe("AJUSTE_INVENTADO");
    expect(result.className).toContain("text-gray-600");
    expect(result.className).toContain("bg-gray-100");
    
    warnSpy.mockRestore();
  });
});
