import { describe, it, expect } from 'vitest';
import { buildAluzincDetalle, deriveObservations, AluzincProductRead, AluzincSaleRead } from './aluzincDetalleLogic';
import type { ProductionLog } from '@/types';

describe('aluzincDetalleLogic', () => {
  it('fixture calcado del log real COT-FFA1-1289', () => {
    // COT-FFA1-1289 (COB030ROJO, 4 breakdown rows, mlProduced 821.5, Σweight 2282.31)
    // assert teoricoKg≈2405.35, desvioKg≈−123.04, desvioPct≈−0.0511

    const products = new Map([
      ['COB030ROJO', { thickness: 0.30, widthMm: 1220, densityFactor: 0.008 } as any]
    ]);
    
    const quotes = new Map([
      ['COT-FFA1-1289', { isFulfilled: true } as any]
    ]);

    const sales = [
      {
        id: '1',
        status: 'COMPLETED',
        customerDocument: 'DOC1',
        relatedQuotationId: 'COT-FFA1-1289',
        timestamp: { _seconds: 1785442746, _nanoseconds: 521000000 },
        items: [
          { sku: 'COB030ROJO', businessLine: 'metallic-roofing', quantity: 10, baseCost: 1, costSource: 'PRODUCTION', profit: 10, unitValue: 2 }
        ]
      }
    ];

    const logsMap = new Map([
      ['COT-FFA1-1289', [
        {
          sku: 'COB030ROJO', businessLine: 'metallic-roofing',
          mlProduced: 821.5,
          piecesProduced: 160,
          perCoilBreakdown: [
            { weightConsumedKg: 635.18 },
            { weightConsumedKg: 532.85 },
            { weightConsumedKg: 714.64 },
            { weightConsumedKg: 399.64 }
          ]
        }
      ] as any]
    ]);

    const res = buildAluzincDetalle(sales, quotes, logsMap, products, 'HISTORICO');
    expect(res.grupos.length).toBe(1);
    const grupo = res.grupos[0];
    
    expect(grupo.key).toBe('ROJO|0.30');
    expect(grupo.teoricoKg).toBeCloseTo(2405.35, 1);
    expect(grupo.consumidoKg).toBeCloseTo(2282.31, 2);
    expect(grupo.desvioKg).toBeCloseTo(-123.04, 1);
    expect(grupo.desvioPct).toBeCloseTo(-0.05115, 4);
    expect(grupo.montoVentas).toBe(20);
    
    const obs = deriveObservations(res.grupos);
    expect(obs.rendimientoGlobalPct).toBeCloseTo(-0.05115, 4);
  });

  it('fixture 2 grupos distinto color+espesor no se mezclan', () => {
    const products = new Map([
      ['COB030ROJO', { thickness: 0.30, widthMm: 1220, densityFactor: 0.008 } as any],
      ['COB040AZUL', { thickness: 0.40, widthMm: 1220, densityFactor: 0.008 } as any]
    ]);
    const quotes = new Map([
      ['COT-1', { isFulfilled: true } as any]
    ]);
    const sales = [
      {
        status: 'COMPLETED',
        customerDocument: 'DOC1',
        relatedQuotationId: 'COT-1',
        items: [
          { sku: 'COB030ROJO', businessLine: 'metallic-roofing', quantity: 10, costSource: 'PRODUCTION', profit: 5, baseCost: 1, unitValue: 2 },
          { sku: 'COB040AZUL', businessLine: 'metallic-roofing', quantity: 5, costSource: 'PRODUCTION', profit: 2, baseCost: 1, unitValue: 2 }
        ]
      }
    ];
    const logsMap = new Map([
      ['COT-1', [
        { sku: 'COB030ROJO', businessLine: 'metallic-roofing', mlProduced: 100, piecesProduced: 10, perCoilBreakdown: [{weightConsumedKg: 300}] },
        { sku: 'COB040AZUL', businessLine: 'metallic-roofing', mlProduced: 50, piecesProduced: 5, perCoilBreakdown: [{weightConsumedKg: 200}] }
      ] as any]
    ]);

    const res = buildAluzincDetalle(sales, quotes, logsMap, products, 'HISTORICO');
    expect(res.grupos.length).toBe(2);
    const keys = res.grupos.map(g => g.key).sort();
    expect(keys).toEqual(['AZUL|0.40', 'ROJO|0.30']);
  });

  it('fixture venta con quote isFulfilled==false -> EXCLUIDA', () => {
    const quotes = new Map([['COT-1', { isFulfilled: false } as any]]);
    const sales = [{ status: 'COMPLETED', customerDocument: 'DOC1', relatedQuotationId: 'COT-1', items: [{ sku: 'COB030ROJO', businessLine: 'metallic-roofing', quantity: 1, unitValue: 1, profit: 0, baseCost: 1 }] }];
    const products = new Map();
    const logsMap = new Map();

    const res = buildAluzincDetalle(sales, quotes, logsMap, products, 'HISTORICO');
    expect(res.grupos.length).toBe(0);
  });

  it('fixture item costSource=="PRODUCTION" vs !="PRODUCTION" -> obs #4 cuenta bien', () => {
    const products = new Map([['COB030ROJO', { thickness: 0.30, widthMm: 1220, densityFactor: 0.008 } as any]]);
    const quotes = new Map([['COT-1', { isFulfilled: true } as any]]);
    const sales = [{
      status: 'COMPLETED',
      customerDocument: 'DOC1',
      relatedQuotationId: 'COT-1',
      items: [
        { sku: 'COB030ROJO', businessLine: 'metallic-roofing', quantity: 1, costSource: 'PRODUCTION', unitValue: 1, profit: 0, baseCost: 1 },
        { sku: 'COB030ROJO', businessLine: 'metallic-roofing', quantity: 1, costSource: 'MANUAL', unitValue: 1, profit: 0, baseCost: 1 }
      ]
    }];
    const logsMap = new Map([['COT-1', []]]);

    const res = buildAluzincDetalle(sales, quotes, logsMap, products, 'HISTORICO');
    const obs = deriveObservations(res.grupos);
    expect(obs.ventasSinCostoProduccion).toBe(1); // 1 item without PRODUCTION
  });

  it('fixture calibre 0.26 en producto 0.30 -> obs #3 lo flaggea; 0.285 -> NO lo flaggea', () => {
    const products = new Map([
      ['COB030ROJO', { thickness: 0.30, widthMm: 1220, densityFactor: 0.008 } as any],
      ['COB030AZUL', { thickness: 0.30, widthMm: 1220, densityFactor: 0.008 } as any]
    ]);
    const quotes = new Map([['COT-1', { isFulfilled: true } as any]]);
    const sales = [{
      status: 'COMPLETED',
      customerDocument: 'DOC1',
      relatedQuotationId: 'COT-1',
      items: [
        { sku: 'COB030ROJO', businessLine: 'metallic-roofing', quantity: 1, unitValue: 1, profit: 0, baseCost: 1 },
        { sku: 'COB030AZUL', businessLine: 'metallic-roofing', quantity: 1, unitValue: 1, profit: 0, baseCost: 1 }
      ]
    }];
    // 0.30 nominal, limit is 0.28 to 0.32
    const logsMap = new Map([
      ['COT-1', [
        // Implicito = consumido / (ml * widthMm * densityFactor)
        // consumido = implicito * ml * widthMm * densityFactor
        // Para 0.26 implicito en 100 ml: 0.26 * 100 * 1220 * 0.008 = 253.76
        { sku: 'COB030ROJO', businessLine: 'metallic-roofing', mlProduced: 100, perCoilBreakdown: [{weightConsumedKg: 253.76}] },
        // Para 0.285 implicito en 100 ml: 0.285 * 100 * 1220 * 0.008 = 278.16
        { sku: 'COB030AZUL', businessLine: 'metallic-roofing', mlProduced: 100, perCoilBreakdown: [{weightConsumedKg: 278.16}] }
      ] as any]
    ]);

    const res = buildAluzincDetalle(sales, quotes, logsMap, products, 'HISTORICO');
    const obs = deriveObservations(res.grupos);
    
    expect(obs.gruposFueraDeCalibre).toContain('ROJO|0.30');
    expect(obs.gruposFueraDeCalibre).not.toContain('AZUL|0.30');
  });

  it('fixture venta con item.unitValue undefined -> montoVentas usa baseCost*qty+profit, NO da 0', () => {
    const products = new Map([
      ['COB030ROJO', { thickness: 0.30, widthMm: 1220, densityFactor: 0.008 } as any]
    ]);
    const quotes = new Map([['COT-2', { isFulfilled: true } as any]]);
    const sales = [
      {
        status: 'COMPLETED',
        customerDocument: 'DOC2',
        relatedQuotationId: 'COT-2',
        items: [
          // unitValue omitted (undefined), baseCost=1, quantity=10, profit=5 => amount = 1*10+5 = 15
          { sku: 'COB030ROJO', businessLine: 'metallic-roofing', quantity: 10, baseCost: 1, profit: 5 } as any
        ]
      }
    ];
    const logsMap = new Map([
      ['COT-2', [
        { sku: 'COB030ROJO', businessLine: 'metallic-roofing', mlProduced: 10, perCoilBreakdown: [{weightConsumedKg: 50}] }
      ] as any]
    ]);

    const res = buildAluzincDetalle(sales, quotes, logsMap, products, 'HISTORICO');
    expect(res.grupos.length).toBe(1);
    expect(res.grupos[0].montoVentas).toBe(15);
  });
  it('venta mixta: item drywall NO suma al grupo metallic ni crea grupo fantasma', () => {
    const products = new Map([
      ['COB030ROJO', { thickness: 0.30, widthMm: 1220, densityFactor: 0.008 } as any]
    ]);
    const quotes = new Map([['COT-MIX', { isFulfilled: true } as any]]);
    const sales = [
      {
        status: 'COMPLETED',
        customerDocument: 'DOC-MIX',
        relatedQuotationId: 'COT-MIX',
        items: [
          { sku: 'COB030ROJO', businessLine: 'metallic-roofing', quantity: 10, unitValue: 5, baseCost: 1, profit: 5, costSource: 'PRODUCTION' } as any,
          { sku: 'DRY-XXX', businessLine: 'drywall', quantity: 100, unitValue: 20, baseCost: 2, profit: 50 } as any
        ]
      }
    ];
    const logsMap = new Map([
      ['COT-MIX', [
        { sku: 'COB030ROJO', businessLine: 'metallic-roofing', mlProduced: 10, perCoilBreakdown: [{ weightConsumedKg: 20 }] }
      ] as any]
    ]);

    const res = buildAluzincDetalle(sales, quotes, logsMap, products, 'HISTORICO');
    
    expect(res.grupos.length).toBe(1);
    
    const grupo = res.grupos[0];
    expect(grupo.key).toBe('ROJO|0.30');
    expect(grupo.montoVentas).toBe(50);
    
    const obs = deriveObservations(res.grupos);
    expect(obs.gruposFueraDeCalibre).not.toContain('DESCONOCIDO');
  });

  it('BUG 1: rendimientoGlobalPct no debe inflarse por grupos blindados (sin teórico)', () => {
    const products = new Map([
      ['COB030ROJO', { thickness: 113504, widthMm: 1, densityFactor: 1 } as any],
      ['COB000NATURAL', { thickness: 0, widthMm: 1, densityFactor: 1 } as any] // sin dims
    ]);
    const quotes = new Map([['COT-1', { isFulfilled: true } as any]]);
    const sales = [{
      status: 'COMPLETED',
      customerDocument: 'DOC1',
      relatedQuotationId: 'COT-1',
      items: [
        { sku: 'COB030ROJO', businessLine: 'metallic-roofing', quantity: 1, costSource: 'PRODUCTION', unitValue: 1, profit: 0, baseCost: 1 },
        { sku: 'COB000NATURAL', businessLine: 'metallic-roofing', quantity: 1, costSource: 'PRODUCTION', unitValue: 1, profit: 0, baseCost: 1 }
      ]
    }];
    const logsMap = new Map([
      ['COT-1', [
        { sku: 'COB030ROJO', businessLine: 'metallic-roofing', mlProduced: 1, perCoilBreakdown: [{weightConsumedKg: 106178}] },
        { sku: 'COB000NATURAL', businessLine: 'metallic-roofing', mlProduced: 1, perCoilBreakdown: [{weightConsumedKg: 36085}] }
      ] as any]
    ]);

    const res = buildAluzincDetalle(sales, quotes, logsMap, products, 'HISTORICO');
    const obs = deriveObservations(res.grupos);
    
    // (106178 - 113504) / 113504 = -0.06454...
    expect(obs.rendimientoGlobalPct).toBeCloseTo(-0.0645, 3);
  });

  it('BUG 4: obs #4 cuenta ventas donde algún item metallic tenga costSource !== PRODUCTION (incluye N/A o undefined)', () => {
    const products = new Map([['COB030ROJO', { thickness: 0.30, widthMm: 1220, densityFactor: 0.008 } as any]]);
    const quotes = new Map([['COT-1', { isFulfilled: true } as any]]);
    const sales = [{
      status: 'COMPLETED',
      customerDocument: 'DOC1',
      relatedQuotationId: 'COT-1',
      items: [
        { sku: 'COB030ROJO', businessLine: 'metallic-roofing', quantity: 1, unitValue: 1, profit: 0, baseCost: 1 } // costSource undefined
      ]
    }];
    const logsMap = new Map([['COT-1', []]]);

    const res = buildAluzincDetalle(sales, quotes, logsMap, products, 'HISTORICO');
    const obs = deriveObservations(res.grupos);
    expect(obs.ventasSinCostoProduccion).toBeGreaterThanOrEqual(1);
  });

  it('grupo.ventasDetalle y logsDetalle contienen SOLO las ventas/logs del universo filtrado', () => {
    const products = new Map([['COB030ROJO', { thickness: 0.30, widthMm: 1220, densityFactor: 0.008 } as any]]);
    const quotes = new Map([['COT-1', { isFulfilled: true } as any]]);
    const sales = [
      {
        status: 'COMPLETED', documentNumber: 'BBV1-1', customerName: 'JOHN DOE', customerDocument: 'DOC1', relatedQuotationId: 'COT-1', isFulfilled: true,
        items: [{ sku: 'COB030ROJO', businessLine: 'metallic-roofing', quantity: 10, unitValue: 2, profit: 5, baseCost: 1, costSource: 'PRODUCTION' }]
      },
      {
        status: 'COMPLETED', documentNumber: 'BBV1-2', customerName: 'JANE DOE', customerDocument: 'DOC2',
        items: [{ sku: 'COB030ROJO', businessLine: 'metallic-roofing', quantity: 5, unitValue: 2, profit: 5, baseCost: 1, costSource: 'MANUAL' }]
      }
    ];
    const logsMap = new Map([
      ['COT-1', [
        { id: 'LOG-1', sku: 'COB030ROJO', businessLine: 'metallic-roofing', mlProduced: 10, perCoilBreakdown: [{ weightConsumedKg: 20, costPEN: 50 }] }
      ] as any]
    ]);

    const res = buildAluzincDetalle(sales as any, quotes, logsMap, products, 'HISTORICO');
    expect(res.grupos.length).toBe(1);
    const grupo = res.grupos[0];
    
    expect(grupo.ventasDetalle.length).toBe(1);
    expect(grupo.ventasDetalle[0].documentNumber).toBe('BBV1-1');
    const totalVentasPie = grupo.ventasDetalle.reduce((sum: number, v: any) => sum + v.ventaTotal, 0);
    expect(totalVentasPie).toBe(grupo.montoVentas);
    
    expect(grupo.logsDetalle.length).toBe(1);
    expect(grupo.logsDetalle[0].documentId).toBe('LOG-1');
  });

  it('RED: fixture ROJO|0.30 + ROJO|0.25 -> groupBy COLOR = 1 grupo ROJO (montos sumados, desvíoPct sobre teórico total)', () => {
    const products = new Map<string, AluzincProductRead>([
      ['COB030ROJO', { thickness: 0.30, widthMm: 1000, densityFactor: 0.008, sku: 'COB030ROJO', unit: 'PIEZA', family: 'COBERTURA', displayName: '', finish: '', active: true, avgCost: 0 }],
      ['COB025ROJO', { thickness: 0.25, widthMm: 1000, densityFactor: 0.008, sku: 'COB025ROJO', unit: 'PIEZA', family: 'COBERTURA', displayName: '', finish: '', active: true, avgCost: 0 }]
    ]);
    const quotes = new Map<string, AluzincSaleRead>([
      ['COT-RED', { isFulfilled: true, status: 'COMPLETED', customerDocument: 'DOC1' }]
    ]);
    const sales: AluzincSaleRead[] = [{
      status: 'COMPLETED', customerDocument: 'DOC1', relatedQuotationId: 'COT-RED',
      items: [
        { sku: 'COB030ROJO', businessLine: 'metallic-roofing', quantity: 1, unitValue: 100, profit: 20, baseCost: 80, costSource: 'PRODUCTION' },
        { sku: 'COB025ROJO', businessLine: 'metallic-roofing', quantity: 1, unitValue: 200, profit: 50, baseCost: 150, costSource: 'PRODUCTION' }
      ]
    }];
    const logsMap = new Map<string, ProductionLog[]>([
      ['COT-RED', [
        { id: 'L1', timestamp: new Date(), source: { type: 'QUOTE', id: 'S1' }, status: 'ACTIVE', sku: 'COB030ROJO', mlProduced: 100, piecesProduced: 10, perCoilBreakdown: [{ coilId: 'C1', weightConsumedKg: 250, costPEN: 0, mlFromCoil: 0 }], totalUsedWidth: 0, scrapWidth: 0, stripCost: 0, costPerPiece: 0, operatorId: '' },
        { id: 'L2', timestamp: new Date(), source: { type: 'QUOTE', id: 'S1' }, status: 'ACTIVE', sku: 'COB025ROJO', mlProduced: 200, piecesProduced: 20, perCoilBreakdown: [{ coilId: 'C2', weightConsumedKg: 420, costPEN: 0, mlFromCoil: 0 }], totalUsedWidth: 0, scrapWidth: 0, stripCost: 0, costPerPiece: 0, operatorId: '' }
      ]]
    ]);

    // Prueba default: COLOR_ESPESOR
    const resColorEspesor = buildAluzincDetalle(sales, quotes, logsMap, products, 'HISTORICO');
    expect(resColorEspesor.grupos.length).toBe(2);
    
    // Prueba COLOR
    const resColor = buildAluzincDetalle(sales, quotes, logsMap, products, 'HISTORICO', 'COLOR');
    expect(resColor.grupos.length).toBe(1);
    const g = resColor.grupos[0];
    
    expect(g.key).toBe('ROJO|VARIOS'); // O 'ROJO' según definamos, pero el assert asume que agrupa. Vamos a asumir 'ROJO' o simplemente verificamos suma:
    expect(g.color).toBe('ROJO');
    expect(g.montoVentas).toBe(300);
    expect(g.profitVentas).toBe(70);
    expect(g.mlProduced).toBe(300);
    expect(g.piezas).toBe(30);
    expect(g.consumidoKg).toBe(670); // 250 + 420
    expect(g.teoricoKg).toBe(640); // 240 + 400
    
    // Desvío combinado: desvioKg = 30. desvioPct = 30 / 640 = 0.046875
    expect(g.desvioKg).toBeCloseTo(30, 2);
    expect(g.desvioPct).toBeCloseTo(0.046875, 5);
    
    // Promedio de pcts no es igual al combinado:
    // Pct 1: 10/240 = 0.04166
    // Pct 2: 20/400 = 0.05
    // Promedio = 0.045833
    expect(g.desvioPct).not.toBeCloseTo((10/240 + 20/400) / 2, 5);

    // Calibre implícito = Σconsumido / Σ(ml * width * density)
    // Σ(ml*w*d) = 100*1000*0.008 + 200*1000*0.008 = 800 + 1600 = 2400
    // consumidoKg = 670
    // calibreImplicito = 670 / 2400 = 0.2791666...
    expect(g.calibreImplicito).toBeCloseTo(670 / 2400, 5);
    
    // Clientes unificados
    expect(g.clientes.size).toBe(1);
    
    // concatenados
    expect(g.ventasDetalle.length).toBe(2);
    expect(g.logsDetalle.length).toBe(2);
  });

  it('RED: fixture ROJO con SOLO 0.30 (2 ventas mismo espesor) en groupBy COLOR -> thicknessMm === 0.30', () => {
    const products = new Map<string, AluzincProductRead>([
      ['COB030ROJO', { thickness: 0.30, widthMm: 1000, densityFactor: 0.008, sku: 'COB030ROJO', unit: 'PIEZA', family: 'COBERTURA', displayName: '', finish: '', active: true, avgCost: 0 }]
    ]);
    const quotes = new Map<string, AluzincSaleRead>([
      ['COT-RED1', { isFulfilled: true, status: 'COMPLETED', customerDocument: 'DOC1' }]
    ]);
    const sales: AluzincSaleRead[] = [{
      status: 'COMPLETED', customerDocument: 'DOC1', relatedQuotationId: 'COT-RED1',
      items: [
        { sku: 'COB030ROJO', businessLine: 'metallic-roofing', quantity: 1, unitValue: 100, profit: 20, baseCost: 80, costSource: 'PRODUCTION' },
        { sku: 'COB030ROJO', businessLine: 'metallic-roofing', quantity: 2, unitValue: 100, profit: 40, baseCost: 160, costSource: 'PRODUCTION' }
      ]
    }];
    const logsMap = new Map<string, ProductionLog[]>([
      ['COT-RED1', [
        { id: 'L1', timestamp: new Date(), source: { type: 'QUOTE', id: 'S1' }, status: 'ACTIVE', sku: 'COB030ROJO', mlProduced: 100, piecesProduced: 10, perCoilBreakdown: [{ coilId: 'C1', weightConsumedKg: 250, costPEN: 0, mlFromCoil: 0 }], totalUsedWidth: 0, scrapWidth: 0, stripCost: 0, costPerPiece: 0, operatorId: '' }
      ]]
    ]);

    const resColor = buildAluzincDetalle(sales, quotes, logsMap, products, 'HISTORICO', 'COLOR');
    expect(resColor.grupos.length).toBe(1);
    const g = resColor.grupos[0];
    
    expect(g.key).toBe('ROJO|0.30'); // Grouping key gets updated to actual thickness in single thickness group
    expect(g.color).toBe('ROJO');
    expect(g.thicknessMm).toBe('0.30'); // Should display the single actual thickness
  });

  it('RED: obs #3 en modo COLOR con espesor único fuera de banda -> flaggea con etiqueta real', () => {
    const products = new Map<string, AluzincProductRead>([
      ['COB030ROJO', { thickness: 0.30, widthMm: 1000, densityFactor: 0.008, sku: 'COB030ROJO', unit: 'PIEZA', family: 'COBERTURA', displayName: '', finish: '', active: true, avgCost: 0 }]
    ]);
    const quotes = new Map<string, AluzincSaleRead>([
      ['COT-RED2', { isFulfilled: true, status: 'COMPLETED', customerDocument: 'DOC1' }]
    ]);
    const sales: AluzincSaleRead[] = [{
      status: 'COMPLETED', customerDocument: 'DOC1', relatedQuotationId: 'COT-RED2',
      items: [
        { sku: 'COB030ROJO', businessLine: 'metallic-roofing', quantity: 1, unitValue: 100, profit: 20, baseCost: 80, costSource: 'PRODUCTION' }
      ]
    }];
    const logsMap = new Map<string, ProductionLog[]>([
      ['COT-RED2', [
        // bobinas que despejan 0.26 (0.30 nominal).
        // calibreImplicito = consumidoKg / denominadorCalibre = 260 / (100 * 1000 * 0.008) = 260 / 800 = 0.325.
        // Wait, for thickness 0.26, consumido = ml * 1000 * 0.008 * 0.26 = 100 * 1000 * 0.008 * 0.26 = 800 * 0.26 = 208 kg.
        // Then calibreImplicito = 208 / 800 = 0.26
        // |0.26 - 0.30| = 0.04 > 0.02 -> flaggea.
        { id: 'L1', timestamp: new Date(), source: { type: 'QUOTE', id: 'S1' }, status: 'ACTIVE', sku: 'COB030ROJO', mlProduced: 100, piecesProduced: 10, perCoilBreakdown: [{ coilId: 'C1', weightConsumedKg: 208, costPEN: 0, mlFromCoil: 100 }], totalUsedWidth: 0, scrapWidth: 0, stripCost: 0, costPerPiece: 0, operatorId: '' }
      ]]
    ]);

    const resColor = buildAluzincDetalle(sales, quotes, logsMap, products, 'HISTORICO', 'COLOR');
    const obs = deriveObservations(resColor.grupos);
    expect(obs.gruposFueraDeCalibre).toContain('ROJO|0.30');
  });

  it('RED: obs #3 en modo COLOR multi-espesor -> thicknessMm VARIOS -> NO entra a obs#3', () => {
    const products = new Map<string, AluzincProductRead>([
      ['COB030ROJO', { thickness: 0.30, widthMm: 1000, densityFactor: 0.008, sku: 'COB030ROJO', unit: 'PIEZA', family: 'COBERTURA', displayName: '', finish: '', active: true, avgCost: 0 }],
      ['COB025ROJO', { thickness: 0.25, widthMm: 1000, densityFactor: 0.008, sku: 'COB025ROJO', unit: 'PIEZA', family: 'COBERTURA', displayName: '', finish: '', active: true, avgCost: 0 }]
    ]);
    const quotes = new Map<string, AluzincSaleRead>([
      ['COT-RED3', { isFulfilled: true, status: 'COMPLETED', customerDocument: 'DOC1' }]
    ]);
    const sales: AluzincSaleRead[] = [{
      status: 'COMPLETED', customerDocument: 'DOC1', relatedQuotationId: 'COT-RED3',
      items: [
        { sku: 'COB030ROJO', businessLine: 'metallic-roofing', quantity: 1, unitValue: 100, profit: 20, baseCost: 80, costSource: 'PRODUCTION' },
        { sku: 'COB025ROJO', businessLine: 'metallic-roofing', quantity: 1, unitValue: 100, profit: 20, baseCost: 80, costSource: 'PRODUCTION' }
      ]
    }];
    const logsMap = new Map<string, ProductionLog[]>([
      ['COT-RED3', [
        { id: 'L1', timestamp: new Date(), source: { type: 'QUOTE', id: 'S1' }, status: 'ACTIVE', sku: 'COB030ROJO', mlProduced: 100, piecesProduced: 10, perCoilBreakdown: [{ coilId: 'C1', weightConsumedKg: 208, costPEN: 0, mlFromCoil: 100 }], totalUsedWidth: 0, scrapWidth: 0, stripCost: 0, costPerPiece: 0, operatorId: '' },
        { id: 'L2', timestamp: new Date(), source: { type: 'QUOTE', id: 'S1' }, status: 'ACTIVE', sku: 'COB025ROJO', mlProduced: 100, piecesProduced: 10, perCoilBreakdown: [{ coilId: 'C2', weightConsumedKg: 208, costPEN: 0, mlFromCoil: 100 }], totalUsedWidth: 0, scrapWidth: 0, stripCost: 0, costPerPiece: 0, operatorId: '' }
      ]]
    ]);

    const resColor = buildAluzincDetalle(sales, quotes, logsMap, products, 'HISTORICO', 'COLOR');
    const obs = deriveObservations(resColor.grupos);
    expect(resColor.grupos[0].thicknessMm).toBe('VARIOS');
    expect(obs.gruposFueraDeCalibre).not.toContain('ROJO|VARIOS');
    expect(obs.gruposFueraDeCalibre).toHaveLength(0);
  });
});
