// SYNC-MARKER: src/modules/drywall/domain/drywallProduction.ts

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

export interface StripProductionInput {
  stripsUsed: number;
  pieces: number;
  stripStock: {
    totalWeight: number;
    totalStrips: number;
    avgCostPerKg: number;
  };
  product: {
    standardWeight: number;
  };
  ptStock: {
    totalQuantity: number;
    lastCostPerPiece: number;
  };
}

export interface StripProductionResult {
  avgWeight: number;
  consumedWeightKg: number;
  consumedCostPEN: number;
  reportedWeightKg: number;
  costPerPiece: number;
  newAverageCost: number;
  averageCostAfter: number;
}

export function calcProductionFromStrip(input: StripProductionInput): StripProductionResult {
  const { stripsUsed, pieces, stripStock, product, ptStock } = input;

  if (pieces <= 0) {
    throw new Error('La cantidad de piezas debe ser mayor a 0.');
  }
  if (stripsUsed <= 0) {
    throw new Error('La cantidad de flejes a usar debe ser mayor a 0.');
  }

  if (stripStock.totalStrips <= 0 || stripStock.totalWeight <= 0) {
    throw new Error('El stock del fleje es inválido o está agotado (peso o cantidad <= 0).');
  }

  const avgWeight = stripStock.totalWeight / stripStock.totalStrips;
  const consumedWeightKg = stripsUsed * avgWeight;
  const consumedCostPEN = stripsUsed * (stripStock.avgCostPerKg * avgWeight);

  const reportedWeightKg = pieces * (product.standardWeight || 0);
  const costPerPiece = consumedCostPEN / pieces;

  const newAverageCost = calculateWeightedAverageCost({
    currentQty: ptStock.totalQuantity,
    currentAverageCost: ptStock.lastCostPerPiece,
    batchTotalCost: consumedCostPEN,
    newPieces: pieces,
  });

  return {
    avgWeight,
    consumedWeightKg: Number(consumedWeightKg.toFixed(4)),
    consumedCostPEN: Number(consumedCostPEN.toFixed(4)),
    reportedWeightKg: Number(reportedWeightKg.toFixed(4)),
    costPerPiece: Number(costPerPiece.toFixed(6)),
    newAverageCost: Number(newAverageCost.toFixed(6)),
    averageCostAfter: Number(newAverageCost.toFixed(6)),
  };
}
