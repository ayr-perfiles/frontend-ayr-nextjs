import { describe, it, expect } from "vitest";
import { buildCoilBreakdownRows } from "./coilBreakdownRows";

describe("buildCoilBreakdownRows", () => {
  it("1. Cobertura multi-bobina", () => {
    const input = [
      { coilId: 'A', mlFromCoil: 48, weightConsumedKg: 229.38, costPEN: 659.7854, piecesCount: 12, pieceLengthM: 4 },
      { coilId: 'B', mlFromCoil: 552, weightConsumedKg: 1508.5056, costPEN: 4339.0444, piecesCount: 138, pieceLengthM: 4 }
    ];
    const { rows, totals } = buildCoilBreakdownRows(input);
    
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ coilId: 'A', piezas: 12, longitudM: 4, ml: 48, kg: 229.38, costo: 659.7854 });
    expect(rows[1]).toMatchObject({ coilId: 'B', piezas: 138, longitudM: 4, ml: 552, kg: 1508.5056, costo: 4339.0444 });
    
    expect(totals.ml).toBe(600);
    expect(totals.piezas).toBe(150);
    expect(totals.kg).toBeCloseTo(1737.8856, 4);
    expect(totals.costo).toBeCloseTo(4998.8298, 4); // 659.7854 + 4339.0444 = 4998.8298
  });

  it("2. Plancha-like (sin piecesCount/pieceLengthM)", () => {
    const input = [
      { coilId: 'C', mlFromCoil: 0, weightConsumedKg: 100, costPEN: 300 }
    ];
    const { rows, totals } = buildCoilBreakdownRows(input);
    
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ coilId: 'C', piezas: null, longitudM: null, ml: 0, kg: 100, costo: 300 });
    
    expect(totals.piezas).toBeNull();
    expect(totals.ml).toBe(0);
    expect(totals.kg).toBe(100);
    expect(totals.costo).toBe(300);
  });

  it("3. perCoilBreakdown vacio/undefined", () => {
    const res1 = buildCoilBreakdownRows([]);
    expect(res1.rows).toEqual([]);
    expect(res1.totals).toEqual({ ml: 0, kg: 0, costo: 0, piezas: null });

    const res2 = buildCoilBreakdownRows(undefined);
    expect(res2.rows).toEqual([]);
    expect(res2.totals).toEqual({ ml: 0, kg: 0, costo: 0, piezas: null });
  });
});
