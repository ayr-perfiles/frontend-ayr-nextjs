import { describe, it, expect } from 'vitest';
import { calcCoilTheoreticalML, calcCoilYieldDeviation } from './yieldCalc';
import type { Coil, ProductionLog } from '@/types';

describe('yieldCalc', () => {
  it('calcCoilTheoreticalML calculates correctly', () => {
    // Ejemplo: 1000kg, 0.40mm, 1200mm, densidad 0.008
    const ml = calcCoilTheoreticalML({
      weightKg: 1000,
      thicknessMm: 0.40,
      masterWidthMm: 1200,
      densityFactor: 0.008,
    });
    // 1000 / (0.40 * 1200 * 0.008) = 1000 / 3.84 = 260.41666...
    expect(ml).toBeCloseTo(260.4166, 3);
  });

  it('calcCoilYieldDeviation returns correct deviation with no sales', () => {
    const coil: Coil = {
      id: 'TEST1',
      initialWeight: 1000,
      currentWeight: 500, // Consumidos reales: 500 kg
      thickness: 0.40,
      masterWidth: 1200,
      pricePerKg: 1,
      status: 'AVAILABLE',
      registeredBy: 'test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const logs: Partial<ProductionLog>[] = [
      { mlProduced: 65, status: 'ACTIVE' },
      { mlProduced: 60, status: 'ACTIVE' },
      // total mlProduced = 125
    ];

    const result = calcCoilYieldDeviation({
      coil,
      productionLogs: logs as ProductionLog[],
      densityFactor: 0.008,
    });

    expect(result.mlTeorico).toBeCloseTo(260.4166, 3);
    expect(result.mlProducido).toBe(125);
    
    // kgTeoricoConsumido = 125 * 0.40 * 1200 * 0.008 = 480 kg
    expect(result.kgTeoricoConsumido).toBeCloseTo(480, 2);
    
    // kgRealConsumido = 1000 - 500 = 500 kg
    expect(result.kgRealConsumido).toBe(500);

    // desviacionKg = 500 - 480 = 20 kg
    expect(result.desviacionKg).toBeCloseTo(20, 2);

    // desviacionPct = 20 / 480 = 0.0416... (4.16%)
    expect(result.desviacionPct).toBeCloseTo(0.0416, 3);

    // Default umbral is 0.05, 0.0416 <= 0.05
    expect(result.yieldAlert).toBe(false);
  });

  it('calcCoilYieldDeviation triggers alert when deviation > umbral', () => {
    const coil: Coil = {
      id: 'TEST2',
      initialWeight: 1000,
      currentWeight: 400, // Real consumido = 600 kg
      thickness: 0.40,
      masterWidth: 1200,
      pricePerKg: 1,
      status: 'AVAILABLE',
      registeredBy: 'test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const logs: Partial<ProductionLog>[] = [
      { mlProduced: 125, status: 'ACTIVE' }, // Teorico: 480 kg
    ];

    const result = calcCoilYieldDeviation({
      coil,
      productionLogs: logs as ProductionLog[],
      densityFactor: 0.008,
    });

    // Real: 600, Teorico: 480 -> diff: 120
    // 120 / 480 = 0.25 (25%)
    expect(result.desviacionPct).toBeCloseTo(0.25, 2);
    expect(result.yieldAlert).toBe(true);
  });
});
