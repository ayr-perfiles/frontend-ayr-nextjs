import { describe, it, expect } from 'vitest';
import { mapCosteoAluzincToReportRows } from './costeoAluzincReportMapper';
import { CosteoAluzincRow } from './costeoAluzincLogic';

describe('mapCosteoAluzincToReportRows', () => {
  it('costoPorKg => null cuando pesoProduccionKg es 0 (el renderer del hub lo pinta "-"); pasa a través cuando hay peso', () => {
    const rows: CosteoAluzincRow[] = [
      { tipo: 'Natural', pesoProduccionKg: 0, costoPEN: 0, costoPorKg: 0, ventaPEN: 100, ventaKg: 5, mermaKg: 0 },
      { tipo: 'Prepintado', pesoProduccionKg: 200, costoPEN: 1200, costoPorKg: 6, ventaPEN: 300, ventaKg: 10, mermaKg: 5 },
    ];
    const result = mapCosteoAluzincToReportRows(rows);
    expect(result[0].costoPorKg).toBeNull();
    expect(result[0].ventaPEN).toBe(100);
    expect(result[1].costoPorKg).toBe(6);
    expect(result[1].pesoProduccionKg).toBe(200);
  });
});
