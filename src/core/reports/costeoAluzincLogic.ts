export interface ProductionLogInput {
  status?: string;
  timestamp?: any;
  perCoilBreakdown?: {
    coilId: string;
    weightConsumedKg: number;
    costPEN: number;
  }[];
}

export interface SaleInput {
  status?: string;
  timestamp?: any;
  items?: {
    sku: string;
    unitValue: number;
    unitWeight: number;
    quantity: number;
  }[];
}

export interface ScrapLogInput {
  status?: string;
  timestamp?: any;
  coilId?: string;
  scrapWeightKg: number;
}

export interface CoilInput {
  id: string;
  finish?: string;
}

export interface CosteoAluzincRow {
  tipo: 'Natural' | 'Prepintado';
  pesoProduccionKg: number;
  costoPEN: number;
  costoPorKg: number;
  ventaPEN: number;
  ventaKg: number;
  mermaKg: number;
}

export function calculateCosteoAluzinc(input: {
  productionLogs: ProductionLogInput[];
  sales: SaleInput[];
  scrapLogs: ScrapLogInput[];
  coils: CoilInput[];
  metallicCatalog: Record<string, { finish?: string }>;
  finishesMap: Record<string, { tipo?: string; color?: string }>;
  range?: { from?: number; to?: number };
}): CosteoAluzincRow[] {
  const { productionLogs, sales, scrapLogs, coils, metallicCatalog, finishesMap, range } = input;

  const result: Record<'Natural' | 'Prepintado', CosteoAluzincRow> = {
    Natural: { tipo: 'Natural', pesoProduccionKg: 0, costoPEN: 0, costoPorKg: 0, ventaPEN: 0, ventaKg: 0, mermaKg: 0 },
    Prepintado: { tipo: 'Prepintado', pesoProduccionKg: 0, costoPEN: 0, costoPorKg: 0, ventaPEN: 0, ventaKg: 0, mermaKg: 0 }
  };

  const coilsMap = new Map<string, CoilInput>();
  for (const c of coils) {
    if (c.id) coilsMap.set(c.id, c);
  }

  const getMillis = (tsObj: any): number | null => {
    if (!tsObj) return null;
    if (typeof tsObj.toMillis === 'function') return tsObj.toMillis();
    if (typeof tsObj === 'number') return tsObj;
    if (typeof tsObj.seconds === 'number') return tsObj.seconds * 1000;
    if (typeof tsObj._seconds === 'number') return tsObj._seconds * 1000;
    if (tsObj instanceof Date) return tsObj.getTime();
    return null;
  };

  const isWithinRange = (tsObj: any): boolean => {
    if (!range) return true;
    const ms = getMillis(tsObj);
    if (ms === null) return true;
    if (range.from !== undefined && ms < range.from) return false;
    if (range.to !== undefined && ms > range.to) return false;
    return true;
  };

  const getTipoForCoil = (coilId: string): 'Natural' | 'Prepintado' | null => {
    const coil = coilsMap.get(coilId);
    if (!coil || !coil.finish) return null;
    const finishMeta = finishesMap[coil.finish];
    if (!finishMeta) return null;
    const tipo = finishMeta.tipo;
    if (tipo === 'Natural' || tipo === 'Prepintado') return tipo;
    return null;
  };

  const getTipoForSku = (sku: string): 'Natural' | 'Prepintado' | null => {
    const catalogItem = metallicCatalog[sku];
    if (!catalogItem || !catalogItem.finish) return null;
    const finishMeta = finishesMap[catalogItem.finish];
    if (!finishMeta) return null;
    const tipo = finishMeta.tipo;
    if (tipo === 'Natural' || tipo === 'Prepintado') return tipo;
    return null;
  };

  // 1. Producción
  for (const log of productionLogs) {
    if (log.status === 'VOIDED') continue;
    if (!isWithinRange(log.timestamp)) continue;
    
    if (log.perCoilBreakdown && Array.isArray(log.perCoilBreakdown)) {
      for (const breakdown of log.perCoilBreakdown) {
        if (!breakdown.coilId) continue;
        const tipo = getTipoForCoil(breakdown.coilId);
        if (tipo) {
          result[tipo].pesoProduccionKg += (breakdown.weightConsumedKg || 0);
          result[tipo].costoPEN += (breakdown.costPEN || 0);
        }
      }
    }
  }

  // 2. Ventas
  for (const sale of sales) {
    if (sale.status !== 'COMPLETED') continue;
    if (!isWithinRange(sale.timestamp)) continue;
    
    if (sale.items && Array.isArray(sale.items)) {
      for (const item of sale.items) {
        if (!item.sku) continue;
        const tipo = getTipoForSku(item.sku);
        if (tipo) {
          const quantity = item.quantity || 0;
          const unitValue = item.unitValue || 0;
          const unitWeight = item.unitWeight || 0;
          
          result[tipo].ventaPEN += (unitValue * quantity);
          result[tipo].ventaKg += (unitWeight * quantity);
        }
      }
    }
  }

  // 3. Merma
  for (const scrap of scrapLogs) {
    if (scrap.status === 'VOIDED') continue;
    if (!isWithinRange(scrap.timestamp)) continue;
    if (!scrap.coilId) continue;
    
    const tipo = getTipoForCoil(scrap.coilId);
    if (tipo) {
      result[tipo].mermaKg += (scrap.scrapWeightKg || 0);
    }
  }

  // Calculo final
  const finalRows = [result.Natural, result.Prepintado];
  for (const row of finalRows) {
    if (row.pesoProduccionKg > 0) {
      row.costoPorKg = row.costoPEN / row.pesoProduccionKg;
    } else {
      row.costoPorKg = 0;
    }
  }

  return finalRows;
}
