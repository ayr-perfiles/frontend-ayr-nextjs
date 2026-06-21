import { describe, it, expect } from 'vitest';
import {
  buildAluzincCostReport,
  buildAluzincProfitSummary,
  type AluzincCostSaleInput,
} from './aluzincCostReport';
import type { AluzincReportResult } from './aluzincSalesReport';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const snap047Rojo = {
  thicknessMm: 0.47,
  colorFinish: 'ROJO',
  widthMm: 1200,
  pesoKg: 50,
  metrosTotales: 100,
  densityFactor: 1,
};

const snap035Natural = {
  thicknessMm: 0.35,
  colorFinish: '',
  widthMm: 1200,
  pesoKg: 30,
  metrosTotales: 80,
  densityFactor: 1,
};

// ─── buildAluzincCostReport ───────────────────────────────────────────────────

describe('buildAluzincCostReport', () => {
  it('agrupa por (thicknessMm, colorFinish) y calcula costoTotal = baseCost × quantity', () => {
    const sales: AluzincCostSaleInput[] = [
      {
        saleId: 'V-001',
        currency: 'PEN',
        exchangeRate: null,
        items: [
          { sku: 'ALU-047-ROJO', quantity: 10, baseCost: 45.0, weightSnapshot: snap047Rojo },
        ],
      },
    ];

    const result = buildAluzincCostReport(sales);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].costoTotal).toBeCloseTo(450.0, 2);
    expect(result.rows[0].pesoKg).toBe(50);
    expect(result.rows[0].metrosTotales).toBe(100);
    expect(result.rows[0].thicknessMm).toBe(0.47);
    expect(result.rows[0].colorFinish).toBe('ROJO');
  });

  it('acumula múltiples ventas del mismo (espesor, color)', () => {
    const sales: AluzincCostSaleInput[] = [
      {
        saleId: 'V-001',
        currency: 'PEN',
        exchangeRate: null,
        items: [{ sku: 'ALU-047-ROJO', quantity: 5, baseCost: 45.0, weightSnapshot: snap047Rojo }],
      },
      {
        saleId: 'V-002',
        currency: 'PEN',
        exchangeRate: null,
        items: [{ sku: 'ALU-047-ROJO', quantity: 3, baseCost: 46.0, weightSnapshot: snap047Rojo }],
      },
    ];

    const result = buildAluzincCostReport(sales);
    expect(result.rows).toHaveLength(1);
    // 5×45 + 3×46 = 225 + 138 = 363
    expect(result.rows[0].costoTotal).toBeCloseTo(363, 2);
    // peso: 50 + 50 = 100 kg
    expect(result.rows[0].pesoKg).toBe(100);
  });

  it('costoPorKg = costoTotal / pesoKg', () => {
    const sales: AluzincCostSaleInput[] = [
      {
        saleId: 'V-001',
        currency: 'PEN',
        exchangeRate: null,
        items: [{ sku: 'ALU-035', quantity: 1, baseCost: 150.0, weightSnapshot: snap035Natural }],
      },
    ];

    const result = buildAluzincCostReport(sales);
    const row = result.rows[0];
    // costoTotal = 150, pesoKg = 30 → 5.0
    expect(row.costoPorKg).toBeCloseTo(5.0, 4);
  });

  it('excluye íntegramente ventas USD sin exchangeRate', () => {
    const sales: AluzincCostSaleInput[] = [
      {
        saleId: 'V-USD-001',
        currency: 'USD',
        exchangeRate: null,
        items: [{ sku: 'ALU-047', quantity: 10, baseCost: 45.0, weightSnapshot: snap047Rojo }],
      },
      {
        saleId: 'V-PEN-001',
        currency: 'PEN',
        exchangeRate: null,
        items: [{ sku: 'ALU-047', quantity: 5, baseCost: 45.0, weightSnapshot: snap047Rojo }],
      },
    ];

    const result = buildAluzincCostReport(sales);
    expect(result.excludedSaleIds).toContain('V-USD-001');
    expect(result.rows[0].costoTotal).toBeCloseTo(225, 2); // solo la PEN
  });

  it('incluye ventas USD con exchangeRate (baseCost no necesita conversión: está en PEN)', () => {
    const sales: AluzincCostSaleInput[] = [
      {
        saleId: 'V-USD-TC',
        currency: 'USD',
        exchangeRate: 3.80,
        items: [{ sku: 'ALU-047', quantity: 10, baseCost: 45.0, weightSnapshot: snap047Rojo }],
      },
    ];

    const result = buildAluzincCostReport(sales);
    expect(result.excludedSaleIds).toHaveLength(0);
    // costoTotal = 10 × 45 = 450 (en PEN, sin conversión)
    expect(result.rows[0].costoTotal).toBeCloseTo(450, 2);
  });

  it('devuelve totals consolidados correctos', () => {
    const sales: AluzincCostSaleInput[] = [
      {
        saleId: 'V-001',
        currency: 'PEN',
        exchangeRate: null,
        items: [
          { sku: 'A', quantity: 2, baseCost: 100.0, weightSnapshot: snap047Rojo },
          { sku: 'B', quantity: 1, baseCost: 50.0, weightSnapshot: snap035Natural },
        ],
      },
    ];

    const result = buildAluzincCostReport(sales);
    expect(result.totals.costoTotal).toBeCloseTo(250, 2); // 200 + 50
    expect(result.totals.pesoKg).toBe(80); // 50 + 30
  });

  it('omite items sin weightSnapshot', () => {
    const sales: AluzincCostSaleInput[] = [
      {
        saleId: 'V-001',
        currency: 'PEN',
        exchangeRate: null,
        items: [
          { sku: 'A', quantity: 5, baseCost: 40.0, weightSnapshot: null },
        ],
      },
    ];

    const result = buildAluzincCostReport(sales);
    expect(result.rows).toHaveLength(0);
    expect(result.totals.costoTotal).toBe(0);
  });
});

