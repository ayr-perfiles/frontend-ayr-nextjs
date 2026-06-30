import {
  CoilProductionInput,
  TargetSkuInfo,
  CoilBreakdown,
  CoilProductionResult,
} from "../types/production";

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
