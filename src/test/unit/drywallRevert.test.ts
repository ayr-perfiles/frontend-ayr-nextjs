import { describe, it, expect } from 'vitest';
// @ts-ignore
import { calcRevertProductionFromStrip } from '../../../functions/src/domain/drywallProduction';

describe('Unit: calcRevertProductionFromStrip', () => {
  it('T1 base: resta normal y blend', () => {
    const input = {
      stripPool: { totalWeight: 1300, totalStrips: 12, avgCostPerKg: 6 },
      ptStock: { totalQuantity: 100, lastCostPerPiece: 22 },
      log: { consumedWeightKg: 200, consumedCostPEN: 1000, stripsUsed: 2, piecesProduced: 40 }
    };
    const res = calcRevertProductionFromStrip(input);
    expect(res.strip.newTotalWeight).toBeCloseTo(1500, 6);
    expect(res.strip.newTotalStrips).toBe(14);
    expect(res.strip.newAvgCostPerKg).toBeCloseTo(5.866667, 6);
    expect(res.pt.newQuantity).toBe(60);
    expect(res.pt.newLastCostPerPiece).toBeCloseTo(20.00, 6);
    expect(res.frozenStripCostPerKg).toBeCloseTo(5.00, 6);
  });

  it('T2 FG queda en 0: no dividir por cero', () => {
    const input = {
      stripPool: { totalWeight: 1300, totalStrips: 12, avgCostPerKg: 6 },
      ptStock: { totalQuantity: 40, lastCostPerPiece: 25 },
      log: { consumedWeightKg: 200, consumedCostPEN: 1000, stripsUsed: 2, piecesProduced: 40 }
    };
    const res = calcRevertProductionFromStrip(input);
    expect(res.pt.newQuantity).toBe(0);
    expect(res.pt.newLastCostPerPiece).toBe(0);
  });

  it('T3 pool vacío al reversar (primer retorno)', () => {
    const input = {
      stripPool: { totalWeight: 0, totalStrips: 0, avgCostPerKg: 0 },
      ptStock: { totalQuantity: 100, lastCostPerPiece: 22 },
      log: { consumedWeightKg: 200, consumedCostPEN: 1000, stripsUsed: 2, piecesProduced: 40 }
    };
    const res = calcRevertProductionFromStrip(input);
    expect(res.strip.newTotalWeight).toBeCloseTo(200, 6);
    expect(res.strip.newTotalStrips).toBe(2);
    expect(res.strip.newAvgCostPerKg).toBeCloseTo(5.00, 6);
  });

  it('T4 multi-fleje: NO hardcodear stripsUsed=1', () => {
    const input = {
      stripPool: { totalWeight: 1000, totalStrips: 10, avgCostPerKg: 6 },
      ptStock: { totalQuantity: 100, lastCostPerPiece: 22 },
      log: { consumedWeightKg: 300, consumedCostPEN: 1500, stripsUsed: 3, piecesProduced: 40 }
    };
    const res = calcRevertProductionFromStrip(input);
    expect(res.strip.newTotalStrips).toBe(13);
  });
});
