/**
 * Cálculo de peso para coberturas aluzinc.
 * Función pura: sin I/O, sin efectos secundarios. Testeable Fase 1.
 *
 * Fórmula validada:
 *   pesoKg = cantidad × thicknessMm × widthMm × densityFactor
 *
 * (No lleva /1000: densityFactor=0.008 ya incorpora la conversión de unidades
 *  → 8 kg/m²/mm en sistema mixto mm/metros = 0.008 kg/mm²·m)
 *
 * COBERTURA_ML:  pesoKg = quantity[ML] × thicknessMm × widthMm × densityFactor
 * PLANCHA_UND:   metrosTotales = quantity × lengthM
 *                pesoKg = metrosTotales × thicknessMm × widthMm × densityFactor
 * ACCESSORY: pesoKg = null (fuera de fórmula)
 */

import type { MetallicFamily } from '../types';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface CoverageWeightInput {
  family: MetallicFamily;
  unit: 'PIEZA' | 'METRO' | 'KILOGRAMO' | 'TONELADA';
  quantity: number;
  thicknessMm: number;
  widthMm: number;
  densityFactor: number | null;
  /** Largo en metros — requerido para PLANCHA, null para COBERTURA */
  lengthM: number | null;
  /** Color del producto — incluido en snapshot para trazabilidad */
  colorFinish: string;
}

export interface CoverageWeightResult {
  /** Peso total en kg, o null si el tipo no entra en la fórmula. */
  pesoKg: number | null;
  /** Metros lineales totales (solo COBERTURA y PLANCHA); null si no aplica. */
  metrosTotales: number | null;
  /** densityFactor efectivamente usado; null si no aplica. */
  factorUsado: number | null;
}

// ─── Función principal ────────────────────────────────────────────────────────

export function calcCoverageWeightKg(input: CoverageWeightInput): CoverageWeightResult {
  const { family, quantity, thicknessMm, widthMm, densityFactor, lengthM } = input;

  // ACCESSORY: fuera de fórmula
  if (family === 'ACCESORIO') {
    return { pesoKg: null, metrosTotales: null, factorUsado: null };
  }

  // Sin densityFactor no se puede calcular
  if (densityFactor === null || densityFactor <= 0) {
    return { pesoKg: null, metrosTotales: null, factorUsado: null };
  }

  if (family === 'COBERTURA') {
    // Unidad METRO → cada unidad es 1 ML
    const metrosTotales = quantity;
    const pesoKg = metrosTotales * thicknessMm * widthMm * densityFactor;
    return {
      pesoKg: Number(pesoKg.toFixed(4)),
      metrosTotales,
      factorUsado: densityFactor,
    };
  }

  if (family === 'PLANCHA') {
    if (lengthM === null || lengthM <= 0) {
      // Sin largo no se puede calcular para plancha
      return { pesoKg: null, metrosTotales: null, factorUsado: densityFactor };
    }
    const metrosTotales = quantity * lengthM;
    const pesoKg = metrosTotales * thicknessMm * widthMm * densityFactor;
    return {
      pesoKg: Number(pesoKg.toFixed(4)),
      metrosTotales: Number(metrosTotales.toFixed(4)),
      factorUsado: densityFactor,
    };
  }

  // Fallback (nunca debería llegar aquí con MetallicFamily tipada)
  return { pesoKg: null, metrosTotales: null, factorUsado: null };
}
