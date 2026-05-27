import { describe, it, expect } from 'vitest';
import {
  calculateEffectiveCostPerMm,
  calculateCostPerStrip,
  calculateWeightedAverageCost,
} from './costing';

describe('calculateEffectiveCostPerMm', () => {
  it('usa masterWidth cuando el sobrante es 0 (corte perfecto)', () => {
    // leftover = 0 → usa masterWidth: 5000 / 1000 = 5
    expect(calculateEffectiveCostPerMm(5000, 1000, 1000)).toBe(5);
  });

  it('usa masterWidth cuando el sobrante supera 40mm', () => {
    // leftover = 50 > 40 → usa masterWidth: 5000 / 1000 = 5
    expect(calculateEffectiveCostPerMm(5000, 1000, 950)).toBe(5);
  });

  it('usa totalPlannedWidth cuando el sobrante es exactamente 40mm', () => {
    // leftover = 40 ≤ 40 → usa totalPlannedWidth: 5000 / 960
    const result = calculateEffectiveCostPerMm(5000, 1000, 960);
    expect(result).toBeCloseTo(5000 / 960, 5);
  });

  it('usa totalPlannedWidth cuando el sobrante es menor a 40mm', () => {
    // leftover = 20 < 40 → usa totalPlannedWidth: 5000 / 980
    const result = calculateEffectiveCostPerMm(5000, 1000, 980);
    expect(result).toBeCloseTo(5000 / 980, 5);
  });

  it('usa totalPlannedWidth cuando el sobrante es 1mm (mínimo)', () => {
    // leftover = 1 → usa totalPlannedWidth: 5000 / 999
    const result = calculateEffectiveCostPerMm(5000, 1000, 999);
    expect(result).toBeCloseTo(5000 / 999, 5);
  });

  it('el costo por mm es mayor con sobrante pequeño que con sobrante grande', () => {
    // Sobrante pequeño → base más chica → costo por mm más alto
    const withSmallLeftover = calculateEffectiveCostPerMm(5000, 1000, 990); // leftover=10
    const withLargeLeftover = calculateEffectiveCostPerMm(5000, 1000, 950); // leftover=50
    expect(withSmallLeftover).toBeGreaterThan(withLargeLeftover);
  });
});

describe('calculateCostPerStrip', () => {
  it('calcula costo para un fleje estándar P38 (121mm)', () => {
    // 121 * 5 = 605.00
    expect(calculateCostPerStrip(121, 5)).toBe(605);
  });

  it('calcula costo para un fleje P64 (149mm)', () => {
    // 149 * 4.5 = 670.50
    expect(calculateCostPerStrip(149, 4.5)).toBe(670.5);
  });

  it('redondea a 2 decimales', () => {
    // 121 * 1.333333 = 161.333333... → 161.33
    expect(calculateCostPerStrip(121, 1.333333)).toBe(161.33);
  });

  it('retorna 0 cuando el costo por mm es 0', () => {
    expect(calculateCostPerStrip(121, 0)).toBe(0);
  });
});

describe('calculateWeightedAverageCost', () => {
  it('usa solo el lote nuevo cuando no hay stock previo (currentQty = 0)', () => {
    // Primer ingreso: batchTotalCost=1000, newPieces=100 → avg=10
    expect(
      calculateWeightedAverageCost({
        currentQty: 0,
        currentAverageCost: 0,
        batchTotalCost: 1000,
        newPieces: 100,
      })
    ).toBe(10);
  });

  it('usa solo el lote nuevo cuando currentQty es negativo', () => {
    expect(
      calculateWeightedAverageCost({
        currentQty: -5,
        currentAverageCost: 12,
        batchTotalCost: 1000,
        newPieces: 100,
      })
    ).toBe(10);
  });

  it('calcula promedio ponderado con stock existente', () => {
    // 100 pzs a 10 + lote 50 pzs (costo total 600) → (1000+600)/150 = 10.666...
    const result = calculateWeightedAverageCost({
      currentQty: 100,
      currentAverageCost: 10,
      batchTotalCost: 600,
      newPieces: 50,
    });
    expect(result).toBeCloseTo(10.6667, 3);
  });

  it('el promedio no cambia si el lote tiene el mismo costo unitario', () => {
    // 100 pzs a 10 + 50 pzs a 10 (costo 500) → 1500/150 = 10
    expect(
      calculateWeightedAverageCost({
        currentQty: 100,
        currentAverageCost: 10,
        batchTotalCost: 500,
        newPieces: 50,
      })
    ).toBe(10);
  });

  it('el promedio baja cuando el lote es más barato', () => {
    // 100 pzs a 12 + 100 pzs a 8 (costo 800) → 2000/200 = 10
    expect(
      calculateWeightedAverageCost({
        currentQty: 100,
        currentAverageCost: 12,
        batchTotalCost: 800,
        newPieces: 100,
      })
    ).toBe(10);
  });

  it('el promedio sube cuando el lote es más caro', () => {
    // 100 pzs a 8 + 100 pzs a 12 (costo 1200) → 2000/200 = 10
    const result = calculateWeightedAverageCost({
      currentQty: 100,
      currentAverageCost: 8,
      batchTotalCost: 1200,
      newPieces: 100,
    });
    expect(result).toBe(10);
    expect(result).toBeGreaterThan(8);
  });
});
