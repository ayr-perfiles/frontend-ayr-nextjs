import { describe, it, expect } from 'vitest';
import { computePricePerKg, validateAndCalculateSplit } from './coilPricing';

describe('computePricePerKg', () => {
  it('PEN directo: divide valor entre peso sin conversión', () => {
    expect(computePricePerKg(15000, 5000, 'PEN', 1)).toBeCloseTo(3, 5);
  });

  it('USD × TC: convierte a PEN antes de dividir', () => {
    // $4000 * 3.75 = S/15000 / 5000 kg = S/3.00/kg
    expect(computePricePerKg(4000, 5000, 'USD', 3.75)).toBeCloseTo(3, 5);
  });

  it('USD con TC = 1 (sin TC real): lanza error', () => {
    expect(() => computePricePerKg(4000, 5000, 'USD', 1)).toThrow('Tipo de cambio inválido');
  });

  it('USD con TC = 0: lanza error', () => {
    expect(() => computePricePerKg(4000, 5000, 'USD', 0)).toThrow('Tipo de cambio inválido');
  });

  it('USD con TC negativo: lanza error', () => {
    expect(() => computePricePerKg(4000, 5000, 'USD', -3.75)).toThrow('Tipo de cambio inválido');
  });

  it('peso 0: lanza error', () => {
    expect(() => computePricePerKg(15000, 0, 'PEN', 1)).toThrow('peso');
  });

  it('peso negativo: lanza error', () => {
    expect(() => computePricePerKg(15000, -100, 'PEN', 1)).toThrow('peso');
  });

  it('USD con TC válido: calcula con precisión 6 decimales', () => {
    const result = computePricePerKg(1000, 333, 'USD', 3.76);
    expect(result).toBe(Number(((1000 * 3.76) / 333).toFixed(6)));
  });
});

describe('validateAndCalculateSplit (slitting por ancho)', () => {
  // Caso base del spec: padre 1200mm / 1000kg, corte 800mm
  const parent1200 = { currentWeight: 1000, masterWidth: 1200, status: 'AVAILABLE' };

  it('spec: 1200mm/1000kg → corte 800mm = hija 800mm/667kg, padre 400mm/333kg', () => {
    const result = validateAndCalculateSplit(parent1200, 800);
    // childWeight = 1000 × (800/1200) = 666.6667
    expect(result.childWeight).toBeCloseTo(666.6667, 3);
    // newParentWeight = 1000 - childWeight = 333.3333
    expect(result.newParentWeight).toBeCloseTo(333.3333, 3);
    expect(result.newParentWidth).toBe(400);
    expect(result.newParentStatus).toBe('AVAILABLE');
  });

  it('peso proporcional: suma padre + hija = peso original', () => {
    const { childWeight, newParentWeight } = validateAndCalculateSplit(parent1200, 800);
    expect(Number((childWeight + newParentWeight).toFixed(4))).toBe(parent1200.currentWeight);
  });

  it('ancho hija + ancho padre = ancho maestro original', () => {
    const { newParentWidth } = validateAndCalculateSplit(parent1200, 800);
    expect(newParentWidth + 800).toBe(parent1200.masterWidth);
  });

  it('corte mínimo (1mm): padre conserva status AVAILABLE', () => {
    const { newParentStatus, newParentWidth } = validateAndCalculateSplit(parent1200, 1);
    expect(newParentWidth).toBe(1199);
    expect(newParentStatus).toBe('AVAILABLE');
  });

  it('corte = masterWidth: lanza error (estrictamente menor)', () => {
    expect(() => validateAndCalculateSplit(parent1200, 1200)).toThrow('estrictamente menor');
  });

  it('corte > masterWidth: lanza error', () => {
    expect(() => validateAndCalculateSplit(parent1200, 1500)).toThrow('estrictamente menor');
  });

  it('ancho de corte = 0: lanza error', () => {
    expect(() => validateAndCalculateSplit(parent1200, 0)).toThrow('mayor a 0');
  });

  it('ancho de corte negativo: lanza error', () => {
    expect(() => validateAndCalculateSplit(parent1200, -100)).toThrow('mayor a 0');
  });

  it('bobina SOLD: lanza error', () => {
    expect(() =>
      validateAndCalculateSplit({ currentWeight: 1000, masterWidth: 1200, status: 'SOLD' }, 600),
    ).toThrow('DISPONIBLES');
  });

  it('bobina IN_PROGRESS: lanza error', () => {
    expect(() =>
      validateAndCalculateSplit({ currentWeight: 1000, masterWidth: 1200, status: 'IN_PROGRESS' }, 600),
    ).toThrow('DISPONIBLES');
  });

  it('bobina SPLIT_PARENT: lanza error', () => {
    expect(() =>
      validateAndCalculateSplit({ currentWeight: 0, masterWidth: 600, status: 'SPLIT_PARENT' }, 100),
    ).toThrow('DISPONIBLES');
  });

  it('pricePerKg es inmutable: la función no toca el objeto padre', () => {
    const parent = { currentWeight: 1000, masterWidth: 1200, status: 'AVAILABLE' };
    validateAndCalculateSplit(parent, 800);
    expect(parent.currentWeight).toBe(1000);
    expect(parent.masterWidth).toBe(1200);
  });

  it('split simétrico 600/600: ambas mitades tienen el mismo peso', () => {
    const { childWeight, newParentWeight, newParentWidth } = validateAndCalculateSplit(
      parent1200,
      600,
    );
    expect(childWeight).toBeCloseTo(500, 3);
    expect(newParentWeight).toBeCloseTo(500, 3);
    expect(newParentWidth).toBe(600);
  });
});
