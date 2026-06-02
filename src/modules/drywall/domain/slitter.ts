import { PlannedStrip } from "@/types";
import { calculateEffectiveCostPerMm, calculateCostPerStrip } from "./costing";

/** Ítem de entrada para el plan de corte, con el stripWidth ya resuelto del catálogo. */
export interface PlanItem {
  sku: string;
  quantity: number;
  /** Ancho del fleje para este SKU, obtenido del catálogo de productos (mm). */
  stripWidth: number;
}

export interface CuttingPlanResult {
  plannedStrips: PlannedStrip[];
  totalPlannedWidth: number;
  leftoverWidth: number;
  effectiveCostPerMm: number;
}

/**
 * Valida y construye el plan de corte para una bobina madre.
 *
 * Responsabilidades:
 * - Verifica que cada ítem tenga stripWidth > 0 y quantity > 0.
 * - Verifica que el ancho total planificado no supere el masterWidth.
 * - Delega el cálculo de costo por mm a {@link calculateEffectiveCostPerMm}
 *   (aplica la regla del sobrante ≤ 40mm).
 * - Construye el array de PlannedStrip con costPerStrip calculado.
 *
 * @throws {Error} Si el ancho total supera el ancho de la bobina o algún ítem es inválido.
 */
export function calculateCuttingPlan(params: {
  totalCoilCost: number;
  masterWidth: number;
  items: PlanItem[];
}): CuttingPlanResult {
  const { totalCoilCost, masterWidth, items } = params;

  for (const item of items) {
    if (!item.stripWidth || item.stripWidth <= 0) {
      throw new Error(`El producto ${item.sku} no tiene 'stripWidth' válido.`);
    }
    if (Number(item.quantity) <= 0) {
      throw new Error(`La cantidad para ${item.sku} debe ser mayor a 0.`);
    }
  }

  const totalPlannedWidth = items.reduce(
    (sum, item) => sum + item.stripWidth * Number(item.quantity),
    0,
  );

  if (totalPlannedWidth > masterWidth) {
    throw new Error("El ancho total de los flejes supera el ancho de la bobina.");
  }

  const leftoverWidth = masterWidth - totalPlannedWidth;
  const effectiveCostPerMm = calculateEffectiveCostPerMm(
    totalCoilCost,
    masterWidth,
    totalPlannedWidth,
  );

  const plannedStrips: PlannedStrip[] = items.map((item) => {
    const qty = Number(item.quantity);
    return {
      sku: item.sku,
      initialCount: qty,
      pendingCount: qty,
      width: item.stripWidth,
      costPerStrip: calculateCostPerStrip(item.stripWidth, effectiveCostPerMm),
    };
  });

  return { plannedStrips, totalPlannedWidth, leftoverWidth, effectiveCostPerMm };
}

/**
 * Calcula el scrap (sobrante de ancho) prorrateado por fleje individual.
 *
 * El leftover total (masterWidth − totalPlannedWidth) se divide en partes iguales
 * entre el número total de flejes planificados (suma de initialCount de todos los strips).
 * Este valor se almacena en production_logs para trazabilidad del rendimiento.
 *
 * @param masterWidth    Ancho total de la bobina madre (mm).
 * @param plannedStrips  Array de flejes planificados con width e initialCount.
 * @returns Scrap por fleje en mm, o 0 si no hay strips.
 */
export function calculateScrapPerStrip(
  masterWidth: number,
  plannedStrips: PlannedStrip[],
): number {
  const totalPlannedWidth = plannedStrips.reduce(
    (sum, s) => sum + s.width * s.initialCount,
    0,
  );
  const totalStripCount = plannedStrips.reduce(
    (sum, s) => sum + s.initialCount,
    0,
  );

  if (totalStripCount === 0) return 0;

  return (masterWidth - totalPlannedWidth) / totalStripCount;
}
