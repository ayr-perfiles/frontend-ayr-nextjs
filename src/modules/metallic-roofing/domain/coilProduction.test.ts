import { describe, it, expect } from 'vitest';
import { calcProductionFromCoils } from './coilProduction';
import type { CoilProductionInput, TargetSkuInfo } from './coilProduction';

// Constantes reutilizadas
const COBERTURA: TargetSkuInfo = { productKind: 'COBERTURA_ML', lengthM: null };
const PLANCHA_3_6: TargetSkuInfo = { productKind: 'PLANCHA_UND', lengthM: 3.6 };

function makeCoil(overrides: Partial<CoilProductionInput> = {}): CoilProductionInput {
  return {
    coilId: 'BOB-TEST',
    declared: 100,
    thicknessMm: 0.45,
    masterWidth: 1200,
    pricePerKg: 3.5,
    coilDensityFactor: 0.00785,
    ...overrides,
  };
}

describe('calcProductionFromCoils — COBERTURA_ML (1 bobina)', () => {
  it('spec base: 100 ML, 0.45mm, 1200mm, δ=0.00785, S/.3.5/kg', () => {
    // weight = 100 × 0.45 × 1200 × 0.00785 = 423.9 kg
    // cost   = 423.9 × 3.5 = 1483.65
    const r = calcProductionFromCoils(COBERTURA, [makeCoil({ declared: 100 })]);

    expect(r.totalMl).toBe(100);
    expect(r.cantidadProducida).toBe(100);
    expect(r.pesoTotalKg).toBeCloseTo(423.9, 2);
    expect(r.costoTotalPEN).toBeCloseTo(1483.65, 2);
    expect(r.costoUnitarioPEN).toBeCloseTo(14.8365, 4);
    expect(r.perCoilBreakdown).toHaveLength(1);
    expect(r.perCoilBreakdown[0].mlFromCoil).toBe(100);
  });

  it('fórmula usa masterWidth de la BOBINA, no el ancho del producto (833mm)', () => {
    // La función no recibe "ancho del producto" — solo masterWidth de la bobina.
    // Este test documenta que 1200mm es lo que se usa.
    const r = calcProductionFromCoils(COBERTURA, [makeCoil({ masterWidth: 1200, declared: 50 })]);
    const weightExpected = 50 * 0.45 * 1200 * 0.00785;
    expect(r.pesoTotalKg).toBeCloseTo(weightExpected, 3);
  });

  it('cantidadProducida = totalMl para COBERTURA_ML', () => {
    const r = calcProductionFromCoils(COBERTURA, [makeCoil({ declared: 73 })]);
    expect(r.cantidadProducida).toBe(r.totalMl);
  });
});

describe('calcProductionFromCoils — 2 bobinas con distinto pricePerKg/masterWidth/densityFactor', () => {
  // Bobina A: 50 ML, 0.45mm, 1200mm, S/.3.5/kg, δ=0.00785
  //   weight_A = 50 × 0.45 × 1200 × 0.00785 = 211.95 kg
  //   cost_A   = 211.95 × 3.5 = 741.825
  //
  // Bobina B: 80 ML, 0.45mm, 1100mm, S/.4.2/kg, δ=0.00785
  //   weight_B = 80 × 0.45 × 1100 × 0.00785 = 310.86 kg
  //   cost_B   = 310.86 × 4.2 = 1305.612
  //
  // Totales:
  //   totalMl = 130, pesoTotal = 522.81, costoTotal = 2047.437
  //   costoUnitario = 2047.437 / 130 ≈ 15.749515

  const coilA = makeCoil({ coilId: 'BOB-A', declared: 50, masterWidth: 1200, pricePerKg: 3.5 });
  const coilB = makeCoil({ coilId: 'BOB-B', declared: 80, masterWidth: 1100, pricePerKg: 4.2 });

  it('totalMl = suma de mlFromCoil de ambas bobinas', () => {
    const r = calcProductionFromCoils(COBERTURA, [coilA, coilB]);
    expect(r.totalMl).toBe(130);
  });

  it('pesoTotalKg = suma proporcional por bobina', () => {
    const r = calcProductionFromCoils(COBERTURA, [coilA, coilB]);
    expect(r.pesoTotalKg).toBeCloseTo(522.81, 2);
  });

  it('costoUnitarioPEN es ponderado (no promedio simple)', () => {
    const r = calcProductionFromCoils(COBERTURA, [coilA, coilB]);
    // Si fuera promedio simple: (741.825/50 + 1305.612/80) / 2 ≠ resultado correcto
    // Correcto: 2047.437 / 130 ≈ 15.749515
    expect(r.costoUnitarioPEN).toBeCloseTo(15.749515, 4);
  });

  it('perCoilBreakdown tiene 2 entradas con datos por bobina', () => {
    const r = calcProductionFromCoils(COBERTURA, [coilA, coilB]);
    expect(r.perCoilBreakdown).toHaveLength(2);
    expect(r.perCoilBreakdown[0].coilId).toBe('BOB-A');
    expect(r.perCoilBreakdown[0].mlFromCoil).toBe(50);
    expect(r.perCoilBreakdown[1].coilId).toBe('BOB-B');
    expect(r.perCoilBreakdown[1].mlFromCoil).toBe(80);
  });

  it('costoTotalPEN = suma de costPEN individuales', () => {
    const r = calcProductionFromCoils(COBERTURA, [coilA, coilB]);
    const sumBreakdown = r.perCoilBreakdown.reduce((acc, b) => acc + b.costPEN, 0);
    expect(r.costoTotalPEN).toBeCloseTo(sumBreakdown, 2);
  });
});

