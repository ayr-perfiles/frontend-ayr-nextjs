import { describe, expect, it } from "vitest";
import { validateCoilCurrencyForm } from "./coilCurrencyForm";

describe("validateCoilCurrencyForm", () => {
  it("USD con TC=1 -> invalido", () => {
    expect(validateCoilCurrencyForm({ currency: "USD", exchangeRate: 1 })).toEqual({
      ok: false,
      message: "Ingresá un tipo de cambio mayor a 1",
    });
  });

  it("USD con TC=0 -> invalido", () => {
    expect(validateCoilCurrencyForm({ currency: "USD", exchangeRate: 0 })).toEqual({
      ok: false,
      message: "Ingresá un tipo de cambio mayor a 1",
    });
  });

  it("USD con TC=3.75 -> valido", () => {
    expect(validateCoilCurrencyForm({ currency: "USD", exchangeRate: 3.75 })).toEqual({ ok: true });
  });

  it("PEN con TC=1 -> valido", () => {
    expect(validateCoilCurrencyForm({ currency: "PEN", exchangeRate: 1 })).toEqual({ ok: true });
  });

  it("PEN con TC=5 -> valido (PEN ignora TC)", () => {
    expect(validateCoilCurrencyForm({ currency: "PEN", exchangeRate: 5 })).toEqual({ ok: true });
  });
});
