import { describe, it, expect } from 'vitest';
import { calculateCuttingPlan, calculateScrapPerStrip } from './slitter';

describe('calculateCuttingPlan', () => {
  // P38: 3 × 121mm = 363, P64: 2 × 149mm = 298 → total = 661, leftover = 339 > 40 → usa masterWidth
  const baseParams = {
    totalCoilCost: 5000,
    masterWidth: 1000,
    items: [
      { sku: 'P38', quantity: 3, stripWidth: 121 },
      { sku: 'P64', quantity: 2, stripWidth: 149 },
    ],
  };

  it('retorna totalPlannedWidth, leftoverWidth y effectiveCostPerMm correctos', () => {
    const result = calculateCuttingPlan(baseParams);
    expect(result.totalPlannedWidth).toBe(661);
    expect(result.leftoverWidth).toBe(339);
    expect(result.effectiveCostPerMm).toBe(5); // 5000 / 1000
  });

  it('retorna un PlannedStrip por cada item', () => {
    const result = calculateCuttingPlan(baseParams);
    expect(result.plannedStrips).toHaveLength(2);
  });

  it('calcula costPerStrip correcto para cada fleje', () => {
    const result = calculateCuttingPlan(baseParams);
    const p38 = result.plannedStrips.find((s) => s.sku === 'P38');
    const p64 = result.plannedStrips.find((s) => s.sku === 'P64');
    expect(p38?.costPerStrip).toBe(605); // 121 × 5
    expect(p64?.costPerStrip).toBe(745); // 149 × 5
  });

  it('copia quantity a initialCount y pendingCount', () => {
    const result = calculateCuttingPlan(baseParams);
    const p38 = result.plannedStrips.find((s) => s.sku === 'P38');
    expect(p38?.initialCount).toBe(3);
    expect(p38?.pendingCount).toBe(3);
  });

  it('aplica regla de sobrante ≤ 40mm al costo por mm', () => {
    // 8 × 122mm = 976, leftover = 24 ≤ 40 → usa totalPlannedWidth 976
    const result = calculateCuttingPlan({
      totalCoilCost: 5000,
      masterWidth: 1000,
      items: [{ sku: 'P38', quantity: 8, stripWidth: 122 }],
    });
    expect(result.leftoverWidth).toBe(24);
    expect(result.effectiveCostPerMm).toBeCloseTo(5000 / 976, 4);
  });

  it('aplica regla de sobrante exacto = 40mm al costo por mm', () => {
    // 8 × 120mm = 960, leftover = 40 ≤ 40 → usa totalPlannedWidth 960
    const result = calculateCuttingPlan({
      totalCoilCost: 5000,
      masterWidth: 1000,
      items: [{ sku: 'P38', quantity: 8, stripWidth: 120 }],
    });
    expect(result.leftoverWidth).toBe(40);
    expect(result.effectiveCostPerMm).toBeCloseTo(5000 / 960, 4);
  });

  it('lanza error cuando el ancho total supera el masterWidth', () => {
    expect(() =>
      calculateCuttingPlan({
        totalCoilCost: 5000,
        masterWidth: 300,
        items: [{ sku: 'P38', quantity: 3, stripWidth: 121 }],
      })
    ).toThrow(/ancho total/i);
  });

  it('lanza error cuando un item tiene stripWidth = 0', () => {
    expect(() =>
      calculateCuttingPlan({
        totalCoilCost: 5000,
        masterWidth: 1000,
        items: [{ sku: 'P38', quantity: 3, stripWidth: 0 }],
      })
    ).toThrow(/stripWidth/i);
  });

  it('lanza error cuando un item tiene cantidad = 0', () => {
    expect(() =>
      calculateCuttingPlan({
        totalCoilCost: 5000,
        masterWidth: 1000,
        items: [{ sku: 'P38', quantity: 0, stripWidth: 121 }],
      })
    ).toThrow(/cantidad/i);
  });

  it('maneja un solo item sin error', () => {
    const result = calculateCuttingPlan({
      totalCoilCost: 3000,
      masterWidth: 500,
      items: [{ sku: 'P38', quantity: 2, stripWidth: 200 }],
    });
    // totalPlannedWidth = 400, leftover = 100 > 40 → usa masterWidth 500
    expect(result.plannedStrips).toHaveLength(1);
    expect(result.totalPlannedWidth).toBe(400);
    expect(result.effectiveCostPerMm).toBe(6); // 3000 / 500
  });
});

describe('calculateScrapPerStrip', () => {
  it('retorna 0 cuando no hay flejes planificados', () => {
    expect(calculateScrapPerStrip(1000, [])).toBe(0);
  });

  it('calcula scrap distribuido equitativamente entre todos los flejes', () => {
    // totalPlannedWidth = 363 + 298 = 661, leftover = 339, totalStripCount = 5
    // scrapPerStrip = 339 / 5 = 67.8
    const strips = [
      { sku: 'P38', initialCount: 3, pendingCount: 3, width: 121, costPerStrip: 605 },
      { sku: 'P64', initialCount: 2, pendingCount: 2, width: 149, costPerStrip: 745 },
    ];
    expect(calculateScrapPerStrip(1000, strips)).toBeCloseTo(67.8, 4);
  });

  it('retorna 0 scrap cuando el corte es perfecto', () => {
    // 2 × 250 = 500 = masterWidth → leftover = 0
    const strips = [
      { sku: 'P38', initialCount: 2, pendingCount: 2, width: 250, costPerStrip: 0 },
    ];
    expect(calculateScrapPerStrip(500, strips)).toBe(0);
  });

  it('calcula scrap para un único tipo de fleje', () => {
    // 4 × 200 = 800, leftover = 200, totalStripCount = 4 → scrap = 50 per strip
    const strips = [
      { sku: 'P38', initialCount: 4, pendingCount: 4, width: 200, costPerStrip: 0 },
    ];
    expect(calculateScrapPerStrip(1000, strips)).toBe(50);
  });
});
