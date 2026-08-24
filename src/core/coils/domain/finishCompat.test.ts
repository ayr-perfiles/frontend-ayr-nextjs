import { describe, it, expect } from 'vitest';
import { assertCoilFinishCompatible, getFinishIdsForLine } from './finishCompat';
import { CoilFinish } from '../services/finishService';

const mockFinishes: CoilFinish[] = [
  { id: 'GALVANIZADO', label: 'GALVANIZADO', active: true, lines: ['drywall'] },
  { id: 'ALUZINC', label: 'ALUZINC', active: true, lines: ['metallic-roofing'] },
  { id: 'INACTIVO', label: 'INACTIVO', active: false, lines: ['drywall'] },
  { id: 'MIXTO', label: 'MIXTO', active: true, lines: ['drywall', 'metallic-roofing'] },
];

describe('assertCoilFinishCompatible', () => {
  it('permite bobina GALVANIZADO para drywall', () => {
    const result = assertCoilFinishCompatible('GALVANIZADO', 'drywall', mockFinishes);
    expect(result.success).toBe(true);
  });

  it('rechaza bobina ALUZINC para drywall con error COIL_FINISH_MISMATCH', () => {
    const result = assertCoilFinishCompatible('ALUZINC', 'drywall', mockFinishes);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('COIL_FINISH_MISMATCH');
      expect(result.error.message).toContain('no es compatible');
    }
  });

  it('rechaza acabado inactivo con error COIL_FINISH_INACTIVE', () => {
    const result = assertCoilFinishCompatible('INACTIVO', 'drywall', mockFinishes);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('COIL_FINISH_INACTIVE');
    }
  });

  it('permite acabado mixto para ambas líneas', () => {
    expect(assertCoilFinishCompatible('MIXTO', 'drywall', mockFinishes).success).toBe(true);
    expect(assertCoilFinishCompatible('MIXTO', 'metallic-roofing', mockFinishes).success).toBe(true);
  });

  it('rechaza acabado inexistente con error COIL_FINISH_NOT_FOUND', () => {
    const result = assertCoilFinishCompatible('NO_EXISTE', 'drywall', mockFinishes);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('COIL_FINISH_NOT_FOUND');
    }
  });
});

describe('getFinishIdsForLine', () => {
  it("devuelve los finishes activos cuya 'lines' incluye la línea pedida", () => {
    expect(getFinishIdsForLine(mockFinishes, 'drywall')).toEqual(['GALVANIZADO', 'MIXTO']);
    expect(getFinishIdsForLine(mockFinishes, 'metallic-roofing')).toEqual(['ALUZINC', 'MIXTO']);
  });

  it('excluye un finish inactivo aunque su lines incluya la línea pedida', () => {
    // 'INACTIVO' tiene lines:['drywall'] pero active:false — no debe aparecer.
    const result = getFinishIdsForLine(mockFinishes, 'drywall');
    expect(result).not.toContain('INACTIVO');
  });

  it('excluye un finish con lines vacío', () => {
    const finishes: CoilFinish[] = [
      { id: 'SIN-LINEA', label: 'Sin línea', active: true, lines: [] },
      { id: 'GALV', label: 'Galvanizado', active: true, lines: ['drywall'] },
    ];
    expect(getFinishIdsForLine(finishes, 'drywall')).toEqual(['GALV']);
  });

  it('array de finishes vacío devuelve []', () => {
    expect(getFinishIdsForLine([], 'drywall')).toEqual([]);
  });

  it('replica el shape real de prod: drywall -> solo GALV, metallic-roofing -> los 8 ALZ-*', () => {
    const prodShapedFinishes: CoilFinish[] = [
      { id: 'ALZ-AZUL-5002', label: 'ALUZINC AZUL 5002', active: true, lines: ['metallic-roofing'] },
      { id: 'ALZ-BLANCO', label: 'ALUZINC BLANCO', active: true, lines: ['metallic-roofing'] },
      { id: 'ALZ-GRIS-7040', label: 'ALUZINC GRIS 7040', active: true, lines: ['metallic-roofing'] },
      { id: 'ALZ-NATURAL', label: 'ALUZINC NATURAL', active: true, lines: ['metallic-roofing'] },
      { id: 'ALZ-ROJO-3002', label: 'ALUZINC ROJO 3002', active: true, lines: ['metallic-roofing'] },
      { id: 'ALZ-ROJO-3020', label: 'ALUZINC ROJO 3020', active: true, lines: ['metallic-roofing'] },
      { id: 'ALZ-VERDE-6002', label: 'ALUZINC VERDE 6002', active: true, lines: ['metallic-roofing'] },
      { id: 'ALZ-VERDE-6035', label: 'ALUZINC VERDE 6035', active: true, lines: ['metallic-roofing'] },
      { id: 'GALV', label: 'GALVANIZADO', active: true, lines: ['drywall'] },
    ];
    expect(getFinishIdsForLine(prodShapedFinishes, 'drywall')).toEqual(['GALV']);
    expect(getFinishIdsForLine(prodShapedFinishes, 'metallic-roofing')).toEqual([
      'ALZ-AZUL-5002',
      'ALZ-BLANCO',
      'ALZ-GRIS-7040',
      'ALZ-NATURAL',
      'ALZ-ROJO-3002',
      'ALZ-ROJO-3020',
      'ALZ-VERDE-6002',
      'ALZ-VERDE-6035',
    ]);
  });
});
