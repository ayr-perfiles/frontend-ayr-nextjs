export interface AluzincResumenSaleItem {
  sku: string;
  businessLine?: string;
  quantity: number;
  unitValue: number;
  baseCost?: number;
  weightSnapshot?: {
    colorFinish?: string;
    thicknessMm?: number;
    pesoKg?: number;
    metrosTotales?: number;
  } | null;
}

export interface AluzincResumenSale {
  id?: string;
  status?: string;
  timestamp?: any;
  items?: AluzincResumenSaleItem[];
  metadata?: {
    currency?: string;
    exchangeRate?: number;
  };
  currency?: string;
  exchangeRateApplied?: number;
}

export interface AluzincResumenScrap {
  status?: string;
  scrapCostPEN?: number;
  timestamp?: any;
}

export interface AluzincResumenRow {
  colorFinish: string;
  ventaSoles: number;
  costoSoles: number;
  gananciaSoles: number;
  margenPct: number;
}

export interface AluzincResumenResult {
  rows: AluzincResumenRow[];
  totals: {
    ventaSoles: number;
    costoSoles: number;
    mermaSoles: number;
    gananciaSoles: number;
  };
}

export interface AluzincResumenInput {
  sales: AluzincResumenSale[];
  scraps: AluzincResumenScrap[];
  metallicCatalog?: Record<string, { finish?: string }>;
  finishesMap?: Record<string, { tipo?: string; color?: string; label?: string }>;
  range?: { from?: number; to?: number };
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

export function calculateAluzincResumen(input: AluzincResumenInput): AluzincResumenResult {
  const { sales, scraps, metallicCatalog = {}, finishesMap = {}, range } = input;

  const isWithinRange = (tsObj: any): boolean => {
    if (!range) return true;
    const ms = getMillis(tsObj);
    if (ms === null) return true;
    if (range.from !== undefined && ms < range.from) return false;
    if (range.to !== undefined && ms > range.to) return false;
    return true;
  };

  const resolveColor = (item: AluzincResumenSaleItem): string => {
    if (item.weightSnapshot?.colorFinish) {
      return item.weightSnapshot.colorFinish;
    }
    const cat = metallicCatalog[item.sku];
    if (cat?.finish && finishesMap[cat.finish]) {
      const c = finishesMap[cat.finish].color;
      if (c && c !== '-') return c;
      return finishesMap[cat.finish].label || 'Natural';
    }
    if (item.sku.includes('ROJO') || item.sku.includes('RJ')) return 'Rojo';
    if (item.sku.includes('AZUL') || item.sku.includes('AZ')) return 'Azul';
    if (item.sku.includes('VERD') || item.sku.includes('VD')) return 'Verde';
    if (item.sku.includes('BLANCO') || item.sku.includes('BL')) return 'Blanco';
    if (item.sku.includes('GRIS') || item.sku.includes('GR')) return 'Gris';
    return 'Natural';
  };

  const colorMap = new Map<string, { ventaSoles: number; costoSoles: number }>();

  for (const sale of sales) {
    if (sale.status && sale.status !== 'COMPLETED') continue;
    if (!isWithinRange(sale.timestamp)) continue;

    const isUSD = sale.currency === 'USD' || sale.metadata?.currency === 'USD';
    const rateMultiplier = isUSD ? (sale.exchangeRateApplied || sale.metadata?.exchangeRate || 1) : 1;

    for (const item of (sale.items ?? [])) {
      if (item.businessLine !== 'metallic-roofing') continue;

      const color = resolveColor(item);
      const venta = (item.unitValue || 0) * (item.quantity || 0) * rateMultiplier;
      const costo = (item.baseCost ?? 0) * (item.quantity || 0);

      if (!colorMap.has(color)) {
        colorMap.set(color, { ventaSoles: 0, costoSoles: 0 });
      }
      const entry = colorMap.get(color)!;
      entry.ventaSoles += venta;
      entry.costoSoles += costo;
    }
  }

  let totalMermaSoles = 0;
  for (const scrap of scraps) {
    if (scrap.status === 'VOIDED') continue;
    if (!isWithinRange(scrap.timestamp)) continue;
    totalMermaSoles += (scrap.scrapCostPEN || 0);
  }

  const rows: AluzincResumenRow[] = Array.from(colorMap.entries()).map(([colorFinish, data]) => {
    const venta = Number(data.ventaSoles.toFixed(2));
    const costo = Number(data.costoSoles.toFixed(2));
    const ganancia = Number((venta - costo).toFixed(2));
    const margen = venta > 0 ? Number(((ganancia / venta) * 100).toFixed(1)) : 0;
    return {
      colorFinish,
      ventaSoles: venta,
      costoSoles: costo,
      gananciaSoles: ganancia,
      margenPct: margen,
    };
  }).sort((a, b) => b.ventaSoles - a.ventaSoles);

  const totalVenta = Number(rows.reduce((acc, r) => acc + r.ventaSoles, 0).toFixed(2));
  const totalCosto = Number(rows.reduce((acc, r) => acc + r.costoSoles, 0).toFixed(2));
  const merma = Number(totalMermaSoles.toFixed(2));
  const gananciaOperativa = Number((totalVenta - totalCosto - merma).toFixed(2));

  return {
    rows,
    totals: {
      ventaSoles: totalVenta,
      costoSoles: totalCosto,
      mermaSoles: merma,
      gananciaSoles: gananciaOperativa,
    },
  };
}
