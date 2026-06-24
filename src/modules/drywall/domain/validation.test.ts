import { describe, it, expect } from 'vitest';
import { validateCoilData, validateProductionInput } from './validation';

describe('validateCoilData', () => {
  const validCoil = {
    initialWeight: 1000,
    masterWidth: 1220,
    pricePerKg: 3.5,
    thickness: 0.45,
  };

  it('no lanza error con datos completamente válidos', () => {
    expect(() => validateCoilData(validCoil)).not.toThrow();
  });

  it('lanza error si initialWeight es 0', () => {
    expect(() => validateCoilData({ ...validCoil, initialWeight: 0 })).toThrow(
      /peso inicial/i
    );
  });

  it('lanza error si initialWeight es negativo', () => {
    expect(() => validateCoilData({ ...validCoil, initialWeight: -100 })).toThrow(
      /peso inicial/i
    );
  });

  it('lanza error si masterWidth es 0', () => {
    expect(() => validateCoilData({ ...validCoil, masterWidth: 0 })).toThrow(
      /ancho maestro/i
    );
  });

  it('lanza error si masterWidth no está definido', () => {
    const { masterWidth: _omit, ...withoutWidth } = validCoil;
    expect(() => validateCoilData(withoutWidth as typeof validCoil)).toThrow(
      /ancho maestro/i
    );
  });

  it('lanza error si pricePerKg es 0', () => {
    expect(() => validateCoilData({ ...validCoil, pricePerKg: 0 })).toThrow(
      /precio por kg/i
    );
  });

  it('lanza error si pricePerKg es negativo', () => {
    expect(() => validateCoilData({ ...validCoil, pricePerKg: -1 })).toThrow(
      /precio por kg/i
    );
  });

  it('no lanza error si thickness es undefined (campo opcional)', () => {
    const { thickness: _omit, ...withoutThickness } = validCoil;
    expect(() => validateCoilData(withoutThickness)).not.toThrow();
  });

  it('lanza error si thickness está presente y es 0', () => {
    expect(() => validateCoilData({ ...validCoil, thickness: 0 })).toThrow(
      /espesor/i
    );
  });

  it('lanza error si thickness está por debajo del rango permitido (< 0.3mm)', () => {
    expect(() => validateCoilData({ ...validCoil, thickness: 0.2 })).toThrow(
      /fuera del rango/i
    );
  });

  it('lanza error si thickness está por encima del rango permitido (> 1.5mm)', () => {
    expect(() => validateCoilData({ ...validCoil, thickness: 1.6 })).toThrow(
      /fuera del rango/i
    );
  });

  it('acepta thickness en el límite inferior permitido (0.3mm)', () => {
    expect(() => validateCoilData({ ...validCoil, thickness: 0.3 })).not.toThrow();
  });

  it('acepta thickness en el límite superior permitido (1.5mm)', () => {
    expect(() => validateCoilData({ ...validCoil, thickness: 1.5 })).not.toThrow();
  });
});

describe('validateProductionInput', () => {
  // calculateExpectedPiecesByDensity(1000, 121, 0.45, 3.0) = 779
  // maxAllowedPieces = ceil(779 × 1.05) = ceil(817.95) = 818
  const baseParams = {
    requestedPieces: 700,
    stripWeight: 1000,
    stripWidth: 121,
    thickness: 0.45,
    pieceLength: 3.0,
    densityFactor: 0.00785,
  };

  it('no lanza error cuando las piezas solicitadas son válidas', () => {
    expect(() => validateProductionInput(baseParams)).not.toThrow();
  });

  it('retorna expectedPieces calculadas por la fórmula de densidad', () => {
    const result = validateProductionInput(baseParams);
    expect(result.expectedPieces).toBe(779);
  });

  it('retorna maxAllowedPieces con tolerancia del 5% aplicada', () => {
    const result = validateProductionInput(baseParams);
    expect(result.maxAllowedPieces).toBe(818);
    expect(result.maxAllowedPieces).toBe(Math.ceil(result.expectedPieces * 1.05));
  });

  it('no lanza error cuando se solicitan exactamente el máximo permitido', () => {
    expect(() =>
      validateProductionInput({ ...baseParams, requestedPieces: 818 })
    ).not.toThrow();
  });

  it('lanza error cuando se supera el límite físico en una pieza', () => {
    expect(() =>
      validateProductionInput({ ...baseParams, requestedPieces: 819 })
    ).toThrow(/Límite Físico Excedido/);
  });

  it('el mensaje de error incluye el número de piezas solicitado', () => {
    expect(() =>
      validateProductionInput({ ...baseParams, requestedPieces: 900 })
    ).toThrow('900');
  });

  it('el mensaje de error incluye el máximo permitido', () => {
    expect(() =>
      validateProductionInput({ ...baseParams, requestedPieces: 900 })
    ).toThrow('818');
  });

  it('acepta producción inferior al máximo sin restricción', () => {
    const result = validateProductionInput({ ...baseParams, requestedPieces: 1 });
    expect(result.expectedPieces).toBeGreaterThan(0);
  });
});
