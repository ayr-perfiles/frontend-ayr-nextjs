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

export function calcRevertProductionFromStrip(input: {
  stripPool: { totalWeight: number; totalStrips: number; avgCostPerKg: number };
  ptStock: { totalQuantity: number; lastCostPerPiece: number };
  log: { consumedWeightKg: number; consumedCostPEN: number; stripsUsed: number; piecesProduced: number };
}): {
  strip: { newTotalWeight: number; newTotalStrips: number; newAvgCostPerKg: number };
  pt: { newQuantity: number; newLastCostPerPiece: number };
  frozenStripCostPerKg: number;
} {
  const { stripPool, ptStock, log } = input;

  if (log.consumedWeightKg <= 0) {
    throw new Error('El peso consumido debe ser mayor a 0');
  }

  const frozenStripCostPerKg = Number((log.consumedCostPEN / log.consumedWeightKg).toFixed(6));

  const newTotalWeight = stripPool.totalWeight + log.consumedWeightKg;
  const newTotalStrips = stripPool.totalStrips + log.stripsUsed;
  const poolValueBefore = stripPool.totalWeight * stripPool.avgCostPerKg;

  const newAvgCostPerKg = newTotalWeight > 0
    ? (poolValueBefore + log.consumedCostPEN) / newTotalWeight
    : frozenStripCostPerKg;

  const ptValueBefore = ptStock.totalQuantity * ptStock.lastCostPerPiece;
  const newQuantity = ptStock.totalQuantity - log.piecesProduced;
  const newValue = ptValueBefore - log.consumedCostPEN;

  const newLastCostPerPiece = newQuantity > 0 ? newValue / newQuantity : 0;

  return {
    strip: {
      newTotalWeight: Number(newTotalWeight.toFixed(6)),
      newTotalStrips,
      newAvgCostPerKg: Number(newAvgCostPerKg.toFixed(6)),
    },
    pt: {
      newQuantity,
      newLastCostPerPiece: Number(newLastCostPerPiece.toFixed(6)),
    },
    frozenStripCostPerKg,
  };
}

export function calcRevertProductionFromCoil(input: {
  coil: { initialWeight: number; masterWidth?: number; currentWeight: number };
  ptStock: { totalQuantity: number; lastCostPerPiece: number };
  log: { piecesProduced: number; stripCost: number; totalUsedWidth: number };
}): {
  coilRestoredWeightKg: number;
  coilNewWeight: number;
  pt: { newQuantity: number; newLastCostPerPiece: number };
  approximateWeight: boolean;
  negativeStockWarning: boolean;
} {
  const { coil, ptStock, log } = input;

  if (!coil.masterWidth || coil.masterWidth <= 0) {
    throw new Error('masterWidth es invalido o ausente');
  }

  const restoredWeight = log.totalUsedWidth * (coil.initialWeight / coil.masterWidth);
  const coilNewWeight = Math.min(coil.initialWeight, coil.currentWeight + restoredWeight);

  const newQuantity = ptStock.totalQuantity - log.piecesProduced;
  let newLastCostPerPiece = ptStock.lastCostPerPiece;
  let negativeStockWarning = false;

  if (newQuantity > 0) {
    const ptValueBefore = ptStock.totalQuantity * ptStock.lastCostPerPiece;
    const newValue = ptValueBefore - log.stripCost;
    newLastCostPerPiece = newValue / newQuantity;
  } else {
    negativeStockWarning = true;
  }

  return {
    coilRestoredWeightKg: Number(restoredWeight.toFixed(6)),
    coilNewWeight: Number(coilNewWeight.toFixed(6)),
    pt: {
      newQuantity,
      newLastCostPerPiece: Number(newLastCostPerPiece.toFixed(6)),
    },
    approximateWeight: true,
    negativeStockWarning,
  };
}
