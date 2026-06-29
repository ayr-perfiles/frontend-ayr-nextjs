/**
 * ⚠️ SYNC MARKER: existe copia de este archivo en functions/src/domain/ y functions/src/types/production.ts.
 * Si cambias esto (tipos o lógica), replica los cambios allá.
 *
 * Cálculo puro de producción conformado: bobinas → SKU terminado.
 * Sin I/O. Sin side-effects. Testeable Fase 1.
 *
 * Fórmula de consumo (por bobina):
 *   mlFromCoil      = declared (COBERTURA_ML) | declared × lengthM (PLANCHA_UND)
 *   weightConsumedKg = mlFromCoil × thicknessMm × coil.masterWidth × coilDensityFactor
 *   costPEN          = weightConsumedKg × coil.pricePerKg
 *
 * coilDensityFactor proviene de coil_finishes (NO del SKU).
 * masterWidth es el ancho desarrollado de la BOBINA (mm), no el ancho útil del producto.
 * No hay división por 1000 — coilDensityFactor ya incorpora la conversión de unidades.
 */

export interface CoilProductionInput {
  coilId: string;
  /** ML declarados (COBERTURA_ML) | piezas declaradas (PLANCHA_UND). */
  declared: number;
  thicknessMm: number;
  /** Ancho desarrollado de la bobina en mm (~1200). */
  masterWidth: number;
  pricePerKg: number;
  /** Factor del acabado en coil_finishes — NUNCA hardcodeado. */
  coilDensityFactor: number;
  /** Peso real a descontar (declarado opcionalmente). Si no existe, se usa el teórico. */
  reportedWeightKg?: number;
}

export interface TargetSkuInfo {
  productKind: 'COBERTURA_ML' | 'PLANCHA_UND';
  /** Largo en metros — requerido para PLANCHA_UND, null para COBERTURA_ML. */
  lengthM: number | null;
}

export interface CoilBreakdown {
  coilId: string;
  mlFromCoil: number;
  weightConsumedKg: number;
  costPEN: number;
}

export interface CoilProductionResult {
  /** Metros lineales totales producidos (siempre). */
  totalMl: number;
  /** ML (COBERTURA_ML) o piezas (PLANCHA_UND) — la unidad que aparece en stock. */
  cantidadProducida: number;
  pesoTotalKg: number;
  costoTotalPEN: number;
  /** Costo ponderado por unidad de stock. Congelar en production_log para P-M7. */
  costoUnitarioPEN: number;
  perCoilBreakdown: CoilBreakdown[];
}

export function calcProductionFromCoils(
  targetSku: TargetSkuInfo,
  coilInputs: CoilProductionInput[],
): CoilProductionResult {
  if (coilInputs.length === 0) {
    throw new Error('Se requiere al menos una bobina para la producción.');
  }

  if (targetSku.productKind === 'PLANCHA_UND' && (!targetSku.lengthM || targetSku.lengthM <= 0)) {
    throw new Error('Se requiere la longitud (lengthM) para producto tipo PLANCHA_UND.');
  }

  let totalMl = 0;
  let pesoTotalKg = 0;
  let costoTotalPEN = 0;
  let totalDeclared = 0;
  const perCoilBreakdown: CoilBreakdown[] = [];

  for (const coil of coilInputs) {
    if (coil.declared <= 0) {
      throw new Error(`La cantidad declarada para la bobina '${coil.coilId}' debe ser mayor a 0.`);
    }
    if (coil.coilDensityFactor <= 0) {
      throw new Error(`El factor de densidad de la bobina '${coil.coilId}' es inválido (debe ser > 0).`);
    }
    if (coil.masterWidth <= 0) {
      throw new Error(`El ancho maestro de la bobina '${coil.coilId}' debe ser mayor a 0 mm.`);
    }
    if (coil.thicknessMm <= 0) {
      throw new Error(`El espesor de la bobina '${coil.coilId}' debe ser mayor a 0 mm.`);
    }

    const mlFromCoil =
      targetSku.productKind === 'PLANCHA_UND'
        ? coil.declared * (targetSku.lengthM ?? 0)
        : coil.declared;

    const theoreticalWeight = mlFromCoil * coil.thicknessMm * coil.masterWidth * coil.coilDensityFactor;
    const weightConsumedKg = Number((coil.reportedWeightKg ?? theoreticalWeight).toFixed(4));
    const costPEN = Number((weightConsumedKg * coil.pricePerKg).toFixed(4));

    totalMl += mlFromCoil;
    pesoTotalKg += weightConsumedKg;
    costoTotalPEN += costPEN;
    totalDeclared += coil.declared;

    perCoilBreakdown.push({ coilId: coil.coilId, mlFromCoil, weightConsumedKg, costPEN });
  }

  totalMl = Number(totalMl.toFixed(4));
  pesoTotalKg = Number(pesoTotalKg.toFixed(4));
  costoTotalPEN = Number(costoTotalPEN.toFixed(4));

  const cantidadProducida =
    targetSku.productKind === 'PLANCHA_UND' ? totalDeclared : totalMl;

  if (cantidadProducida <= 0) {
    throw new Error('La cantidad producida total debe ser mayor a 0.');
  }

  const costoUnitarioPEN = Number((costoTotalPEN / cantidadProducida).toFixed(6));

  return { totalMl, cantidadProducida, pesoTotalKg, costoTotalPEN, costoUnitarioPEN, perCoilBreakdown };
}
