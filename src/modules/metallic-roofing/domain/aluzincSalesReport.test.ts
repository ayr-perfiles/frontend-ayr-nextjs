import { describe, it, expect } from 'vitest';
import { buildAluzincSalesReport, type AluzincSaleInput } from './aluzincSalesReport';
import type { CoverageWeightSnapshot } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function snap(
  thicknessMm: number,
  colorFinish: string,
  pesoKg: number,
  metrosTotales: number,
): CoverageWeightSnapshot {
  return { thicknessMm, colorFinish, pesoKg, metrosTotales, widthMm: 1200, densityFactor: 0.008 };
}

function penSale(
  id: string,
  qty: number,
  unitValue: number,
  s: CoverageWeightSnapshot | null,
): AluzincSaleInput {
  return {
    saleId: id,
    currency: 'PEN',
    exchangeRate: null,
    items: [{ sku: 'COB030ROJO', quantity: qty, unitValue, weightSnapshot: s }],
  };
}

function usdSale(
  id: string,
  qty: number,
  unitValue: number,
  rate: number | null,
  s: CoverageWeightSnapshot | null,
): AluzincSaleInput {
  return {
    saleId: id,
    currency: 'USD',
    exchangeRate: rate,
    items: [{ sku: 'COB030ROJO', quantity: qty, unitValue, weightSnapshot: s }],
  };
}

// ─── Snapshots reutilizables ──────────────────────────────────────────────────

