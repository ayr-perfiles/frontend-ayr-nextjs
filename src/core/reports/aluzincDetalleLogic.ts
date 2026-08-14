import type { ProductionLog } from '@/types';
import type { CanonicalSaleDoc, CanonicalSaleItem } from '@/core/sales/domain/saleDocBuilder';
import type { MetallicProduct } from '@/modules/metallic-roofing/types';
import { parseCoverageMetadata } from '@/modules/metallic-roofing/domain/coverageMetadataParser';

export type AluzincProductRead = MetallicProduct;

export type AluzincSaleItemRead = Pick<CanonicalSaleItem, 'sku' | 'quantity' | 'unitValue' | 'profit' | 'baseCost' | 'businessLine'> & {
  costSource?: string;
};

export type AluzincSaleRead = Pick<CanonicalSaleDoc, 'status' | 'customerDocument'> & {
  documentNumber?: string;
  customerName?: string;
  relatedQuotationId?: string;
  isFulfilled?: boolean;
  items?: AluzincSaleItemRead[];
};

export interface AluzincVentaDetalle {
  documentNumber: string;
  customerName: string;
  sku: string;
  quantity: number;
  unitValue: number;
  ventaTotal: number;
  cUnit: number;
  costoTotal: number;
  costSource: string;
  cotizacion: string;
}

export interface AluzincLogDetalle {
  documentId: string;
  sku: string;
  color: string;
  mlProduced: number;
  consumoKg: number;
  costoProdPEN: number;
}

export interface AluzincDetalleGroup {
  key: string;
  color: string;
  thicknessMm: string;
  clientes: Set<string>;
  montoVentas: number;
  profitVentas: number;
  nVentas: number;
  costoNoProduccion: number;
  ventasSinCosto: Set<AluzincSaleRead>;
  ventasDetalle: AluzincVentaDetalle[];
  logsDetalle: AluzincLogDetalle[];
  mlProduced: number;
  piezas: number;
  nLogs: number;
  consumidoKg: number;
  teoricoKg: number;
  warnings: string[];
  calibreImplicito: number;
  desvioKg: number;
  desvioPct: number;
  denominadorCalibre: number;
  thicknessesReales: Set<string>;
}

export interface AluzincDetalleObservations {
  rendimientoGlobalPct: number;
  mayorDesvioGrupo: { name: string; kg: number; pct: number } | null;
  gruposFueraDeCalibre: string[];
  ventasSinCostoProduccion: number;
}

export interface AluzincDetalleResult {
  grupos: AluzincDetalleGroup[];
}

