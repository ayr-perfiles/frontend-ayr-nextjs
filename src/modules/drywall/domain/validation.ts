import { Coil } from "@/types";
import {
  MIN_THICKNESS_MM,
  MAX_THICKNESS_MM,
  PRODUCTION_TOLERANCE_FACTOR,
} from "@/domain/steel/constants";
import { calculateExpectedPiecesByDensity } from "@/utils/calculations";

/**
 * Valida que una bobina tiene los datos mínimos necesarios para planificar o producir.
 *
 * Campos verificados:
 * - initialWeight > 0
 * - masterWidth > 0
 * - pricePerKg > 0
 * - thickness: si está presente, debe estar dentro del rango permitido por la maquinaria.
 *
 * @throws {Error} Con mensaje en español si algún campo es inválido o está ausente.
 */
export function validateCoilData(
  coil: Pick<Coil, "initialWeight" | "masterWidth" | "pricePerKg" | "thickness">,
): void {
  if (!coil.initialWeight || coil.initialWeight <= 0) {
    throw new Error("El peso inicial de la bobina debe ser mayor a 0.");
  }
  if (!coil.masterWidth || coil.masterWidth <= 0) {
    throw new Error("El ancho maestro de la bobina debe ser mayor a 0.");
  }
  if (!coil.pricePerKg || coil.pricePerKg <= 0) {
    throw new Error("El precio por kg de la bobina debe ser mayor a 0.");
  }
  if (coil.thickness !== undefined && coil.thickness !== null) {
    if (coil.thickness <= 0) {
      throw new Error("El espesor de la bobina debe ser mayor a 0.");
    }
    if (coil.thickness < MIN_THICKNESS_MM || coil.thickness > MAX_THICKNESS_MM) {
      throw new Error(
        `El espesor (${coil.thickness}mm) está fuera del rango permitido ` +
          `(${MIN_THICKNESS_MM}–${MAX_THICKNESS_MM}mm).`,
      );
    }
  }
}

export interface ProductionValidationResult {
  /** Piezas teóricas exactas según la fórmula de densidad (sin tolerancia). */
  expectedPieces: number;
  /** Límite máximo permitido con la tolerancia de producción aplicada. */
  maxAllowedPieces: number;
}

/**
 * Valida que el número de piezas solicitado no excede el límite físico del fleje.
 *
 * Usa la fórmula de densidad siderúrgica (7.85 g/cm³) con la tolerancia
 * PRODUCTION_TOLERANCE_FACTOR (5%) para absorber variaciones en el peso
 * declarado por el proveedor y diferencias mínimas de espesor dentro del coil.
 *
 * maxAllowedPieces = ceil(expectedPieces × PRODUCTION_TOLERANCE_FACTOR)
 *
 * @param requestedPieces Piezas que el operario quiere registrar.
 * @param stripWeight     Peso teórico del fleje (kg), calculado como width × weightPerMm.
 * @param stripWidth      Ancho del fleje (mm).
 * @param thickness       Espesor de la bobina (mm).
 * @param pieceLength     Largo del producto a fabricar (m).
 *
 * @throws {Error} Si requestedPieces supera el límite físico calculado.
 * @returns Valores calculados para logging/auditoría en production_logs.
 */
export function validateProductionInput(params: {
  requestedPieces: number;
  stripWeight: number;
  stripWidth: number;
  thickness: number;
  pieceLength: number;
}): ProductionValidationResult {
  const { requestedPieces, stripWeight, stripWidth, thickness, pieceLength } = params;

  const expectedPieces = calculateExpectedPiecesByDensity(
    stripWeight,
    stripWidth,
    thickness,
    pieceLength,
  );
  const maxAllowedPieces = Math.ceil(expectedPieces * PRODUCTION_TOLERANCE_FACTOR);

  if (requestedPieces > maxAllowedPieces) {
    throw new Error(
      `¡Límite Físico Excedido! Es imposible sacar ${requestedPieces} piezas. ` +
        `Según la fórmula de densidad, lo máximo permitido (con tolerancia) son ${maxAllowedPieces} piezas.`,
    );
  }

  return { expectedPieces, maxAllowedPieces };
}
