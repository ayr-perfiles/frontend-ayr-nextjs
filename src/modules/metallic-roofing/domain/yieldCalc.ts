import type { Coil, ProductionLog } from '@/types';

export interface YieldDeviationInput {
  coil: Coil;
  productionLogs: ProductionLog[];
  densityFactor: number;
  kgVendidoCrudo?: number; // Ventas isCoil
}

export interface YieldDeviationResult {
  mlTeorico: number;
  mlProducido: number;
  kgTeoricoConsumido: number;
  kgRealConsumido: number;
  desviacionKg: number;
  desviacionPct: number;
  yieldAlert: boolean;
  umbralAlert: number;
}

export function calcCoilTheoreticalML(input: {
  weightKg: number;
  thicknessMm: number;
  masterWidthMm: number;
  densityFactor: number;
}): number {
  const { weightKg, thicknessMm, masterWidthMm, densityFactor } = input;
  if (!thicknessMm || !masterWidthMm || !densityFactor) return 0;
  // pesoKg = ML * thicknessMm * widthMm * densityFactor
  // ML = pesoKg / (thicknessMm * widthMm * densityFactor)
  return weightKg / (thicknessMm * masterWidthMm * densityFactor);
}

export function calcCoilYieldDeviation(
  input: YieldDeviationInput,
  umbralPct: number = 0.05
): YieldDeviationResult {
  const { coil, productionLogs, densityFactor, kgVendidoCrudo = 0 } = input;

  const mlTeorico = calcCoilTheoreticalML({
    weightKg: coil.initialWeight,
    thicknessMm: coil.thickness || 0,
    masterWidthMm: coil.masterWidth || 1200,
    densityFactor,
  });

  const mlProducido = productionLogs.reduce((acc, log) => {
    // ignorar anulados
    if (log.status === 'VOIDED') return acc;
    return acc + (log.mlProduced || 0);
  }, 0);

  const kgTeoricoConsumido = mlProducido * (coil.thickness || 0) * (coil.masterWidth || 1200) * densityFactor;
  
  const kgRealConsumido = coil.initialWeight - coil.currentWeight - kgVendidoCrudo;

  const desviacionKg = kgRealConsumido - kgTeoricoConsumido;
  const desviacionPct = kgTeoricoConsumido > 0 ? desviacionKg / kgTeoricoConsumido : 0;

  const yieldAlert = Math.abs(desviacionPct) > umbralPct;

  return {
    mlTeorico,
    mlProducido,
    kgTeoricoConsumido,
    kgRealConsumido,
    desviacionKg,
    desviacionPct,
    yieldAlert,
    umbralAlert: umbralPct,
  };
}
