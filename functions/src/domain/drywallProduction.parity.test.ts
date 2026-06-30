import { describe, it, expect } from 'vitest';
import { calcProductionFromStrip } from './drywallProduction';
import { calcProductionFromStrip as clientCalc } from '../../../src/modules/drywall/domain/drywallProduction';

describe('Drywall Production Domain Parity & Correctness', () => {
  it('should calculate production from strip correctly and match between client and server', () => {
    const input = {
      stripsUsed: 5,
      pieces: 100,
      stripStock: {
        totalWeight: 1000,
        totalStrips: 10,
        avgCostPerKg: 3.5, // Total value = 3500. AvgWeight per strip = 100kg. Cost per strip = 350 PEN
      },
      product: {
        standardWeight: 2.5,
      },
      ptStock: {
        totalQuantity: 200,
        lastCostPerPiece: 15.0, // Value = 3000
      },
    };

    const serverResult = calcProductionFromStrip(input);
    const clientResult = clientCalc(input);

    expect(serverResult).toEqual(clientResult);

    // Hand calculation:
    // avgWeight = 1000 / 10 = 100 kg/strip
    // consumedWeightKg = 5 * 100 = 500 kg
    // consumedCostPEN = 5 * (3.5 * 100) = 1750 PEN
    // reportedWeightKg = 100 * 2.5 = 250 kg
    // costPerPiece = 1750 / 100 = 17.5 PEN
    // WAC:
    // inventoryValueBefore = 200 * 15.0 = 3000 PEN
    // new inventory value = 3000 + 1750 = 4750 PEN
    // new quantity = 200 + 100 = 300 pieces
    // newAverageCost = 4750 / 300 = 15.833333...

    expect(serverResult.avgWeight).toBe(100);
    expect(serverResult.consumedWeightKg).toBe(500);
    expect(serverResult.consumedCostPEN).toBe(1750);
    expect(serverResult.reportedWeightKg).toBe(250);
    expect(serverResult.costPerPiece).toBeCloseTo(17.5, 4);
    expect(serverResult.newAverageCost).toBeCloseTo(15.833333, 5);
  });

  it('should throw if pieces <= 0', () => {
    const input = {
      stripsUsed: 5,
      pieces: 0,
      stripStock: { totalWeight: 1000, totalStrips: 10, avgCostPerKg: 3.5 },
      product: { standardWeight: 2.5 },
      ptStock: { totalQuantity: 200, lastCostPerPiece: 15.0 },
    };

    expect(() => calcProductionFromStrip(input)).toThrow('La cantidad de piezas debe ser mayor a 0.');
    expect(() => clientCalc(input)).toThrow('La cantidad de piezas debe ser mayor a 0.');
  });

  it('should throw if stripsUsed <= 0', () => {
    const input = {
      stripsUsed: 0,
      pieces: 100,
      stripStock: { totalWeight: 1000, totalStrips: 10, avgCostPerKg: 3.5 },
      product: { standardWeight: 2.5 },
      ptStock: { totalQuantity: 200, lastCostPerPiece: 15.0 },
    };

    expect(() => calcProductionFromStrip(input)).toThrow('La cantidad de flejes a usar debe ser mayor a 0.');
    expect(() => clientCalc(input)).toThrow('La cantidad de flejes a usar debe ser mayor a 0.');
  });

  it('should throw if stripStock has <= 0 totalStrips or totalWeight', () => {
    const input = {
      stripsUsed: 5,
      pieces: 100,
      stripStock: { totalWeight: 1000, totalStrips: 0, avgCostPerKg: 3.5 },
      product: { standardWeight: 2.5 },
      ptStock: { totalQuantity: 200, lastCostPerPiece: 15.0 },
    };

    expect(() => calcProductionFromStrip(input)).toThrow('El stock del fleje es inválido o está agotado (peso o cantidad <= 0).');
    expect(() => clientCalc(input)).toThrow('El stock del fleje es inválido o está agotado (peso o cantidad <= 0).');
  });
});
