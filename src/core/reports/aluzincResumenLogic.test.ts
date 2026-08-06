import { describe, it, expect } from 'vitest';
import {
  calculateAluzincResumen,
  AluzincResumenSale,
  AluzincResumenScrap,
} from './aluzincResumenLogic';

describe('calculateAluzincResumen', () => {
  const metallicCatalog = {
    COB030AZUL: { finish: 'ALZ-AZUL-5002' },
    COB030ROJO: { finish: 'ALZ-ROJO-3002' },
  };

  const finishesMap = {
    'ALZ-AZUL-5002': { tipo: 'Prepintado', color: 'Azul' },
    'ALZ-ROJO-3002': { tipo: 'Prepintado', color: 'Rojo' },
  };

  it('venta metallic COMPLETED sin weightSnapshot (ML puro de prod) debe procesarse y NO descartarse', () => {
    const sales: AluzincResumenSale[] = [
      {
        id: 'FFA1-1290',
        status: 'COMPLETED',
        timestamp: 1782406800000,
        items: [
          {
            businessLine: 'metallic-roofing',
            sku: 'COB030AZUL',
            quantity: 257.5,
            unitValue: 9.576271844660194,
            baseCost: 7.87417,
            weightSnapshot: undefined,
          },
        ],
      },
    ];

    const scraps: AluzincResumenScrap[] = [
      {
        scrapCostPEN: 100,
        status: 'ACTIVE',
        timestamp: 1782406800000,
      },
    ];

    const result = calculateAluzincResumen({
      sales,
      scraps,
      metallicCatalog,
      finishesMap,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].colorFinish).toBe('Azul');
    expect(result.rows[0].ventaSoles).toBeCloseTo(2465.89, 2);
    expect(result.rows[0].costoSoles).toBeCloseTo(2027.6, 2);
    expect(result.rows[0].gananciaSoles).toBeCloseTo(438.29, 2);

    expect(result.totals.ventaSoles).toBeCloseTo(2465.89, 2);
    expect(result.totals.costoSoles).toBeCloseTo(2027.6, 2);
    expect(result.totals.mermaSoles).toBe(100);
    expect(result.totals.gananciaSoles).toBeCloseTo(338.29, 2);
  });

  it('venta con weightSnapshot presente y baseCost definido también cuenta correctamente', () => {
    const sales: AluzincResumenSale[] = [
      {
        status: 'COMPLETED',
        items: [
          {
            businessLine: 'metallic-roofing',
            sku: 'COB030ROJO',
            quantity: 100,
            unitValue: 10,
            baseCost: 8,
            weightSnapshot: {
              colorFinish: 'Rojo',
              thicknessMm: 0.3,
              pesoKg: 300,
              metrosTotales: 100,
            },
          },
        ],
      },
    ];

    const scraps: AluzincResumenScrap[] = [
      {
        scrapCostPEN: 50,
        status: 'ACTIVE',
      },
    ];

    const result = calculateAluzincResumen({
      sales,
      scraps,
      metallicCatalog,
      finishesMap,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].colorFinish).toBe('Rojo');
    expect(result.rows[0].ventaSoles).toBe(1000);
    expect(result.rows[0].costoSoles).toBe(800);
    expect(result.rows[0].gananciaSoles).toBe(200);
    expect(result.rows[0].margenPct).toBe(20.0);

    expect(result.totals.ventaSoles).toBe(1000);
    expect(result.totals.costoSoles).toBe(800);
    expect(result.totals.mermaSoles).toBe(50);
    expect(result.totals.gananciaSoles).toBe(150);
  });

  it('Merma VOIDED es excluida del total de merma', () => {
    const scraps: AluzincResumenScrap[] = [
      { scrapCostPEN: 100, status: 'ACTIVE' },
      { scrapCostPEN: 200, status: 'VOIDED' },
    ];

    const result = calculateAluzincResumen({
      sales: [],
      scraps,
      metallicCatalog,
      finishesMap,
    });

    expect(result.totals.mermaSoles).toBe(100);
  });

  it('Ventas no COMPLETED (QUOTATION/CANCELLED) son ignoradas', () => {
    const sales: AluzincResumenSale[] = [
      {
        status: 'QUOTATION',
        items: [
          {
            businessLine: 'metallic-roofing',
            sku: 'COB030AZUL',
            quantity: 100,
            unitValue: 10,
            baseCost: 8,
          },
        ],
      },
      {
        status: 'CANCELLED',
        items: [
          {
            businessLine: 'metallic-roofing',
            sku: 'COB030AZUL',
            quantity: 100,
            unitValue: 10,
            baseCost: 8,
          },
        ],
      },
    ];

    const result = calculateAluzincResumen({
      sales,
      scraps: [],
      metallicCatalog,
      finishesMap,
    });

    expect(result.rows).toHaveLength(0);
    expect(result.totals.ventaSoles).toBe(0);
    expect(result.totals.costoSoles).toBe(0);
  });

  it('Filtro por fecha respeta range.from y range.to', () => {
    const range = { from: 1000, to: 2000 };
    const sales: AluzincResumenSale[] = [
      {
        status: 'COMPLETED',
        timestamp: 999, // fuera
        items: [
          {
            businessLine: 'metallic-roofing',
            sku: 'COB030AZUL',
            quantity: 10,
            unitValue: 10,
            baseCost: 5,
          },
        ],
      },
      {
        status: 'COMPLETED',
        timestamp: 1500, // dentro
        items: [
          {
            businessLine: 'metallic-roofing',
            sku: 'COB030AZUL',
            quantity: 20,
            unitValue: 10,
            baseCost: 5,
          },
        ],
      },
    ];

    const result = calculateAluzincResumen({
      sales,
      scraps: [],
      metallicCatalog,
      finishesMap,
      range,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].ventaSoles).toBe(200);
    expect(result.rows[0].costoSoles).toBe(100);
  });
});