describe('calcProductionFromCoils — PLANCHA_UND', () => {
  // 10 piezas × 3.6m = 36 ML
  // weight = 36 × 0.45 × 1200 × 0.00785 = 152.604 kg
  // cost   = 152.604 × 3.5 = 534.114
  // costoUnitario = 534.114 / 10 piezas = 53.4114

  it('declared=10 piezas, lengthM=3.6 → 36 ML, costo/pieza correcto', () => {
    const r = calcProductionFromCoils(PLANCHA_3_6, [
      makeCoil({ declared: 10 }),
    ]);

    expect(r.totalMl).toBeCloseTo(36, 3);
    expect(r.cantidadProducida).toBe(10);  // piezas
    expect(r.pesoTotalKg).toBeCloseTo(152.604, 3);
    expect(r.costoTotalPEN).toBeCloseTo(534.114, 3);
    expect(r.costoUnitarioPEN).toBeCloseTo(53.4114, 4);
  });

  it('mlFromCoil = piezas × lengthM', () => {
    const r = calcProductionFromCoils(PLANCHA_3_6, [makeCoil({ declared: 5 })]);
    expect(r.perCoilBreakdown[0].mlFromCoil).toBeCloseTo(18, 3);
  });

  it('cantidadProducida = suma de piezas (no ML) para PLANCHA_UND', () => {
    const r = calcProductionFromCoils(PLANCHA_3_6, [
      makeCoil({ coilId: 'A', declared: 4 }),
      makeCoil({ coilId: 'B', declared: 6 }),
    ]);
    expect(r.cantidadProducida).toBe(10);
    expect(r.totalMl).toBeCloseTo(36, 2); // (4+6) × 3.6
  });

  it('PLANCHA_UND sin lengthM: lanza error', () => {
    expect(() =>
      calcProductionFromCoils({ productKind: 'PLANCHA_UND', lengthM: null }, [makeCoil()]),
    ).toThrow('longitud');
  });

  it('PLANCHA_UND con lengthM=0: lanza error', () => {
    expect(() =>
      calcProductionFromCoils({ productKind: 'PLANCHA_UND', lengthM: 0 }, [makeCoil()]),
    ).toThrow('longitud');
  });
});

describe('calcProductionFromCoils — validaciones de entrada', () => {
  it('sin bobinas: lanza error', () => {
    expect(() => calcProductionFromCoils(COBERTURA, [])).toThrow('al menos una bobina');
  });

  it('declared = 0: lanza error', () => {
    expect(() => calcProductionFromCoils(COBERTURA, [makeCoil({ declared: 0 })])).toThrow(
      'mayor a 0',
    );
  });

  it('declared negativo: lanza error', () => {
    expect(() => calcProductionFromCoils(COBERTURA, [makeCoil({ declared: -5 })])).toThrow(
      'mayor a 0',
    );
  });

  it('coilDensityFactor = 0: lanza error', () => {
    expect(() =>
      calcProductionFromCoils(COBERTURA, [makeCoil({ coilDensityFactor: 0 })]),
    ).toThrow('factor de densidad');
  });

  it('función no muta los inputs', () => {
    const coil = makeCoil({ declared: 50 });
    const before = { ...coil };
    calcProductionFromCoils(COBERTURA, [coil]);
    expect(coil).toEqual(before);
  });
});
