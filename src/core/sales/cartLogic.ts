import type { CartItem } from "@/services/salesService";

/**
 * Lógica pura del carrito, EXTRAÍDA del inline de `src/app/admin/sales/new/page.tsx`
 * (POS real, código LIVE) para que la página de edición de cotización la reuse sin
 * duplicarla.
 *
 * ⚠️ Las fórmulas son copia TEXTUAL del inline previo — no se "mejoraron" al extraerlas.
 * `cartLogic.test.ts` mantiene una copia de referencia de las versiones viejas y assertea
 * igualdad contra ellas: si alguien toca estas funciones, el diff de comportamiento salta ahí.
 */

export interface CartTotals {
  /** Σ quantity × unitPrice — CON IGV. */
  totalAmount: number;
  /** Σ quantity × unitValue — SIN IGV. */
  totalValue: number;
  /** Σ quantity × baseCost. */
  totalCost: number;
  /** totalAmount − totalValue. */
  totalIGV: number;
  /** Σ quantity × unitWeight. */
  totalWeight: number;
  /** totalValue − totalCost (margen SIN IGV, no contra totalAmount). */
  projectedProfit: number;
  /** % sobre totalValue; 0 si totalValue es 0 (evita NaN/Infinity). */
  marginPercent: number;
  /** Umbral de alerta, se propaga tal cual para que el consumidor no lo recalcule. */
  minMarginAlert: number;
}

export function computeCartTotals(cart: CartItem[], minMarginAlert: number): CartTotals {
  const totalAmount = cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const totalValue = cart.reduce((s, i) => s + i.quantity * i.unitValue, 0);
  const totalCost = cart.reduce((s, i) => s + i.quantity * i.baseCost, 0);
  const totalIGV = totalAmount - totalValue;
  const totalWeight = cart.reduce((s, i) => s + i.quantity * (i.unitWeight ?? 0), 0);
  const projectedProfit = totalValue - totalCost;
  const marginPercent = totalValue > 0 ? (projectedProfit / totalValue) * 100 : 0;

  return {
    totalAmount,
    totalValue,
    totalCost,
    totalIGV,
    totalWeight,
    projectedProfit,
    marginPercent,
    minMarginAlert,
  };
}

/**
 * Agrega un ítem al carrito fusionando por `(sku, businessLine)`.
 *
 * Si ya existe esa combinación: SUMA la cantidad y pisa `unitPrice`/`unitValue` con los del
 * ítem nuevo — el resto de los campos del existente se conservan (`productName`,
 * `unitWeight`, `weightSnapshot`, …). Dos líneas del mismo SKU en líneas de negocio
 * distintas NO se fusionan.
 *
 * `businessLine` ausente cuenta como `'drywall'` a ambos lados de la comparación.
 * Devuelve un array nuevo; no muta el previo.
 */
export function addItemToCart(prev: CartItem[], newItem: CartItem): CartItem[] {
  const existingIdx = prev.findIndex(
    (i) =>
      i.sku === newItem.sku &&
      (i.businessLine ?? "drywall") === (newItem.businessLine ?? "drywall"),
  );

  if (existingIdx >= 0) {
    const updated = [...prev];
    updated[existingIdx] = {
      ...updated[existingIdx],
      quantity: updated[existingIdx].quantity + newItem.quantity,
      unitPrice: newItem.unitPrice,
      unitValue: newItem.unitValue,
    };
    return updated;
  }

  return [...prev, newItem];
}