// ─── buildAluzincProfitSummary ────────────────────────────────────────────────

const mockVentasResult: AluzincReportResult = {
  rows: [
    { label: '0.47mm ROJO', thicknessMm: 0.47, colorFinish: 'ROJO', metrosTotales: 100, pesoKg: 50, toneladas: 0.05, montoSoles: 8000, precioPorKg: 160 },
    { label: '0.35mm NATURAL', thicknessMm: 0.35, colorFinish: '', metrosTotales: 80, pesoKg: 30, toneladas: 0.03, montoSoles: 3000, precioPorKg: 100 },
  ],
  totals: { pesoKg: 80, toneladas: 0.08, metrosTotales: 180, montoSoles: 11000 },
  excludedSaleIds: [],
};

const mockCostoResult = {
  rows: [
    { label: '0.47mm ROJO', thicknessMm: 0.47, colorFinish: 'ROJO', metrosTotales: 100, pesoKg: 50, toneladas: 0.05, costoTotal: 5000, costoPorKg: 100 },
    { label: '0.35mm NATURAL', thicknessMm: 0.35, colorFinish: '', metrosTotales: 80, pesoKg: 30, toneladas: 0.03, costoTotal: 2000, costoPorKg: 66.67 },
  ],
  totals: { pesoKg: 80, toneladas: 0.08, metrosTotales: 180, costoTotal: 7000 },
  excludedSaleIds: [],
};

