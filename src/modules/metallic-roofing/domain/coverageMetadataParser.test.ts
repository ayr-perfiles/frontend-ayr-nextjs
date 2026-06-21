import { describe, it, expect } from 'vitest';
import { parseCoverageMetadata } from './coverageMetadataParser';

describe('parseCoverageMetadata', () => {
  // ─── Ejemplos reales del spec ────────────────────────────────────────────────

  it('COB030ROJO → COBERTURA_ML, thick 0.30, ROJO', () => {
    const r = parseCoverageMetadata('COB030ROJO', 'COBERTURA DE ALUZINC 0.30MM COLOR ROJO');
    expect(r.family).toBe('COBERTURA');
    expect(r.productKind).toBe('COBERTURA_ML');
    expect(r.thicknessMm).toBeCloseTo(0.30);
    expect(r.colorFinish).toBe('ROJO');
    expect(r.widthMm).toBe(1200);
    expect(r.lengthM).toBeNull();
    expect(r.parseConfidence).toBe('high');
  });

  it('COB040NATURAL → COBERTURA_ML, thick 0.40, natural', () => {
    const r = parseCoverageMetadata('COB040NATURAL', 'COBERTURA TR4 0.40 NATURAL');
    expect(r.family).toBe('COBERTURA');
    expect(r.productKind).toBe('COBERTURA_ML');
    expect(r.thicknessMm).toBeCloseTo(0.40);
    expect(r.colorFinish).toBe('');
    expect(r.parseConfidence).toBe('high');
  });

  it('PL040RJ6MT → PLANCHA_UND, thick 0.40, ROJO (RJ alias), length 6.0', () => {
    const r = parseCoverageMetadata('PL040RJ6MT', 'PLANCHA RA-4 0.40x1.05x6000 ROJO');
    expect(r.family).toBe('PLANCHA');
    expect(r.productKind).toBe('PLANCHA_UND');
    expect(r.thicknessMm).toBeCloseTo(0.40);
    expect(r.colorFinish).toBe('ROJO');
    expect(r.lengthM).toBeCloseTo(6.0);
    expect(r.parseConfidence).toBe('high');
  });

  it('ACCES030ROJO → ACCESSORY (fuera de fórmula densidad)', () => {
    const r = parseCoverageMetadata('ACCES030ROJO', 'CUMBRERA 0.30 ROJO');
    expect(r.family).toBe('ACCESORIO');
    expect(r.productKind).toBe('ACCESSORY');
    expect(r.parseConfidence).toBe('high');
  });

  it('BOB045GALV → unparseable (se registra en inventario de bobinas, no en catálogo)', () => {
    const r = parseCoverageMetadata('BOB045GALV');
    expect(r.family).toBeNull();
    expect(r.productKind).toBeNull();
    expect(r.parseConfidence).toBe('unparseable');
    expect(r.notes).toContain('Código BOB... no corresponde al catálogo');
  });

  it('BOB28NAT → unparseable', () => {
    const r = parseCoverageMetadata('BOB28NAT');
    expect(r.family).toBeNull();
    expect(r.parseConfidence).toBe('unparseable');
  });

  // ─── Edge cases ──────────────────────────────────────────────────────────────

  it('SKU sin prefijo conocido → unparseable', () => {
    const r = parseCoverageMetadata('UPVC6MT', 'COBERTURA TC5 UPVC 6MT ROJO');
    expect(r.parseConfidence).toBe('unparseable');
    expect(r.family).toBeNull();
  });

  it('COB035ROJO → thick 0.35, ROJO', () => {
    const r = parseCoverageMetadata('COB035ROJO', 'COBERTURA TR4 0.35 ROJO');
    expect(r.thicknessMm).toBeCloseTo(0.35);
    expect(r.colorFinish).toBe('ROJO');
    expect(r.parseConfidence).toBe('high');
  });

  it('COB030AZUL → thick 0.30, AZUL', () => {
    const r = parseCoverageMetadata('COB030AZUL', 'COBERTURA TR4 0.30 AZUL');
    expect(r.colorFinish).toBe('AZUL');
    expect(r.parseConfidence).toBe('high');
  });

  it('PL040X6MT → PLANCHA, color viene del nombre (NATURAL)', () => {
    const r = parseCoverageMetadata('PL040X6MT', 'PLANCHA TR4 0.40 NATURAL 6MT');
    expect(r.family).toBe('PLANCHA');
    expect(r.thicknessMm).toBeCloseTo(0.40);
    expect(r.colorFinish).toBe('');
    expect(r.lengthM).toBeCloseTo(6.0);
    expect(r.parseConfidence).toBe('high');
  });

  it('SKU con espesor faltante → unparseable', () => {
    const r = parseCoverageMetadata('COBROJO');
    expect(r.parseConfidence).toBe('unparseable');
  });

  it('GALV en tail → natural (colorFinish vacío)', () => {
    const r = parseCoverageMetadata('COB035GALV', 'COBERTURA 0.35 GALV');
    expect(r.colorFinish).toBe('');
    expect(r.parseConfidence).toBe('high');
  });

  it('widthMm siempre es 1200 (default)', () => {
    const r = parseCoverageMetadata('COB030ROJO', 'COBERTURA 0.30 ROJO');
    expect(r.widthMm).toBe(1200);
  });

  it('PL030RJ6MT → length 6.0, ROJO desde alias RJ', () => {
    const r = parseCoverageMetadata('PL030RJ6MT', 'PLANCHA TR4 0.30 ROJO 6MT');
    expect(r.thicknessMm).toBeCloseTo(0.30);
    expect(r.colorFinish).toBe('ROJO');
    expect(r.lengthM).toBeCloseTo(6.0);
  });
});
