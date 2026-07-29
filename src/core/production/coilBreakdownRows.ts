export type BreakdownRow = {
  coilId: string;
  piezas: number | null;
  longitudM: number | null;
  ml: number;
  kg: number;
  costo: number;
};

export type BreakdownTotals = {
  ml: number;
  kg: number;
  costo: number;
  piezas: number | null;
};

export function buildCoilBreakdownRows(perCoilBreakdown: any[] | undefined): { rows: BreakdownRow[]; totals: BreakdownTotals } {
  if (!perCoilBreakdown || !Array.isArray(perCoilBreakdown) || perCoilBreakdown.length === 0) {
    return {
      rows: [],
      totals: { ml: 0, kg: 0, costo: 0, piezas: null }
    };
  }

  const rows: BreakdownRow[] = perCoilBreakdown.map(b => ({
    coilId: b.coilId,
    piezas: typeof b.piecesCount === 'number' ? b.piecesCount : null,
    longitudM: typeof b.pieceLengthM === 'number' ? b.pieceLengthM : null,
    ml: b.mlFromCoil || 0,
    kg: b.weightConsumedKg || 0,
    costo: b.costPEN || 0,
  }));

  const totals = rows.reduce((acc, r) => {
    acc.ml += r.ml;
    acc.kg += r.kg;
    acc.costo += r.costo;
    if (r.piezas !== null) {
      acc.piezas = (acc.piezas || 0) + r.piezas;
    }
    return acc;
  }, { ml: 0, kg: 0, costo: 0, piezas: null as number | null });

  return { rows, totals };
}
