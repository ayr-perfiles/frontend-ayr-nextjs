import { getFinishMeta, formatFinishChip, CoilFinish } from './finishService';

describe('getFinishMeta', () => {
  const finishes: CoilFinish[] = [
    { id: 'ALU-ROJO', label: 'Rojo', active: true, lines: [], tipo: 'Prepintado', color: 'Rojo' },
    { id: 'ALU-NATURAL', label: 'Natural', active: true, lines: [], tipo: 'Natural', color: '-' },
    { id: 'GALV', label: 'Galvanizado', active: true, lines: [], tipo: 'Galvanizado', color: '-' },
    { id: 'MISSING-META', label: 'Missing', active: true, lines: [] }
  ];

  it('devuelve {tipo, color} correctamente para un finish existente', () => {
    expect(getFinishMeta('ALU-ROJO', finishes)).toEqual({ tipo: 'Prepintado', color: 'Rojo' });
    expect(getFinishMeta('ALU-NATURAL', finishes)).toEqual({ tipo: 'Natural', color: '-' });
    expect(getFinishMeta('GALV', finishes)).toEqual({ tipo: 'Galvanizado', color: '-' });
  });

  it('devuelve fallback cuando el finish no existe en el array', () => {
    expect(getFinishMeta('NO-EXISTE', finishes)).toEqual({ tipo: 'Desconocido', color: 'Desconocido' });
  });

  it('devuelve fallback cuando el finishId es null o undefined', () => {
    expect(getFinishMeta(null, finishes)).toEqual({ tipo: 'Desconocido', color: 'Desconocido' });
    expect(getFinishMeta(undefined, finishes)).toEqual({ tipo: 'Desconocido', color: 'Desconocido' });
  });

  it('devuelve fallback individual cuando el finish existe pero no tiene metadata', () => {
    expect(getFinishMeta('MISSING-META', finishes)).toEqual({ tipo: 'Desconocido', color: 'Desconocido' });
  });
});

describe('formatFinishChip', () => {
  it('devuelve "Tipo · Color" cuando color está presente y no es "-"', () => {
    expect(formatFinishChip('Prepintado', 'Blanco')).toBe('Prepintado · Blanco');
  });

  it('devuelve "Tipo" cuando color es "-"', () => {
    expect(formatFinishChip('Galvanizado', '-')).toBe('Galvanizado');
    expect(formatFinishChip('Natural', '-')).toBe('Natural');
  });

  it('devuelve null cuando metadata falta o es desconocida', () => {
    expect(formatFinishChip(undefined, undefined)).toBeNull();
    expect(formatFinishChip('Desconocido', 'Desconocido')).toBeNull();
  });
});
