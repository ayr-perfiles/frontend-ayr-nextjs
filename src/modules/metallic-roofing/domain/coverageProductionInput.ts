/**
 * Cómputo puro del ML declarado de una fila de producción COBERTURA_ML a
 * partir de cantidad de piezas × longitud por pieza (m). UI-only: no participa
 * en calcProductionFromCoils ni en el costeo — es previo al armado del payload.
 */

/** Parsea un input de texto a número positivo. "", 0, negativos o no-numérico → null (sin fallback silencioso). */
export function parsePositiveNumberInput(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** cantidad×longitud → ML. Cualquier input inválido (null, ≤0) → null explícito, nunca 0 silencioso. */
export function computeCoverageDeclaredMl(
  cantidad: number | null,
  longitud: number | null,
): number | null {
  if (cantidad === null || longitud === null) return null;
  if (!(cantidad > 0) || !(longitud > 0)) return null;
  return Number((cantidad * longitud).toFixed(4));
}
