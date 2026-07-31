import { describe, it, expect } from 'vitest';
import { calculateCosteoAluzinc, ProductionLogInput, SaleInput, ScrapLogInput, CoilInput } from './costeoAluzincLogic';

describe('calculateCosteoAluzinc', () => {
  const finishesMap = {
    'ALZ-NATURAL': { tipo: 'Natural', color: '-' },
    'ALZ-AZUL-5002': { tipo: 'Prepintado', color: 'Azul' },
    'GALV': { tipo: 'Galvanizado', color: '-' }
  };

  const metallicCatalog = {
    'COB-NATURAL': { finish: 'ALZ-NATURAL' },
    'COB-AZUL': { finish: 'ALZ-AZUL-5002' }
  };

  const coils: CoilInput[] = [
    { id: 'C1', finish: 'ALZ-NATURAL' },
    { id: 'C2', finish: 'ALZ-AZUL-5002' },
    { id: 'C3', finish: 'GALV' }
  ];

  it('h) caso pizarra-en-cero (todo vacío) => 2 filas Natural/Prepintado en 0', () => {
    const result = calculateCosteoAluzinc({
      productionLogs: [], sales: [], scrapLogs: [], coils: [], metallicCatalog: {}, finishesMap: {}
    });
    expect(result).toHaveLength(2);
    expect(result.find(r => r.tipo === 'Natural')).toEqual({
      tipo: 'Natural', pesoProduccionKg: 0, costoPEN: 0, costoPorKg: 0, ventaPEN: 0, ventaKg: 0, mermaKg: 0
    });
    expect(result.find(r => r.tipo === 'Prepintado')).toEqual({
      tipo: 'Prepintado', pesoProduccionKg: 0, costoPEN: 0, costoPorKg: 0, ventaPEN: 0, ventaKg: 0, mermaKg: 0
    });
  });

  it('a) producción con bobina ALZ-NATURAL suma a Natural; ALZ-AZUL-5002 suma a Prepintado; GALV no suma', () => {
    const productionLogs: ProductionLogInput[] = [
      { status: 'COMPLETED', perCoilBreakdown: [{ coilId: 'C1', weightConsumedKg: 100, costPEN: 500 }] },
      { status: 'COMPLETED', perCoilBreakdown: [{ coilId: 'C2', weightConsumedKg: 200, costPEN: 1200 }] },
      { status: 'COMPLETED', perCoilBreakdown: [{ coilId: 'C3', weightConsumedKg: 50, costPEN: 100 }] }
    ];
    const res = calculateCosteoAluzinc({ productionLogs, sales: [], scrapLogs: [], coils, metallicCatalog, finishesMap });
    expect(res.find(r => r.tipo === 'Natural')?.pesoProduccionKg).toBe(100);
    expect(res.find(r => r.tipo === 'Natural')?.costoPEN).toBe(500);
    expect(res.find(r => r.tipo === 'Prepintado')?.pesoProduccionKg).toBe(200);
    expect(res.find(r => r.tipo === 'Prepintado')?.costoPEN).toBe(1200);
  });

  it('b) production_log status VOIDED NO cuenta; sin campo status SÍ cuenta', () => {
    const productionLogs: ProductionLogInput[] = [
      { perCoilBreakdown: [{ coilId: 'C1', weightConsumedKg: 100, costPEN: 500 }] },
      { status: 'VOIDED', perCoilBreakdown: [{ coilId: 'C1', weightConsumedKg: 50, costPEN: 250 }] }
    ];
    const res = calculateCosteoAluzinc({ productionLogs, sales: [], scrapLogs: [], coils, metallicCatalog, finishesMap });
    expect(res.find(r => r.tipo === 'Natural')?.pesoProduccionKg).toBe(100);
  });

  it('c) venta usa unitValue, NO unitPrice: fixture con unitValue!=unitPrice', () => {
    const sales: SaleInput[] = [
      { status: 'COMPLETED', items: [{ sku: 'COB-NATURAL', unitValue: 80, quantity: 5, unitWeight: 2 }] }
    ];
    const res = calculateCosteoAluzinc({ productionLogs: [], sales, scrapLogs: [], coils, metallicCatalog, finishesMap });
    expect(res.find(r => r.tipo === 'Natural')?.ventaPEN).toBe(400); // 80 * 5
    expect(res.find(r => r.tipo === 'Natural')?.ventaKg).toBe(10); // 2 * 5
  });

  it('d) join sku->metallicCatalog->finish->tipo: ítem sin match se IGNORA', () => {
    const sales: SaleInput[] = [
      { items: [{ sku: 'OTRO', unitValue: 100, quantity: 1, unitWeight: 1 }] }
    ];
    const res = calculateCosteoAluzinc({ productionLogs: [], sales, scrapLogs: [], coils, metallicCatalog, finishesMap });
    expect(res.find(r => r.tipo === 'Natural')?.ventaPEN).toBe(0);
    expect(res.find(r => r.tipo === 'Prepintado')?.ventaPEN).toBe(0);
  });

  it('e) costoPorKg: peso=0 => 0 sin dividir por cero', () => {
    const res = calculateCosteoAluzinc({ productionLogs: [], sales: [], scrapLogs: [], coils, metallicCatalog, finishesMap });
    expect(res.find(r => r.tipo === 'Natural')?.costoPorKg).toBe(0);
  });

  it('f) scrap VOIDED excluido; scrap de GALV no entra', () => {
    const scrapLogs: ScrapLogInput[] = [
      { coilId: 'C1', scrapWeightKg: 10 },
      { coilId: 'C1', status: 'VOIDED', scrapWeightKg: 5 },
      { coilId: 'C3', scrapWeightKg: 20 }
    ];
    const res = calculateCosteoAluzinc({ productionLogs: [], sales: [], scrapLogs, coils, metallicCatalog, finishesMap });
    expect(res.find(r => r.tipo === 'Natural')?.mermaKg).toBe(10);
  });

  it('g) periodo: doc fuera del rango NO cuenta; en borde SÍ', () => {
    const range = { from: 1000, to: 2000 };
    const productionLogs: ProductionLogInput[] = [
      { timestamp: { toMillis: () => 999 }, perCoilBreakdown: [{ coilId: 'C1', weightConsumedKg: 10, costPEN: 0 }] },
      { timestamp: { _seconds: 1 }, perCoilBreakdown: [{ coilId: 'C1', weightConsumedKg: 20, costPEN: 0 }] } // 1 second = 1000 ms
    ];
    const sales: SaleInput[] = [
      { status: 'COMPLETED', timestamp: { seconds: 2 }, items: [{ sku: 'COB-NATURAL', unitValue: 10, quantity: 1, unitWeight: 0 }] }, // 2 seconds = 2000 ms
      { status: 'COMPLETED', timestamp: 2001, items: [{ sku: 'COB-NATURAL', unitValue: 100, quantity: 1, unitWeight: 0 }] } // pure number
    ];
    const res = calculateCosteoAluzinc({ productionLogs, sales, scrapLogs: [], coils, metallicCatalog, finishesMap, range });
    expect(res.find(r => r.tipo === 'Natural')?.pesoProduccionKg).toBe(20);
    expect(res.find(r => r.tipo === 'Natural')?.ventaPEN).toBe(10);
  });

  it('i) venta cuenta SOLO status COMPLETED; QUOTATION y VOIDED se ignoran', () => {
    const sales: SaleInput[] = [
      { status: 'COMPLETED', items: [{ sku: 'COB-NATURAL', unitValue: 80, quantity: 5, unitWeight: 2 }] },
      { status: 'QUOTATION', items: [{ sku: 'COB-NATURAL', unitValue: 80, quantity: 5, unitWeight: 2 }] },
      { status: 'VOIDED', items: [{ sku: 'COB-NATURAL', unitValue: 80, quantity: 5, unitWeight: 2 }] }
    ];
    const res = calculateCosteoAluzinc({ productionLogs: [], sales, scrapLogs: [], coils, metallicCatalog, finishesMap });
    expect(res.find(r => r.tipo === 'Natural')?.ventaPEN).toBe(400); // solo la COMPLETED: 80*5
    expect(res.find(r => r.tipo === 'Natural')?.ventaKg).toBe(10); // solo la COMPLETED: 2*5
  });
});
