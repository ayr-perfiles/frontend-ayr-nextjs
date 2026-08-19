import type { StockStrategy } from "./types";
import { drywallStockStrategy } from "./drywallStockStrategy";
import { roofingStockStrategy } from "./roofingStockStrategy";
import { metallicRoofingStockStrategy } from "./metallicRoofingStockStrategy";
import { tradingStockStrategy } from "./tradingStockStrategy";
import { servicesStockStrategy } from "./servicesStockStrategy";

export type { StockStrategy, StockWriteParams, ProductionIncrementParams } from "./types";

/**
 * Registry server-side, espejo de `getStockStrategy` en
 * src/core/sales/strategies/index.ts (mismo switch, mismos 5 casos, mismo mensaje
 * de error). Primer consumidor real: functions/src/callables/sales.ts (annulSale).
 */
export function getStockStrategy(businessLine: string): StockStrategy {
  switch (businessLine) {
    case 'drywall':
      return drywallStockStrategy;
    case 'roofing':
      return roofingStockStrategy;
    case 'metallic-roofing':
      return metallicRoofingStockStrategy;
    case 'trading':
      return tradingStockStrategy;
    case 'services':
      return servicesStockStrategy;
    default:
      throw new Error(`Línea de negocio no soportada: ${businessLine}`);
  }
}
