export function getProductionUnitAndValue(
  log: { sku: string; piecesProduced: number; mlProduced?: number },
  skuToFamily?: Record<string, string>
): { value: number | null; unitLabel: string } {
  const family = skuToFamily?.[log.sku];
  if (family === "COBERTURA") {
    return { value: log.mlProduced ?? null, unitLabel: "ML" };
  } else if (family === "PLANCHA") {
    return { value: log.piecesProduced, unitLabel: "piezas" };
  }
  // Default legacy fallback if product not loaded or family unknown
  return { value: log.piecesProduced, unitLabel: "piezas" };
}
