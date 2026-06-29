import { describe, it, expect } from 'vitest';

// Import from frontend (legacy)
import { calcProductionFromCoils as legacyCalc } from '../../../src/modules/metallic-roofing/domain/coilProduction';

// Import from backend (port)
import { calcProductionFromCoils as portCalc } from './coilProduction';

describe('Coil Production Parity (Frontend vs Backend)', () => {
  const assertParity = (targetSku: any, coilInputs: any[]) => {
    let legacyOutput, portOutput, legacyError, portError;

    try {
      legacyOutput = legacyCalc(targetSku, coilInputs);
    } catch (e: any) {
      legacyError = e.message;
    }

    try {
      portOutput = portCalc(targetSku, coilInputs);
    } catch (e: any) {
      portError = e.message;
    }

    if (legacyError || portError) {
      expect(portError).toBe(legacyError);
    } else {
      expect(portOutput).toEqual(legacyOutput);
    }
  };

  it('COBERTURA_ML - 1 bobina', () => {
    assertParity(
      { productKind: 'COBERTURA_ML', lengthM: null },
      [
        {
          coilId: 'BOB-1',
          declared: 100, // 100 ML
          thicknessMm: 0.2,
          masterWidth: 1200,
          pricePerKg: 3.5,
          coilDensityFactor: 0.00785,
        }
      ]
    );
  });

  it('PLANCHA_UND - 1 bobina', () => {
    assertParity(
      { productKind: 'PLANCHA_UND', lengthM: 3.6 },
      [
        {
          coilId: 'BOB-1',
          declared: 50, // 50 planchas
          thicknessMm: 0.22,
          masterWidth: 1200,
          pricePerKg: 4.0,
          coilDensityFactor: 0.00785,
        }
      ]
    );
  });

  it('COBERTURA_ML - 2 bobinas (costo ponderado)', () => {
    assertParity(
      { productKind: 'COBERTURA_ML', lengthM: null },
      [
        {
          coilId: 'BOB-1',
          declared: 100,
          thicknessMm: 0.2,
          masterWidth: 1200,
          pricePerKg: 3.5,
          coilDensityFactor: 0.00785,
        },
        {
          coilId: 'BOB-2',
          declared: 50,
          thicknessMm: 0.2,
          masterWidth: 1200,
          pricePerKg: 4.0,
          coilDensityFactor: 0.00785,
        }
      ]
    );
  });

  it('COBERTURA_ML - 3 bobinas con distintos densityFactor y prices (casos de borde)', () => {
    // Calculo a mano de la correcta proporcionalidad y redondeos
    // BOB-GALV:
    // Weight = 45.2 * 0.3 * 1220 * 0.00785 = 129.86412 => toFixed(4) = 129.8641
    // Cost = 129.8641 * 3.1415 = 407.96816915 => toFixed(4) = 407.9681
    // BOB-ALU:
    // Weight = 33.3 * 0.3 * 1200 * 0.008 = 95.904 => toFixed(4) = 95.9040
    // Cost = 95.904 * 4.5 = 431.568 => toFixed(4) = 431.5680
    // BOB-ALU-PRE:
    // Weight = 10 * 0.22 * 914 * 0.00782 = 15.724456 => toFixed(4) = 15.7245
    // Cost = 15.7245 * 5.0 = 78.6225 => toFixed(4) = 78.6225

    // TOTALS:
    // cantidadProducida = 45.2 + 33.3 + 10 = 88.5
    // pesoTotalKg = 129.8641 + 95.9040 + 15.7245 = 241.4926
    // costoTotalPEN = 407.9681 + 431.5680 + 78.6225 = 918.1586
    // costoUnitarioPEN = 918.1586 / 88.5 = 10.374673446... => toFixed(6) = 10.374673

    const inputs = [
        {
          coilId: 'BOB-GALV',
          declared: 45.2,
          thicknessMm: 0.3,
          masterWidth: 1220,
          pricePerKg: 3.1415,
          coilDensityFactor: 0.00785, // Galvanizado
        },
        {
          coilId: 'BOB-ALU',
          declared: 33.3,
          thicknessMm: 0.3,
          masterWidth: 1200,
          pricePerKg: 4.5,
          coilDensityFactor: 0.008, // Aluzinc Natural
        },
        {
          coilId: 'BOB-ALU-PRE',
          declared: 10,
          thicknessMm: 0.22,
          masterWidth: 914,
          pricePerKg: 5.0,
          coilDensityFactor: 0.00782, // Un tercer density factor distinto (ej: Prepintado)
        }
    ];

    assertParity({ productKind: 'COBERTURA_ML', lengthM: null }, inputs);

    // Y validamos la CORRECTITUD sobre la función importada de functions
    const result = portCalc({ productKind: 'COBERTURA_ML', lengthM: null }, inputs);

    expect(result.cantidadProducida).toBe(88.5);
    expect(result.pesoTotalKg).toBe(241.4926);
    expect(result.costoTotalPEN).toBe(918.1586);
    expect(result.costoUnitarioPEN).toBe(10.374673);

    expect(result.perCoilBreakdown).toEqual([
      { coilId: 'BOB-GALV', mlFromCoil: 45.2, weightConsumedKg: 129.8641, costPEN: 407.9681 },
      { coilId: 'BOB-ALU', mlFromCoil: 33.3, weightConsumedKg: 95.9040, costPEN: 431.5680 },
      { coilId: 'BOB-ALU-PRE', mlFromCoil: 10, weightConsumedKg: 15.7245, costPEN: 78.6225 }
    ]);
  });

  it('Errores de validación - Bobinas vacías', () => {
    assertParity(
      { productKind: 'COBERTURA_ML', lengthM: null },
      []
    );
  });

  it('Errores de validación - PLANCHA_UND sin lengthM', () => {
    assertParity(
      { productKind: 'PLANCHA_UND', lengthM: null },
      [
        {
          coilId: 'BOB-1',
          declared: 50,
          thicknessMm: 0.2,
          masterWidth: 1200,
          pricePerKg: 3.5,
          coilDensityFactor: 0.00785,
        }
      ]
    );
  });

  it('Errores de validación - declared 0', () => {
    assertParity(
      { productKind: 'COBERTURA_ML', lengthM: null },
      [
        {
          coilId: 'BOB-1',
          declared: 0,
          thicknessMm: 0.2,
          masterWidth: 1200,
          pricePerKg: 3.5,
          coilDensityFactor: 0.00785,
        }
      ]
    );
  });
});
