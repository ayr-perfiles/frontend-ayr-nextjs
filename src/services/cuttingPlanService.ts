import { getCatalog } from "@/services/catalogService";

export interface CuttingItem {
  sku: string; // <-- Cambiado: Ahora acepta cualquier string dinámico
  quantity: number;
}

/**
 * Valida si el plan de corte es físicamente posible consultando los pesos en Firebase
 */
export const validateCuttingPlan = async (
  items: CuttingItem[],
  availableWeight: number,
) => {
  // 1. Obtenemos el catálogo actualizado desde Firebase
  const catalog = await getCatalog();

  // 2. Calculamos el peso total buscando cada SKU en el catálogo dinámico
  const totalPlannedWeight = items.reduce((sum, item) => {
    const product = catalog.find((p) => p.sku === item.sku);
    const standardWeight = product?.standardWeight || 0;
    return sum + item.quantity * standardWeight;
  }, 0);

  const isValid = totalPlannedWeight <= availableWeight;
  const remainingWeight = availableWeight - totalPlannedWeight;

  return {
    isValid,
    totalPlannedWeight: Number(totalPlannedWeight.toFixed(2)),
    remainingWeight: Number(remainingWeight.toFixed(2)),
    excessWeight: isValid
      ? 0
      : Number((totalPlannedWeight - availableWeight).toFixed(2)),
  };
};
