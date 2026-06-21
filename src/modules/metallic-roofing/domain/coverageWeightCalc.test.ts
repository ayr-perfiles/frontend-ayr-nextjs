import { describe, it, expect } from 'vitest';
import { calcCoverageWeightKg } from './coverageWeightCalc';

// ─── Datos de producto del catálogo (post-migración P-M1) ──────────────────

const COB030ROJO = {
  family: 'COBERTURA' as const,
  unit: 'METRO' as const,
  thicknessMm: 0.30,
  widthMm: 1200,
  densityFactor: 0.008,    // prepintado
  lengthM: null,
  colorFinish: 'ROJO',
};

const COB040ROJO = {
  family: 'COBERTURA' as const,
  unit: 'METRO' as const,
  thicknessMm: 0.40,
  widthMm: 1200,
  densityFactor: 0.008,    // prepintado
  lengthM: null,
  colorFinish: 'ROJO',
};

const COB040NATURAL = {
  family: 'COBERTURA' as const,
  unit: 'METRO' as const,
  thicknessMm: 0.40,
  widthMm: 1200,
  densityFactor: 0.00785,  // natural/galv
  lengthM: null,
  colorFinish: '',
};

const PL040ROJO6M = {
  family: 'PLANCHA' as const,
  unit: 'PIEZA' as const,
  thicknessMm: 0.40,
  widthMm: 1200,
  densityFactor: 0.008,
  lengthM: 6.0,
  colorFinish: 'ROJO',
};

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('calcCoverageWeightKg — COBERTURA_ML', () => {
  it('COB030ROJO × 1ML = 2.88 kg', () => {
    const r = calcCoverageWeightKg({ ...COB030ROJO, quantity: 1 });
    expect(r.pesoKg).toBeCloseTo(2.88, 4);
    expect(r.metrosTotales).toBe(1);
    expect(r.factorUsado).toBe(0.008);
  });

  it('COB040ROJO × 1ML ≈ 3.84 kg (backtest ~3.6 S/kg @ S/14/ML)', () => {
    const r = calcCoverageWeightKg({ ...COB040ROJO, quantity: 1 });
    expect(r.pesoKg).toBeCloseTo(3.84, 4);
    expect(r.metrosTotales).toBe(1);
  });

  it('COB040ROJO × 10ML = 38.4 kg', () => {
    const r = calcCoverageWeightKg({ ...COB040ROJO, quantity: 10 });
    expect(r.pesoKg).toBeCloseTo(38.4, 3);
    expect(r.metrosTotales).toBe(10);
  });

  it('COB040NATURAL × 1ML ≈ 3.768 kg (natural, factor 0.00785)', () => {
    const r = calcCoverageWeightKg({ ...COB040NATURAL, quantity: 1 });
    expect(r.pesoKg).toBeCloseTo(3.768, 3);
    expect(r.factorUsado).toBe(0.00785);
  });
});

describe('calcCoverageWeightKg — PLANCHA_UND', () => {
  it('PLANCHA 0.40 × 1200 × 6m, cantidad 1 = 23.04 kg', () => {
    const r = calcCoverageWeightKg({ ...PL040ROJO6M, quantity: 1 });
    expect(r.pesoKg).toBeCloseTo(23.04, 3);
    expect(r.metrosTotales).toBeCloseTo(6.0, 3);
  });

  it('PLANCHA × 2 UND = 46.08 kg, 12 metrosTotales', () => {
    const r = calcCoverageWeightKg({ ...PL040ROJO6M, quantity: 2 });
    expect(r.pesoKg).toBeCloseTo(46.08, 3);
    expect(r.metrosTotales).toBeCloseTo(12.0, 3);
  });

  it('PLANCHA sin lengthM → pesoKg null', () => {
    const r = calcCoverageWeightKg({ ...PL040ROJO6M, quantity: 1, lengthM: null });
    expect(r.pesoKg).toBeNull();
    expect(r.metrosTotales).toBeNull();
    expect(r.factorUsado).toBe(0.008);
  });
});

describe('calcCoverageWeightKg — ACCESSORY / RAW_COIL', () => {

  it('BOBINA → pesoKg null', () => {
    const r = calcCoverageWeightKg({
      family: 'BOBINA' as any,
      unit: 'TONELADA',
      quantity: 1,
      thicknessMm: 0.45,
      widthMm: 1200,
      densityFactor: null,
      lengthM: null,
      colorFinish: '',
    });
    expect(r.pesoKg).toBeNull();
    expect(r.factorUsado).toBeNull();
  });
});

describe('calcCoverageWeightKg — edge cases', () => {
  it('densityFactor null → pesoKg null (metadata no migrada aún)', () => {
    const r = calcCoverageWeightKg({ ...COB040ROJO, quantity: 1, densityFactor: null });
    expect(r.pesoKg).toBeNull();
  });

  it('densityFactor 0 → pesoKg null (valor inválido)', () => {
    const r = calcCoverageWeightKg({ ...COB040ROJO, quantity: 1, densityFactor: 0 });
    expect(r.pesoKg).toBeNull();
  });

  it('widthMm override (no 1200): COB040ROJO widthMm=1050 × 1ML', () => {
    const r = calcCoverageWeightKg({ ...COB040ROJO, quantity: 1, widthMm: 1050 });
    // 1 × 0.40 × 1050 × 0.008 = 3.36 kg
    expect(r.pesoKg).toBeCloseTo(3.36, 3);
  });

  it('COB035ROJO × 1ML = 3.36 kg', () => {
    const r = calcCoverageWeightKg({ ...COB030ROJO, quantity: 1, thicknessMm: 0.35 });
    // 1 × 0.35 × 1200 × 0.008 = 3.36 kg
    expect(r.pesoKg).toBeCloseTo(3.36, 3);
  });
});
