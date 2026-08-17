import { describe, expect, it } from "vitest";
import { resolveCoilCurrencyUpdate } from "./coilCurrency";

describe("resolveCoilCurrencyUpdate", () => {
  it("USD con TC valido y valor original -> conserva USD/TC/valor", () => {
    expect(
      resolveCoilCurrencyUpdate({ currency: "USD", exchangeRate: 3.5, originalCurrencyValue: 4000 }),
    ).toEqual({ currency: "USD", exchangeRate: 3.5, originalCurrencyValue: 4000 });
  });

  it("PEN con TC/valor USD colgados -> normaliza a PEN/1/null", () => {
    expect(
      resolveCoilCurrencyUpdate({ currency: "PEN", exchangeRate: 3.5, originalCurrencyValue: 4000 }),
    ).toEqual({ currency: "PEN", exchangeRate: 1, originalCurrencyValue: null });
  });

  it("PEN sin mas datos -> PEN/1/null", () => {
    expect(resolveCoilCurrencyUpdate({ currency: "PEN" })).toEqual({
      currency: "PEN",
      exchangeRate: 1,
      originalCurrencyValue: null,
    });
  });

  it("currency ausente -> PEN/1/null (default)", () => {
    expect(resolveCoilCurrencyUpdate({})).toEqual({
      currency: "PEN",
      exchangeRate: 1,
      originalCurrencyValue: null,
    });
  });

  it("USD con exchangeRate=1 -> throw", () => {
    expect(() => resolveCoilCurrencyUpdate({ currency: "USD", exchangeRate: 1 })).toThrow(
      "USD requiere exchangeRate > 1",
    );
  });

  it("USD sin exchangeRate -> throw", () => {
    expect(() => resolveCoilCurrencyUpdate({ currency: "USD" })).toThrow(
      "USD requiere exchangeRate > 1",
    );
  });
});
