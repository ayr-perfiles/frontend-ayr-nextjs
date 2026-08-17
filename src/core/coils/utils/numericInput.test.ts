import { describe, expect, it } from "vitest";
import { sanitizeNumericPaste } from "./numericInput";

describe("sanitizeNumericPaste", () => {
  it("quita el signo negativo: -4714 -> 4714", () => {
    expect(sanitizeNumericPaste("-4714")).toBe("4714");
  });

  it("quita comas de miles y espacios:  -4,714  -> 4714", () => {
    expect(sanitizeNumericPaste(" -4,714 ")).toBe("4714");
  });

  it("quita pipes y espacios: | -4714 | -> 4714", () => {
    expect(sanitizeNumericPaste("| -4714 |")).toBe("4714");
  });

  it("respeta decimal simple: 4714.5 -> 4714.5", () => {
    expect(sanitizeNumericPaste("4714.5")).toBe("4714.5");
  });

  it("quita comas de miles con decimal: 4,714.50 -> 4714.50", () => {
    expect(sanitizeNumericPaste("4,714.50")).toBe("4714.50");
  });

  it("colapsa multiples puntos al primero: 12.3.4 -> 12.34", () => {
    expect(sanitizeNumericPaste("12.3.4")).toBe("12.34");
  });

  it("texto no numerico -> vacio", () => {
    expect(sanitizeNumericPaste("abc")).toBe("");
  });

  it("vacio -> vacio", () => {
    expect(sanitizeNumericPaste("")).toBe("");
  });
});