export function buildAluzincDetalle(
  sales: AluzincSaleRead[],
  quotes: Map<string, AluzincSaleRead>,
  logsMap: Map<string, ProductionLog[]>,
  products: Map<string, AluzincProductRead>,
  period: string,
  groupBy: 'COLOR_ESPESOR' | 'COLOR' = 'COLOR_ESPESOR'
): AluzincDetalleResult {
  const gruposMap = new Map<string, AluzincDetalleGroup>();

  const getGroup = (sku: string): AluzincDetalleGroup => {
    const parsed = parseCoverageMetadata(sku, '');
    let thicknessStr = 'ESPESOR-DESCONOCIDO';
    if (parsed.thicknessMm !== null) {
      thicknessStr = parsed.thicknessMm.toFixed(2);
    }
    const colorStr = parsed.colorFinish || 'NATURAL';
    const finalThicknessStr = groupBy === 'COLOR' ? 'VARIOS' : thicknessStr;
    const key = groupBy === 'COLOR' ? `${colorStr}|VARIOS` : `${colorStr}|${thicknessStr}`;

    if (!gruposMap.has(key)) {
      gruposMap.set(key, {
        key,
        color: colorStr,
        thicknessMm: finalThicknessStr,
        clientes: new Set<string>(),
        montoVentas: 0,
        profitVentas: 0,
        nVentas: 0,
        costoNoProduccion: 0,
        ventasSinCosto: new Set<AluzincSaleRead>(),
        ventasDetalle: [],
        logsDetalle: [],
        mlProduced: 0,
        piezas: 0,
        nLogs: 0,
        consumidoKg: 0,
        teoricoKg: 0,
        warnings: [],
        calibreImplicito: 0,
        desvioKg: 0,
        desvioPct: 0,
        denominadorCalibre: 0,
        thicknessesReales: new Set<string>(),
      });
    }
    const group = gruposMap.get(key)!;
    group.thicknessesReales.add(thicknessStr);
    return group;
  };

  const processedQuotes = new Set<string>();

  for (const sale of sales) {
    if (sale.status !== 'COMPLETED') continue;

    const quoteId = sale.relatedQuotationId;
    if (!quoteId) continue;

    const quote = quotes.get(quoteId);
    if (!quote || quote.isFulfilled !== true) continue;

    const saleGroups = new Set<string>();
    const docName = sale.customerDocument || 'N/A';

    for (const item of sale.items || []) {
      if (item.businessLine !== 'metallic-roofing') continue;
      if (!item.sku) continue;
      const g = getGroup(item.sku);
      saleGroups.add(g.key);

      const isProduction = item.costSource === 'PRODUCTION';
      if (!isProduction) {
        g.costoNoProduccion += 1;
        g.ventasSinCosto.add(sale);
      }

      let itemSaleAmount = (item.unitValue || 0) * (item.quantity || 0);
      if (itemSaleAmount === 0) {
        itemSaleAmount = (item.baseCost || 0) * (item.quantity || 0) + (item.profit || 0);
      }
      g.montoVentas += itemSaleAmount;
      g.profitVentas += item.profit || 0;

      g.ventasDetalle.push({
        documentNumber: sale.documentNumber || 'N/A',
        customerName: sale.customerName || sale.customerDocument || 'N/A',
        sku: item.sku,
        quantity: item.quantity || 0,
        unitValue: item.unitValue || 0,
        ventaTotal: itemSaleAmount,
        cUnit: item.baseCost || 0,
        costoTotal: (item.baseCost || 0) * (item.quantity || 0),
        costSource: item.costSource || 'N/A',
        cotizacion: sale.relatedQuotationId || 'N/A'
      });

      if (sale.customerDocument) g.clientes.add(sale.customerDocument);
    }

    for (const key of saleGroups) {
      gruposMap.get(key)!.nVentas += 1;
    }

    if (!processedQuotes.has(quoteId)) {
      processedQuotes.add(quoteId);
      const logs = logsMap.get(quoteId) || [];

      for (const log of logs) {
        if (!log.sku) continue;
        const g = getGroup(log.sku);
        g.nLogs += 1;
        g.mlProduced += log.mlProduced || 0;
        g.piezas += log.piecesProduced || 0;

        let consumidoLog = 0;
        let costoProdPENLog = 0;
        if (log.perCoilBreakdown) {
          for (const b of log.perCoilBreakdown) {
            consumidoLog += b.weightConsumedKg || 0;
            costoProdPENLog += b.costPEN || 0;
          }
        }
        g.consumidoKg += consumidoLog;

        g.logsDetalle.push({
          documentId: log.id || quoteId,
          sku: log.sku,
          color: g.color,
          mlProduced: log.mlProduced || 0,
          consumoKg: consumidoLog,
          costoProdPEN: costoProdPENLog
        });

          const product = products.get(log.sku);
        if (!product || !product.thickness || !product.widthMm || !product.densityFactor) {
          if (!g.warnings.includes(`producto sin dims nominales: ${log.sku}`)) {
            g.warnings.push(`producto sin dims nominales: ${log.sku}`);
          }
        } else {
          const teorico = (log.mlProduced || 0) * product.thickness * product.widthMm * product.densityFactor;
          g.teoricoKg += teorico;
          g.denominadorCalibre += (log.mlProduced || 0) * product.widthMm * product.densityFactor;
        }
      }
    }
  }

  const grupos = Array.from(gruposMap.values());
  for (const g of grupos) {
    if (groupBy === 'COLOR') {
      if (g.thicknessesReales.size === 1) {
        g.thicknessMm = Array.from(g.thicknessesReales)[0];
        g.key = `${g.color}|${g.thicknessMm}`;
      } else if (g.thicknessesReales.size >= 2) {
        g.thicknessMm = 'VARIOS';
      } else {
        g.thicknessMm = 'ESPESOR-DESCONOCIDO';
      }
    }

    if (g.warnings.length > 0) {
      g.teoricoKg = 0;
      g.desvioKg = 0;
      g.desvioPct = 0;
      g.calibreImplicito = 0;
    } else {
      if (g.teoricoKg > 0) {
        g.desvioKg = g.consumidoKg - g.teoricoKg;
        g.desvioPct = g.desvioKg / g.teoricoKg;
      }
      if (g.mlProduced > 0 && g.consumidoKg > 0) {
        if (groupBy === 'COLOR') {
          if (g.denominadorCalibre > 0) {
            g.calibreImplicito = g.consumidoKg / g.denominadorCalibre;
          }
        } else {
          if (g.teoricoKg > 0 && g.thicknessMm !== 'ESPESOR-DESCONOCIDO') {
            g.calibreImplicito = (g.consumidoKg / g.teoricoKg) * parseFloat(g.thicknessMm);
          }
        }
      }
    }
  }

  return { grupos };
}

export function deriveObservations(grupos: AluzincDetalleGroup[]): AluzincDetalleObservations {
  let totalConsumido = 0;
  let totalTeorico = 0;
  const ventasSinCostoSet = new Set<AluzincSaleRead>();

  let mayorDesvio: { name: string; kg: number; pct: number } | null = null;
  const gruposFueraDeCalibre: string[] = [];

  for (const g of grupos) {
    if (g.teoricoKg > 0) {
      totalConsumido += g.consumidoKg;
      totalTeorico += g.teoricoKg;
    }
    
    if (g.ventasSinCosto) {
      g.ventasSinCosto.forEach(s => ventasSinCostoSet.add(s));
    }

    if (g.teoricoKg > 0) {
      if (!mayorDesvio || Math.abs(g.desvioPct) > Math.abs(mayorDesvio.pct)) {
        mayorDesvio = {
          name: g.key,
          kg: g.desvioKg,
          pct: g.desvioPct,
        };
      }
    }

    if (g.thicknessMm !== 'ESPESOR-DESCONOCIDO' && g.thicknessMm !== 'VARIOS' && g.calibreImplicito > 0) {
      const nominal = parseFloat(g.thicknessMm);
      if (Math.abs(g.calibreImplicito - nominal) > 0.020001) {
        gruposFueraDeCalibre.push(g.key);
      }
    }
  }

  let rendimientoGlobalPct = 0;
  if (totalTeorico > 0) {
    rendimientoGlobalPct = (totalConsumido - totalTeorico) / totalTeorico;
  }

  return {
    rendimientoGlobalPct,
    mayorDesvioGrupo: mayorDesvio,
    gruposFueraDeCalibre,
    ventasSinCostoProduccion: ventasSinCostoSet.size,
  };
}
