/**
 * Calcula el máximo de piezas esperadas de un fleje basado en la densidad volumétrica del metal.
 * @param weightKg Peso del fleje a procesar (en Kg)
 * @param widthMm Ancho del fleje (en mm, ej: 121)
 * @param thicknessMm Espesor de la chapa (en mm, ej: 0.45)
 * @param pieceLengthM Largo del producto a fabricar (en metros, ej: 3.00)
 * @param densityFactor Factor del metal (7.85 por defecto para el acero)
 * @returns Número entero de piezas máximas esperadas
 */
export const calculateExpectedPiecesByDensity = (
  weightKg: number,
  widthMm: number,
  thicknessMm: number,
  pieceLengthM: number,
  densityFactor: number,
): number => {
  if (
    !weightKg ||
    !widthMm ||
    !thicknessMm ||
    !pieceLengthM ||
    weightKg <= 0 ||
    widthMm <= 0 ||
    thicknessMm <= 0 ||
    pieceLengthM <= 0 ||
    !densityFactor ||
    densityFactor <= 0
  ) {
    return 0;
  }

  const totalMeters = weightKg / (thicknessMm * widthMm * densityFactor);

  return Math.floor(totalMeters / pieceLengthM);
};
