export interface QuoteItemLike {
  sku: string;
  quantity?: number;
  businessLine?: string;
}

export interface ProductionLogLike {
  sku: string;
  piecesProduced?: number;
  stripCost?: number;
  costPerPiece?: number;
  status?: string;
  perCoilBreakdown?: Array<{
    costPEN?: number;
    weightConsumedKg?: number;
  }>;
}

export interface SaleItemLike {
  sku: string;
  productName?: string;
  quantity: number;
  unitPrice?: number;
  unitValue?: number;
  baseCost?: number;
  profit?: number;
  businessLine?: string;
  costSource?: string;
  flags?: string[];
  [key: string]: unknown;
}

export interface SaleDocLike {
  items?: SaleItemLike[];
  totalAmount?: number;
  totalCost?: number;
  totalProfit?: number;
  totalWeight?: number;
  allFlags?: string[];
  [key: string]: unknown;
}

const EPSILON = 0.01;

/**
 * Determina si todas las líneas metallic-roofing de una cotización han sido cumplidas
 * según los logs de producción no-VOIDED asociados.
 * Regla idéntica a queueLogic: por SKU, ΣpiecesProduced >= ΣquantityRequested - EPSILON (0.01).
 */
export function isQuoteFulfilled(
  quoteItems: QuoteItemLike[] | undefined,
  logs: ProductionLogLike[] | undefined
): boolean {
  if (!quoteItems || quoteItems.length === 0) {
    return false;
  }

  const metallicItems = quoteItems.filter(
    (item) => item.businessLine === "metallic-roofing"
  );

  if (metallicItems.length === 0) {
    return false;
  }

  // Agrupar requerimiento por SKU
  const requestedBySku: Record<string, number> = {};
  for (const item of metallicItems) {
    if (!item.sku) continue;
    requestedBySku[item.sku] = (requestedBySku[item.sku] || 0) + (item.quantity || 0);
  }

  // Filtrar logs válidos no-VOIDED y sumar piezas producidas por SKU
  const validLogs = (logs || []).filter((log) => log.status !== "VOIDED");
  const producedBySku: Record<string, number> = {};
  for (const log of validLogs) {
    if (!log.sku) continue;
    producedBySku[log.sku] = (producedBySku[log.sku] || 0) + (log.piecesProduced || 0);
  }

  // Evaluar que todos los SKUs requeridos alcancen la cuota
  for (const [sku, requestedQty] of Object.entries(requestedBySku)) {
    const producedQty = producedBySku[sku] || 0;
    if (producedQty < requestedQty - EPSILON) {
      return false;
    }
  }

  return true;
}

export function productionUnitCostBySku(
  logs: ProductionLogLike[] | undefined
): Record<string, number> {
  const validLogs = (logs || []).filter((log) => log.status !== "VOIDED");
  const totalsBySku: Record<string, { totalCostPEN: number; totalPieces: number }> = {};

  for (const log of validLogs) {
    if (!log.sku) continue;
    if (!totalsBySku[log.sku]) {
      totalsBySku[log.sku] = { totalCostPEN: 0, totalPieces: 0 };
    }

    let logCostPEN = 0;
    if (typeof log.stripCost === "number" && !isNaN(log.stripCost)) {
      logCostPEN = log.stripCost;
    } else if (Array.isArray(log.perCoilBreakdown) && log.perCoilBreakdown.length > 0) {
      logCostPEN = log.perCoilBreakdown.reduce(
        (acc, b) => acc + (b.costPEN || 0),
        0
      );
    }

    const pieces = log.piecesProduced || 0;
    totalsBySku[log.sku].totalCostPEN += logCostPEN;
    totalsBySku[log.sku].totalPieces += pieces;
  }

  const result: Record<string, number> = {};
  for (const [sku, totals] of Object.entries(totalsBySku)) {
    if (totals.totalPieces > 0) {
      result[sku] = Number((totals.totalCostPEN / totals.totalPieces).toFixed(6));
    } else {
      result[sku] = 0;
    }
  }

  return result;
}

export function applyCostCascade<T extends SaleDocLike>(
  sale: T,
  costBySku: Record<string, number>
): T {
  const currentItems = Array.isArray(sale.items) ? sale.items : [];

  const newItems: SaleItemLike[] = currentItems.map((rawItem) => {
    const sku = rawItem.sku;
    const newBaseCost = costBySku[sku];

    if (newBaseCost !== undefined && newBaseCost > 0) {
      const quantity = rawItem.quantity || 0;
      const unitValue = rawItem.unitValue || 0;
      const unitPrice = rawItem.unitPrice || 0;
      const priceOrValue = unitValue > 0 ? unitValue : unitPrice;
      const profit = (priceOrValue - newBaseCost) * quantity;

      const itemFlags = (rawItem.flags || []).filter((f) => f !== "sin costo");

      return {
        ...rawItem,
        baseCost: newBaseCost,
        profit,
        costSource: "PRODUCTION",
        flags: itemFlags,
      };
    }

    return { ...rawItem };
  });

  // Recalcular totales sobre todos los ítems
  let newTotalCost = 0;
  let newTotalProfit = 0;

  for (const item of newItems) {
    const qty = item.quantity || 0;
    const bCost = item.baseCost || 0;
    const itemProfit = item.profit || 0;

    newTotalCost += bCost * qty;
    newTotalProfit += itemProfit;
  }

  // Evaluar 'sin costo' en flags globales
  let newAllFlags = sale.allFlags ? [...sale.allFlags] : [];
  const anyItemSinCosto = newItems.some((i) =>
    (i.flags || []).includes("sin costo")
  );
  if (!anyItemSinCosto) {
    newAllFlags = newAllFlags.filter((f) => f !== "sin costo");
  }

  return {
    ...sale,
    items: newItems,
    totalCost: newTotalCost,
    totalProfit: newTotalProfit,
    allFlags: newAllFlags,
  };
}
