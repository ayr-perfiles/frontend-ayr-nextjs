// SKU generation rules per CLAUDE.md §6 (Roofing)
// Format: [MATERIAL][LENGTH_CODE]MT[COLOR?]
// Default color (ROJO) is omitted from the SKU.
// Examples:
//   UPVC + 6.0m + ROJO  → UPVC6MT
//   UPVC + 3.6m + ROJO  → UPVC36MT
//   UPVC + 6.0m + AZUL  → UPVC6MTAZUL
//   UPVC + 4.8m + VERDE → UPVC48MTVERDE

export interface SKUInput {
  material: string;
  /** Metros (ej: 6.0, 3.6, 4.8) */
  length: number;
  color: string;
}

/** Encodes the length removing the decimal and any trailing zeros.
 *  6.0 → "6", 3.6 → "36", 4.8 → "48", 2.44 → "244" */
function lengthCode(length: number): string {
  const hundredths = Math.round(length * 100);
  return hundredths.toString().replace(/0+$/, '');
}

export function generateSKU({ material, length, color }: SKUInput): string {
  const mat = material.toUpperCase();
  const col = color.toUpperCase();

  if (mat === 'UPVC') {
    const colorSuffix = col === 'ROJO' ? '' : col;
    return `UPVC${lengthCode(length)}MT${colorSuffix}`;
  }

  throw new Error(`Material '${material}' no soportado para generación de SKU automático.`);
}

/**
 * Genera una clave determinista para validar unicidad de combinación.
 * Usar en el service layer: if (existsCombination(combinationKey(input))) throw ...
 *
 * ⚠️  La validación real contra Firestore debe hacerse en catalogService,
 * NO en el Zod schema (requiere acceso a BD).
 */
export function combinationKey(input: {
  material: string;
  color: string;
  thickness: number;
  width: number;
  length: number;
}): string {
  return [
    input.material.toUpperCase(),
    input.color.toUpperCase(),
    input.thickness,
    input.width,
    input.length,
  ].join('|');
}