describe('buildAluzincProfitSummary', () => {
  it('calcula Ganancia = Venta − Costo por color', () => {
    const result = buildAluzincProfitSummary(mockVentasResult, mockCostoResult, 0);

    const rojo = result.rows.find((r) => r.colorFinish === 'ROJO')!;
    expect(rojo.ventaSoles).toBeCloseTo(8000, 2);
    expect(rojo.costoSoles).toBeCloseTo(5000, 2);
    expect(rojo.gananciaSoles).toBeCloseTo(3000, 2);

    const natural = result.rows.find((r) => r.colorFinish === 'NATURAL' || r.colorFinish === '')!;
    expect(natural.gananciaSoles).toBeCloseTo(1000, 2);
  });

  it('margenPct = ganancia / venta × 100', () => {
    const result = buildAluzincProfitSummary(mockVentasResult, mockCostoResult, 0);
    const rojo = result.rows.find((r) => r.colorFinish === 'ROJO')!;
    // 3000 / 8000 = 37.5%
    expect(rojo.margenPct).toBeCloseTo(37.5, 1);
  });

  it('merma aparece solo en totals, no en rows', () => {
    const mermaSoles = 500;
    const result = buildAluzincProfitSummary(mockVentasResult, mockCostoResult, mermaSoles);

    // Ningún row tiene campo mermaSoles
    for (const row of result.rows) {
      expect((row as any).mermaSoles).toBeUndefined();
    }

    expect(result.totals.mermaSoles).toBe(500);
  });

  it('Total Ganancia = TotalVenta − TotalCosto − TotalMerma', () => {
    const mermaSoles = 800;
    const result = buildAluzincProfitSummary(mockVentasResult, mockCostoResult, mermaSoles);

    // 11000 − 7000 − 800 = 3200
    expect(result.totals.gananciaSoles).toBeCloseTo(3200, 2);
    expect(result.totals.ventaSoles).toBeCloseTo(11000, 2);
    expect(result.totals.costoSoles).toBeCloseTo(7000, 2);
    expect(result.totals.mermaSoles).toBeCloseTo(800, 2);
  });

  it('agrupa múltiples espesores del mismo color', () => {
    const ventas: AluzincReportResult = {
      rows: [
        { label: '0.47mm ROJO', thicknessMm: 0.47, colorFinish: 'ROJO', metrosTotales: 100, pesoKg: 50, toneladas: 0.05, montoSoles: 5000, precioPorKg: 100 },
        { label: '0.35mm ROJO', thicknessMm: 0.35, colorFinish: 'ROJO', metrosTotales: 80, pesoKg: 30, toneladas: 0.03, montoSoles: 2000, precioPorKg: 66 },
      ],
      totals: { pesoKg: 80, toneladas: 0.08, metrosTotales: 180, montoSoles: 7000 },
      excludedSaleIds: [],
    };
    const costo = {
      rows: [
        { label: '0.47mm ROJO', thicknessMm: 0.47, colorFinish: 'ROJO', metrosTotales: 100, pesoKg: 50, toneladas: 0.05, costoTotal: 3000, costoPorKg: 60 },
        { label: '0.35mm ROJO', thicknessMm: 0.35, colorFinish: 'ROJO', metrosTotales: 80, pesoKg: 30, toneladas: 0.03, costoTotal: 1200, costoPorKg: 40 },
      ],
      totals: { pesoKg: 80, toneladas: 0.08, metrosTotales: 180, costoTotal: 4200 },
      excludedSaleIds: [],
    };

    const result = buildAluzincProfitSummary(ventas, costo, 0);
    // Solo 1 row con colorFinish ROJO, suma los dos espesores
    const rojoRows = result.rows.filter((r) => r.colorFinish === 'ROJO');
    expect(rojoRows).toHaveLength(1);
    expect(rojoRows[0].ventaSoles).toBeCloseTo(7000, 2);  // 5000 + 2000
    expect(rojoRows[0].costoSoles).toBeCloseTo(4200, 2);  // 3000 + 1200
    expect(rojoRows[0].gananciaSoles).toBeCloseTo(2800, 2);
  });

  it('devuelve rows vacíos si no hay ventas ni costos', () => {
    const emptyVentas: AluzincReportResult = { rows: [], totals: { pesoKg: 0, toneladas: 0, metrosTotales: 0, montoSoles: 0 }, excludedSaleIds: [] };
    const emptyCosto = { rows: [], totals: { pesoKg: 0, toneladas: 0, metrosTotales: 0, costoTotal: 0 }, excludedSaleIds: [] };

    const result = buildAluzincProfitSummary(emptyVentas, emptyCosto, 0);
    expect(result.rows).toHaveLength(0);
    expect(result.totals.gananciaSoles).toBe(0);
  });
});
