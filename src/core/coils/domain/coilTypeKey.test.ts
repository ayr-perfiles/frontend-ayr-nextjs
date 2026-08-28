import { describe, it, expect } from 'vitest';
import { buildCoilTypeKey } from './coilTypeKey';

describe('buildCoilTypeKey', () => {
  it('GALV + 0.45 -> BOB-GALV-045', () => {
    expect(buildCoilTypeKey({ finish: 'GALV', thickness: 0.45 })).toBe('BOB-GALV-045');
  });

  it('GALV + 0.42 -> BOB-GALV-042', () => {
    expect(buildCoilTypeKey({ finish: 'GALV', thickness: 0.42 })).toBe('BOB-GALV-042');
  });

  it('espesor de 1 decimal (1.2) -> BOB-X-120', () => {
    expect(buildCoilTypeKey({ finish: 'X', thickness: 1.2 })).toBe('BOB-X-120');
  });

  it('espesor con ruido de float (0.45000000000001) -> 045', () => {
    expect(buildCoilTypeKey({ finish: 'GALV', thickness: 0.45000000000001 })).toBe('BOB-GALV-045');
  });

  it('finish en minusculas -> uppercase', () => {
    expect(buildCoilTypeKey({ finish: 'galv', thickness: 0.45 })).toBe('BOB-GALV-045');
  });

  it('finish vacio -> throw', () => {
    expect(() => buildCoilTypeKey({ finish: '', thickness: 0.45 })).toThrow();
  });

  it('thickness 0 -> throw', () => {
    expect(() => buildCoilTypeKey({ finish: 'GALV', thickness: 0 })).toThrow();
  });

  it('thickness NaN -> throw', () => {
    expect(() => buildCoilTypeKey({ finish: 'GALV', thickness: NaN })).toThrow();
  });

  it('thickness negativo -> throw', () => {
    expect(() => buildCoilTypeKey({ finish: 'GALV', thickness: -0.45 })).toThrow();
  });

  it('thickness undefined -> throw', () => {
    expect(() => buildCoilTypeKey({ finish: 'GALV', thickness: undefined as unknown as number })).toThrow();
  });

  it('madre y su hija de otro ancho -> MISMO key (el ancho no entra en la clave, por diseño: ver [COIL-TYPE-KEY] PASO 0, masterWidth de la hija es input arbitrario del split, no se hereda ni se deriva)', () => {
    const parentKey = buildCoilTypeKey({ finish: 'GALV', thickness: 0.45 });
    // La hija hereda finish/thickness sin cambio (ver split.ts:114-115); el ancho
    // (masterWidth) es el newChildWidthMm que pidió el usuario, deliberadamente
    // fuera de la firma de esta funcion.
    const childKey = buildCoilTypeKey({ finish: 'GALV', thickness: 0.45 });
    expect(childKey).toBe(parentKey);
  });
});