// COB030ROJO: 1ML × 0.30mm × 1200mm × 0.008 = 2.88 kg/ML
const S_030_ROJO = snap(0.30, 'ROJO', 288, 100); // 100ML
const S_030_ROJO_50 = snap(0.30, 'ROJO', 144, 50); // 50ML
// COB040ROJO: 1ML × 0.40mm × 1200mm × 0.008 = 3.84 kg/ML
const S_040_ROJO = snap(0.40, 'ROJO', 384, 100); // 100ML
// COB040NATURAL: 1ML × 0.40mm × 1200mm × 0.00785 = 3.768 kg/ML
const S_040_NATURAL = snap(0.40, '', 376.8, 100); // 100ML
// PLANCHA 0.40mm ROJO, 6m, 1 pieza: 6 × 0.40 × 1200 × 0.008 = 23.04 kg
const S_PLANCHA_040 = snap(0.40, 'ROJO', 23.04, 6); // 1 pieza × 6m

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('buildAluzincSalesReport', () => {
  it('resultado vacío con entrada vacía', () => {
    const result = buildAluzincSalesReport([]);
    expect(result.rows).toHaveLength(0);
    expect(result.totals).toEqual({ pesoKg: 0, toneladas: 0, metrosTotales: 0, montoSoles: 0 });
    expect(result.excludedSaleIds).toHaveLength(0);
  });

  it('venta PEN simple → una fila con valores correctos', () => {
    const result = buildAluzincSalesReport([penSale('s1', 100, 15, S_030_ROJO)]);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.thicknessMm).toBe(0.30);
    expect(row.colorFinish).toBe('ROJO');
    expect(row.pesoKg).toBe(288);
    expect(row.toneladas).toBeCloseTo(0.288, 6);
    expect(row.metrosTotales).toBe(100);
    expect(row.montoSoles).toBe(1500); // 100 × 15
    expect(row.precioPorKg).toBeCloseTo(1500 / 288, 4);
    expect(row.label).toBe('0.3mm ROJO');
  });

  it('dos ventas PEN misma familia → fila acumulada', () => {
    const result = buildAluzincSalesReport([
      penSale('s1', 100, 15, S_030_ROJO),
      penSale('s2', 50, 15, S_030_ROJO_50),
    ]);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.pesoKg).toBe(432);       // 288 + 144
    expect(row.metrosTotales).toBe(150); // 100 + 50
    expect(row.montoSoles).toBe(2250);   // 100×15 + 50×15
  });

  it('dos espesores distintos → dos filas separadas', () => {
    const result = buildAluzincSalesReport([
      penSale('s1', 100, 18, S_040_ROJO),
      penSale('s2', 100, 15, S_030_ROJO),
    ]);
    expect(result.rows).toHaveLength(2);
    // Ordenadas desc por pesoKg
    expect(result.rows[0].thicknessMm).toBe(0.40); // 384 kg
    expect(result.rows[1].thicknessMm).toBe(0.30); // 288 kg
  });

  it('ROJO y NATURAL del mismo espesor → dos filas separadas', () => {
    const result = buildAluzincSalesReport([
      penSale('s1', 100, 18, S_040_ROJO),
      penSale('s2', 100, 14, S_040_NATURAL),
    ]);
    expect(result.rows).toHaveLength(2);
    const keys = result.rows.map((r) => r.colorFinish);
    expect(keys).toContain('ROJO');
    expect(keys).toContain('');
  });

  it('venta USD con exchangeRate → monto convertido a PEN', () => {
    const result = buildAluzincSalesReport([usdSale('s1', 50, 4, 3.80, S_030_ROJO_50)]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].montoSoles).toBeCloseTo(50 * 4 * 3.80, 4); // 760
    expect(result.rows[0].pesoKg).toBe(144);
    expect(result.excludedSaleIds).toHaveLength(0);
  });

  it('venta USD sin exchangeRate → excluida íntegramente (peso + monto)', () => {
    const result = buildAluzincSalesReport([usdSale('s-no-rate', 100, 5, null, S_030_ROJO)]);
    expect(result.rows).toHaveLength(0);
    expect(result.excludedSaleIds).toEqual(['s-no-rate']);
    expect(result.totals.pesoKg).toBe(0);
    expect(result.totals.montoSoles).toBe(0);
  });

  it('venta USD con exchangeRate=0 → también excluida', () => {
    const result = buildAluzincSalesReport([usdSale('s-zero', 100, 5, 0, S_030_ROJO)]);
    expect(result.excludedSaleIds).toContain('s-zero');
    expect(result.rows).toHaveLength(0);
  });

  it('ítem sin weightSnapshot → omitido, no contribuye a ninguna fila', () => {
    const result = buildAluzincSalesReport([
      {
        saleId: 's1',
        currency: 'PEN',
        exchangeRate: null,
        items: [{ sku: 'ACC001', quantity: 5, unitValue: 50, weightSnapshot: null }],
      },
    ]);
    expect(result.rows).toHaveLength(0);
  });

  it('mezcla PEN + USD excluida → solo PEN aparece en resultado', () => {
    const result = buildAluzincSalesReport([
      penSale('s-pen', 100, 15, S_030_ROJO),
      usdSale('s-usd', 100, 5, null, S_030_ROJO),
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].pesoKg).toBe(288);      // solo la venta PEN
    expect(result.rows[0].montoSoles).toBe(1500);  // solo la venta PEN
    expect(result.excludedSaleIds).toEqual(['s-usd']);
  });

  it('ítem PLANCHA con metrosTotales = cantidad × largo', () => {
    const result = buildAluzincSalesReport([
      {
        saleId: 's1',
        currency: 'PEN',
        exchangeRate: null,
        items: [{ sku: 'PL040ROJO6M', quantity: 1, unitValue: 120, weightSnapshot: S_PLANCHA_040 }],
      },
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].pesoKg).toBe(23.04);
    expect(result.rows[0].metrosTotales).toBe(6);
    expect(result.rows[0].montoSoles).toBe(120); // 1 × 120
    expect(result.rows[0].label).toBe('0.4mm ROJO');
  });

  it('totales son suma de todas las filas', () => {
    const result = buildAluzincSalesReport([
      penSale('s1', 100, 15, S_030_ROJO),     // pesoKg=288, metros=100, monto=1500
      penSale('s2', 100, 14, S_040_NATURAL),  // pesoKg=376.8, metros=100, monto=1400
    ]);
    expect(result.totals.pesoKg).toBeCloseTo(664.8, 4);
    expect(result.totals.toneladas).toBeCloseTo(0.6648, 6);
    expect(result.totals.metrosTotales).toBe(200);
    expect(result.totals.montoSoles).toBe(2900);
  });

  it('múltiples ventas excluidas → todos en excludedSaleIds', () => {
    const result = buildAluzincSalesReport([
      usdSale('ex1', 100, 5, null, S_030_ROJO),
      usdSale('ex2', 100, 5, null, S_040_ROJO),
      penSale('ok', 100, 15, S_030_ROJO),
    ]);
    expect(result.excludedSaleIds).toHaveLength(2);
    expect(result.excludedSaleIds).toContain('ex1');
    expect(result.excludedSaleIds).toContain('ex2');
    expect(result.rows).toHaveLength(1);
  });

  it('colorFinish vacío → etiqueta con NATURAL', () => {
    const result = buildAluzincSalesReport([penSale('s1', 100, 14, S_040_NATURAL)]);
    expect(result.rows[0].colorFinish).toBe('');
    expect(result.rows[0].label).toBe('0.4mm NATURAL');
  });
});
