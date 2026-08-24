import type { MetallicFamily } from '../types';

/**
 * ⚠️ Los SKU reales de aluzinc son INCONSISTENTES (BOB28NAT vs BOB045GALV, PL040X6MT).
 * Por eso el flujo recomendado es SKU MANUAL con override; este generador es solo
 * conveniencia para altas que sí quieran seguir un patrón regular.
 */
const FAMILY_PREFIX: Record<MetallicFamily, string> = {
  COBERTURA: 'COB',
  PLANCHA: 'PL',

};

/** 0.30 -> "030", 0.45 -> "045". Legacy a veces usa "28" para 0.28; preferir override manual. */
function thicknessToken(mm: number): string {
  return String(Math.round(mm * 100)).padStart(3, '0');
}

export function generateSKU(input: {
  family: MetallicFamily;
  finish: string;
  thickness: number;

  length?: number;
}): string {
  const prefix = FAMILY_PREFIX[input.family];
  const th = thicknessToken(input.thickness);
  const lengthPart = input.length ? `${Math.round(input.length)}MT` : '';
  // ROJO es color base implícito (no se sufija), igual que en roofing.
  const tail = input.finish.toUpperCase() !== 'ROJO' ? input.finish.toUpperCase() : '';
  return `${prefix}${th}${lengthPart}${tail}`.replace(/\s+/g, '');
}

/** Clave de unicidad por combinación física (espejo de roofing/combinationKey). */
export function combinationKey(input: {
  family: string;
  finish: string;

  thickness: number;
  width?: number;
  length?: number;
}): string {
  return [input.family, input.finish, input.thickness, input.width ?? '', input.length ?? '']
    .map((v) => String(v).toUpperCase().trim())
    .join('|');
}
