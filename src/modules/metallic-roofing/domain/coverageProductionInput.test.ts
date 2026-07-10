import { describe, it, expect } from 'vitest';
import { parsePositiveNumberInput, computeCoverageDeclaredMl } from './coverageProductionInput';

describe('parsePositiveNumberInput', () => {
  it('parsea un número positivo válido', () => {
    expect(parsePositiveNumberInput('10')).toBe(10);
    expect(parsePositiveNumberInput('3.6')).toBe(3.6);
  });

  it('string vacío → null', () => {
    expect(parsePositiveNumberInput('')).toBeNull();
    expect(parsePositiveNumberInput('   ')).toBeNull();
  });

  it('cero → null', () => {
    expect(parsePositiveNumberInput('0')).toBeNull();
  });

  it('negativo → null', () => {
    expect(parsePositiveNumberInput('-5')).toBeNull();
  });

  it('no-numérico → null', () => {
    expect(parsePositiveNumberInput('abc')).toBeNull();
  });
});

describe('computeCoverageDeclaredMl', () => {
  it('cantidad × longitud → ML', () => {
    expect(computeCoverageDeclaredMl(10, 3.6)).toBe(36);
  });

  it('decimales → redondeo a 4 decimales', () => {
    expect(computeCoverageDeclaredMl(3, 3.333)).toBe(9.999);
    expect(computeCoverageDeclaredMl(7, 1.23456)).toBe(8.6419); // 8.64192 -> toFixed(4)
  });

  it('cantidad null (longitud vacía en el form) → null', () => {
    expect(computeCoverageDeclaredMl(null, 3.6)).toBeNull();
  });

  it('longitud null (longitud vacía en el form) → null', () => {
    expect(computeCoverageDeclaredMl(10, null)).toBeNull();
  });

  it('ambos null → null', () => {
    expect(computeCoverageDeclaredMl(null, null)).toBeNull();
  });

  it('cantidad 0 → null (no autocompletar con 0)', () => {
    expect(computeCoverageDeclaredMl(0, 3.6)).toBeNull();
  });

  it('longitud 0 → null (no autocompletar con 0)', () => {
    expect(computeCoverageDeclaredMl(10, 0)).toBeNull();
  });

  it('negativos → null', () => {
    expect(computeCoverageDeclaredMl(-1, 3.6)).toBeNull();
    expect(computeCoverageDeclaredMl(10, -3.6)).toBeNull();
  });
});
