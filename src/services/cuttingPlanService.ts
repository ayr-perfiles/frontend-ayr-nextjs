import { PRODUCT_CATALOG } from "@/config/products";

export interface CuttingItem {
  sku: keyof typeof PRODUCT_CATALOG;
  quantity: number;
}

/**
 * Valida si el plan de corte es físicamente posible
 */
export const validateCuttingPlan = (
  items: CuttingItem[],
  availableWeight: number,
) => {
  const totalPlannedWeight = items.reduce((sum, item) => {
    const product = PRODUCT_CATALOG[item.sku];
    return sum + item.quantity * product.standardWeight;
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
