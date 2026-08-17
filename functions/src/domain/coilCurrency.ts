/**
 * Resuelve el estado de moneda a persistir en `coil.metadata` al editar una bobina.
 * Sin I/O, sin side-effects.
 *
 * PEN (o ausente) siempre normaliza a { PEN, exchangeRate:1, originalCurrencyValue:null }.
 * originalCurrencyValue:null es señal de "limpiar" — el callable lo traduce a FieldValue.delete().
 */

export interface CoilCurrencyInput {
  currency?: string;
  exchangeRate?: number;
  originalCurrencyValue?: number;
}

export interface CoilCurrencyResolved {
  currency: "PEN" | "USD";
  exchangeRate: number;
  originalCurrencyValue: number | null;
}

export function resolveCoilCurrencyUpdate(input: CoilCurrencyInput): CoilCurrencyResolved {
  if (input.currency === "USD") {
    const exchangeRate = input.exchangeRate ?? 0;
    if (!(exchangeRate > 1)) {
      throw new Error("USD requiere exchangeRate > 1");
    }
    return {
      currency: "USD",
      exchangeRate,
      originalCurrencyValue: input.originalCurrencyValue ?? null,
    };
  }
  return { currency: "PEN", exchangeRate: 1, originalCurrencyValue: null };
}
