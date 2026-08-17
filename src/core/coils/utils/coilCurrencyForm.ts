/**
 * Validación pura del form de edición de bobina para el par currency/exchangeRate.
 * Sin I/O, sin side-effects.
 */

export interface CoilCurrencyFormInput {
  currency: string;
  exchangeRate: number;
}

export interface CoilCurrencyFormValidation {
  ok: boolean;
  message?: string;
}

export function validateCoilCurrencyForm(input: CoilCurrencyFormInput): CoilCurrencyFormValidation {
  if (input.currency === "USD" && !(input.exchangeRate > 1)) {
    return { ok: false, message: "Ingresá un tipo de cambio mayor a 1" };
  }
  return { ok: true };
}
