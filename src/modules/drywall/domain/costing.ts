import { LEFTOVER_THRESHOLD_MM } from "@/domain/steel/constants";

/**
 * Calcula el costo efectivo por milímetro de ancho de bobina.
 *
 * Regla del sobrante (≤ 40mm):
 * - Si 0 < leftover ≤ LEFTOVER_THRESHOLD_MM: el costo se distribuye solo sobre el
 *   ancho planificado. El scrap no tiene valor de rescate a esa escala y no debe
 *   "absorber" una porción del costo de la bobina.
 * - En cualquier otro caso (leftover = 0 o > 40mm): se usa el masterWidth completo
 *   como base de distribución.
 *
 * @param totalCoilCost  Costo total de la bobina (initialWeight × pricePerKg).
 * @param masterWidth    Ancho total de la bobina madre (mm).
 * @param totalPlannedWidth Suma de anchos × cantidades de todos los flejes planificados (mm).
 */
export function calculateEffectiveCostPerMm(
  totalCoilCost: number,
  masterWidth: number,
  totalPlannedWidth: number,
): number {
  const leftoverWidth = masterWidth - totalPlannedWidth;
  const isSmallLeftover = leftoverWidth > 0 && leftoverWidth <= LEFTOVER_THRESHOLD_MM;
  return totalCoilCost / (isSmallLeftover ? totalPlannedWidth : masterWidth);
}

/**
 * Calcula el costo asignado al fleje completo (todos sus flejes de ese SKU en el corte).
 * El resultado se redondea a 2 decimales para consistencia con el kardex.
 *
 * @param stripWidth         Ancho del fleje (mm).
 * @param effectiveCostPerMm Costo por mm calculado con {@link calculateEffectiveCostPerMm}.
 */
export function calculateCostPerStrip(
  stripWidth: number,
  effectiveCostPerMm: number,
): number {
  return Number((stripWidth * effectiveCostPerMm).toFixed(2));
}

/**
 * Calcula el nuevo costo promedio ponderado al incorporar un lote al kardex (método PEPPS).
 *
 * Fórmula: (valorInventarioActual + costoLoteNuevo) / (cantidadActual + piezasNuevas)
 *
 * Caso borde: si no hay stock previo (currentQty ≤ 0), el promedio es el costo unitario
 * del lote (batchTotalCost / newPieces).
 *
 * @param currentQty          Cantidad actual en stock antes del ingreso.
 * @param currentAverageCost  Costo promedio ponderado actual (por pieza).
 * @param batchTotalCost      Costo total del lote nuevo (= costPerStrip del fleje).
 * @param newPieces           Cantidad de piezas producidas en este lote.
 */
export function calculateWeightedAverageCost(params: {
  currentQty: number;
  currentAverageCost: number;
  batchTotalCost: number;
  newPieces: number;
}): number {
  const { currentQty, currentAverageCost, batchTotalCost, newPieces } = params;

  if (currentQty <= 0) {
    return batchTotalCost / newPieces;
  }

  const inventoryValueBefore = currentQty * currentAverageCost;
  return (inventoryValueBefore + batchTotalCost) / (currentQty + newPieces);
}
