import { describe, it, expect } from 'vitest';
import { calcRevertProductionFromCoil } from './drywallProduction';

describe('calcRevertProductionFromCoil', () => {
  it('T1 base: devuelve peso y WAC correcto (newQty > 0)', () => {
    const input = {
      coil: { initialWeight: 5000, masterWidth: 1200, currentWeight: 3000 },
      ptStock: { totalQuantity: 300, lastCostPerPiece: 5.00 },
      log: { piecesProduced: 100, stripCost: 400, totalUsedWidth: 120 }
    };
    
    const result = calcRevertProductionFromCoil(input);
    
    expect(result.coilRestoredWeightKg).toBeCloseTo(500, 6);
    expect(result.coilNewWeight).toBe(3500);
    expect(result.pt.newQuantity).toBe(200);
    expect(result.pt.newLastCostPerPiece).toBeCloseTo(5.50, 6);
    expect(result.approximateWeight).toBe(true);
    expect(result.negativeStockWarning).toBe(false);
  });

  it('T2 negativo: PT negativo no recalcula WAC y emite warning', () => {
    const input = {
      coil: { initialWeight: 5000, masterWidth: 1200, currentWeight: 3000 },
      ptStock: { totalQuantity: -18596, lastCostPerPiece: 4.11 },
      log: { piecesProduced: 100, stripCost: 400, totalUsedWidth: 120 }
    };
    
    const result = calcRevertProductionFromCoil(input);
    
    expect(result.pt.newQuantity).toBe(-18696);
    expect(result.pt.newLastCostPerPiece).toBe(4.11);
    expect(result.negativeStockWarning).toBe(true);
  });

  it('T3 qty→0: congelar WAC, no div/0', () => {
    const input = {
      coil: { initialWeight: 5000, masterWidth: 1200, currentWeight: 3000 },
      ptStock: { totalQuantity: 100, lastCostPerPiece: 5.00 },
      log: { piecesProduced: 100, stripCost: 400, totalUsedWidth: 120 }
    };
    
    const result = calcRevertProductionFromCoil(input);
    
    expect(result.pt.newQuantity).toBe(0);
    expect(result.pt.newLastCostPerPiece).toBe(5.00);
    expect(result.negativeStockWarning).toBe(true);
  });

  it('T4 cap: no sobrepasa initialWeight', () => {
    const input = {
      coil: { initialWeight: 5000, masterWidth: 1200, currentWeight: 4900 },
      ptStock: { totalQuantity: 300, lastCostPerPiece: 5.00 },
      log: { piecesProduced: 100, stripCost: 400, totalUsedWidth: 120 }
    };
    
    const result = calcRevertProductionFromCoil(input);
    
    expect(result.coilRestoredWeightKg).toBeCloseTo(500, 6);
    expect(result.coilNewWeight).toBe(5000);
  });

  it('T5 masterWidth ausente: throw', () => {
    const input = {
      coil: { initialWeight: 5000, masterWidth: undefined as any, currentWeight: 3000 },
      ptStock: { totalQuantity: 300, lastCostPerPiece: 5.00 },
      log: { piecesProduced: 100, stripCost: 400, totalUsedWidth: 120 }
    };
    
    expect(() => calcRevertProductionFromCoil(input)).toThrow('masterWidth');
  });
});
