import type { CoverageWeightSnapshot } from '@/types';
import type { AluzincReportResult } from './aluzincSalesReport';

// ─── Input types ──────────────────────────────────────────────────────────────

export interface AluzincCostSaleInput {
  saleId: string;
  currency: 'PEN' | 'USD';
  exchangeRate: number | null;
  items: AluzincCostItemInput[];
}

export interface AluzincCostItemInput {
  sku: string;
  quantity: number;
  /** WAC unitario congelado al agregar al carrito (SaleItem.baseCost, en PEN siempre). */
  baseCost: number;
  weightSnapshot: CoverageWeightSnapshot | null | undefined;
}

// ─── Output types — tabla COSTO ────────────────────────────────────────────────

export interface AluzincCostRow {
  label: string;
  thicknessMm: number;
  colorFinish: string;
  metrosTotales: number;
  pesoKg: number;
  toneladas: number;
  costoTotal: number;
  costoPorKg: number;
}

export interface AluzincCostTotals {
  pesoKg: number;
  toneladas: number;
  metrosTotales: number;
  costoTotal: number;
}

export interface AluzincCostResult {
  rows: AluzincCostRow[];
  totals: AluzincCostTotals;
  /** IDs de ventas USD sin exchangeRate excluidas (igual que P-M3). */
  excludedSaleIds: string[];
}

// ─── Output types — tabla RESUMEN ─────────────────────────────────────────────

export interface AluzincProfitRow {
  colorFinish: string;
  ventaSoles: number;
  costoSoles: number;
  gananciaSoles: number;
  margenPct: number;
}

export interface AluzincProfitSummary {
  rows: AluzincProfitRow[];
  /**
   * Merma (scrapLogs) no se puede atribuir a un color: aparece aquí para el total.
   * gananciaSoles = ventaSoles − costoSoles − mermaSoles
   */
  totals: {
    ventaSoles: number;
    costoSoles: number;
    mermaSoles: number;
    gananciaSoles: number;
  };
}

// ─── Agregador: tabla COSTO ───────────────────────────────────────────────────

/**
 * Agrupa el COSTO (baseCost × quantity) de coberturas aluzinc vendidas
 * por (thicknessMm, colorFinish). Misma regla de exclusión que P-M3:
 * ventas USD sin exchangeRate se descartan íntegramente.
 *
 * baseCost es siempre PEN (WAC del stock al momento del carrito); no
 * necesita conversión de moneda.
 */
export function buildAluzincCostReport(
  sales: AluzincCostSaleInput[],
): AluzincCostResult {
  const grouped = new Map<
    string,
    {
      thicknessMm: number;
      colorFinish: string;
      pesoKg: number;
      metrosTotales: number;
      costoTotal: number;
    }
  >();
  const excludedSet = new Set<string>();

  for (const sale of sales) {
    const isUSD = sale.currency === 'USD';
    if (isUSD && (sale.exchangeRate == null || sale.exchangeRate <= 0)) {
      excludedSet.add(sale.saleId);
      continue;
    }

    for (const item of sale.items) {
      const snap = item.weightSnapshot;
      if (!snap) continue;

      const key = `${snap.thicknessMm}_${snap.colorFinish}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          thicknessMm: snap.thicknessMm,
          colorFinish: snap.colorFinish,
          pesoKg: 0,
          metrosTotales: 0,
          costoTotal: 0,
        });
      }
      const entry = grouped.get(key)!;
      entry.pesoKg += snap.pesoKg;
      entry.metrosTotales += snap.metrosTotales;
      entry.costoTotal += item.baseCost * item.quantity;
    }
  }

  const rows: AluzincCostRow[] = Array.from(grouped.values())
    .map((e) => ({
      label: `${e.thicknessMm}mm ${e.colorFinish || 'NATURAL'}`,
      thicknessMm: e.thicknessMm,
      colorFinish: e.colorFinish,
      metrosTotales: e.metrosTotales,
      pesoKg: e.pesoKg,
      toneladas: e.pesoKg / 1000,
      costoTotal: Number(e.costoTotal.toFixed(2)),
      costoPorKg: e.pesoKg > 0 ? Number((e.costoTotal / e.pesoKg).toFixed(4)) : 0,
    }))
    .sort((a, b) => b.costoTotal - a.costoTotal);

  const totals: AluzincCostTotals = rows.reduce(
    (acc, row) => ({
      pesoKg: acc.pesoKg + row.pesoKg,
      toneladas: acc.toneladas + row.toneladas,
      metrosTotales: acc.metrosTotales + row.metrosTotales,
      costoTotal: acc.costoTotal + row.costoTotal,
    }),
    { pesoKg: 0, toneladas: 0, metrosTotales: 0, costoTotal: 0 },
  );

  return { rows, totals, excludedSaleIds: Array.from(excludedSet) };
}

// ─── Agregador: tabla RESUMEN ─────────────────────────────────────────────────

/**
 * Combina las tablas de Ventas (P-M3) y Costo (P-M7) más la merma del periodo.
 *
 * Agrupación: por colorFinish (acumula todos los espesores).
 * La merma no se puede atribuir a un color específico: aparece únicamente
 * en `totals.mermaSoles`. La ganancia del total = Venta − Costo − Merma.
 */
export function buildAluzincProfitSummary(
  ventasResult: AluzincReportResult,
  costoResult: AluzincCostResult,
  totalMermaSoles: number,
): AluzincProfitSummary {
  const colorMap = new Map<string, { ventaSoles: number; costoSoles: number }>();

  for (const row of ventasResult.rows) {
    const key = row.colorFinish;
    const e = colorMap.get(key) ?? { ventaSoles: 0, costoSoles: 0 };
    e.ventaSoles += row.montoSoles;
    colorMap.set(key, e);
  }

  for (const row of costoResult.rows) {
    const key = row.colorFinish;
    const e = colorMap.get(key) ?? { ventaSoles: 0, costoSoles: 0 };
    e.costoSoles += row.costoTotal;
    colorMap.set(key, e);
  }

  const rows: AluzincProfitRow[] = Array.from(colorMap.entries())
    .map(([colorFinish, data]) => {
      const ganancia = data.ventaSoles - data.costoSoles;
      return {
        colorFinish: colorFinish || 'NATURAL',
        ventaSoles: Number(data.ventaSoles.toFixed(2)),
        costoSoles: Number(data.costoSoles.toFixed(2)),
        gananciaSoles: Number(ganancia.toFixed(2)),
        margenPct:
          data.ventaSoles > 0
            ? Number(((ganancia / data.ventaSoles) * 100).toFixed(2))
            : 0,
      };
    })
    .sort((a, b) => b.ventaSoles - a.ventaSoles);

  const totalVenta = rows.reduce((acc, r) => acc + r.ventaSoles, 0);
  const totalCosto = rows.reduce((acc, r) => acc + r.costoSoles, 0);
  const merma = Number(totalMermaSoles.toFixed(2));
  const gananciaOperativa = Number((totalVenta - totalCosto - merma).toFixed(2));

  return {
    rows,
    totals: {
      ventaSoles: Number(totalVenta.toFixed(2)),
      costoSoles: Number(totalCosto.toFixed(2)),
      mermaSoles: merma,
      gananciaSoles: gananciaOperativa,
    },
  };
}
