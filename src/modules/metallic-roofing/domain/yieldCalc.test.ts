import { describe, it, expect } from 'vitest';
import { calcCoilTheoreticalML, calcCoilYieldDeviation } from './yieldCalc';
import type { Coil, ProductionLog } from '@/types';

describe('yieldCalc', () => {
  const mockCoil = {
    id: 'C1',
    initialWeight: 1000,
    currentWeight: 530,
    thickness: 0.40,
    masterWidth: 1200,
    pricePerKg: 1,
    status: 'AVAILABLE',
    registeredBy: 'test',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('calcCoilTheoreticalML calculates correctly', () => {
    // ML = 1000 / (0.40 * 1200 * 0.008) = 1000 / 3.84 = 260.416...
    const result = calcCoilTheoreticalML({
      weightKg: 1000,
      thicknessMm: 0.40,
      masterWidthMm: 1200,
      densityFactor: 0.008,
    });
    expect(result).toBeCloseTo(260.4166, 3);
  });

  it('calcCoilYieldDeviation returns correct deviation with no sales', () => {
    const logs = [
      { 
        perCoilBreakdown: [{ coilId: 'C1', mlFromCoil: 65, weightConsumedKg: 200, costPEN: 100 }],
        status: 'ACTIVE' 
      },
      { 
        perCoilBreakdown: [{ coilId: 'C1', mlFromCoil: 60, weightConsumedKg: 180, costPEN: 90 }],
        status: 'ACTIVE' 
      },
    ] as any;

    const result = calcCoilYieldDeviation({
      coil: mockCoil as any,
      productionLogs: logs,
      densityFactor: 0.008,
      kgVendidoCrudo: 0,
    });

    // 125 * 0.4 * 1200 * 0.008 = 480 kg
    expect(result.kgTeoricoConsumido).toBe(480);
    // 1000 - 530 = 470 kg
    expect(result.kgRealConsumido).toBe(470);
    expect(result.desviacionKg).toBe(-10); // 470 - 480
    expect(result.desviacionPct).toBe(-10 / 480);
    expect(result.yieldAlert).toBe(false); // < 5%
  });

  it('calcCoilYieldDeviation triggers alert when deviation > umbral', () => {
    const logs = [
      { 
        perCoilBreakdown: [{ coilId: 'C1', mlFromCoil: 125, weightConsumedKg: 400, costPEN: 200 }],
        status: 'ACTIVE' 
      }, // Teorico: 480 kg
    ] as any;

    const coil = { ...mockCoil, initialWeight: 1000, currentWeight: 400 }; // Consumo real: 600 kg
    // Desviacion = 600 - 480 = 120 kg
    // Pct = 120 / 480 = 25%

    const result = calcCoilYieldDeviation({
      coil: coil as any,
      productionLogs: logs,
      densityFactor: 0.008,
      kgVendidoCrudo: 0,
    });

    expect(result.yieldAlert).toBe(true);
  });

  it('throws error if log is missing perCoilBreakdown or breakdown entry', () => {
    const logsMissing = [{ status: 'ACTIVE', mlProduced: 125 }] as any;
    expect(() => {
      calcCoilYieldDeviation({
        coil: mockCoil as any,
        productionLogs: logsMissing,
        densityFactor: 0.008,
      });
    }).toThrow(/sin perCoilBreakdown/);

    const logsMissingEntry = [
      { status: 'ACTIVE', perCoilBreakdown: [{ coilId: 'C2', mlFromCoil: 125 }] }
    ] as any;
    expect(() => {
      calcCoilYieldDeviation({
        coil: mockCoil as any,
        productionLogs: logsMissingEntry,
        densityFactor: 0.008,
      });
    }).toThrow(/no lo detalla en perCoilBreakdown/);
  });
});
