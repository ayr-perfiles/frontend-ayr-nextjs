import type { CoverageWeightSnapshot } from '@/types';

// ─── Input types (desacoplado de Firestore) ───────────────────────────────────

export interface AluzincSaleInput {
  saleId: string;
  currency: 'PEN' | 'USD';
  exchangeRate: number | null;
  items: AluzincSaleItemInput[];
}

export interface AluzincSaleItemInput {
  sku: string;
  quantity: number;
  unitValue: number;
  weightSnapshot: CoverageWeightSnapshot | null | undefined;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface AluzincReportRow {
  /** Etiqueta compuesta usada como xKey en el gráfico */
  label: string;
  thicknessMm: number;
  colorFinish: string;
  metrosTotales: number;
  pesoKg: number;
  toneladas: number;
  montoSoles: number;
  precioPorKg: number;
}

export interface AluzincReportTotals {
  pesoKg: number;
  toneladas: number;
  metrosTotales: number;
  montoSoles: number;
}

export interface AluzincReportResult {
  rows: AluzincReportRow[];
  totals: AluzincReportTotals;
  /** IDs de ventas USD sin exchangeRate: excluidas íntegramente (peso + monto). */
  excludedSaleIds: string[];
}

// ─── Agregador puro ───────────────────────────────────────────────────────────

/**
 * Agrupa ventas de cobertura aluzinc por (thicknessMm, colorFinish).
 * Ventas USD sin exchangeRate se excluyen íntegramente (peso + monto).
 * Ventas USD con exchangeRate se convierten a PEN.
 * Items sin weightSnapshot se omiten.
 */
export function buildAluzincSalesReport(sales: AluzincSaleInput[]): AluzincReportResult {
  const grouped = new Map<
    string,
    {
      thicknessMm: number;
      colorFinish: string;
      pesoKg: number;
      metrosTotales: number;
      montoSoles: number;
    }
  >();
  const excludedSet = new Set<string>();

  for (const sale of sales) {
    const isUSD = sale.currency === 'USD';
    if (isUSD && (sale.exchangeRate == null || sale.exchangeRate <= 0)) {
      excludedSet.add(sale.saleId);
      continue;
    }
    const rateMultiplier = isUSD ? sale.exchangeRate! : 1;

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
          montoSoles: 0,
        });
      }
      const entry = grouped.get(key)!;
      entry.pesoKg += snap.pesoKg;
      entry.metrosTotales += snap.metrosTotales;
      entry.montoSoles += item.quantity * (item.unitValue || 0) * rateMultiplier;
    }
  }

  const rows: AluzincReportRow[] = Array.from(grouped.values())
    .map((e) => ({
      label: `${e.thicknessMm}mm ${e.colorFinish || 'NATURAL'}`,
      thicknessMm: e.thicknessMm,
      colorFinish: e.colorFinish,
      metrosTotales: e.metrosTotales,
      pesoKg: e.pesoKg,
      toneladas: e.pesoKg / 1000,
      montoSoles: e.montoSoles,
      precioPorKg: e.pesoKg > 0 ? e.montoSoles / e.pesoKg : 0,
    }))
    .sort((a, b) => b.pesoKg - a.pesoKg);

  const totals: AluzincReportTotals = rows.reduce(
    (acc, row) => ({
      pesoKg: acc.pesoKg + row.pesoKg,
      toneladas: acc.toneladas + row.toneladas,
      metrosTotales: acc.metrosTotales + row.metrosTotales,
      montoSoles: acc.montoSoles + row.montoSoles,
    }),
    { pesoKg: 0, toneladas: 0, metrosTotales: 0, montoSoles: 0 },
  );

  return { rows, totals, excludedSaleIds: Array.from(excludedSet) };
}
