import { describe, it, expect } from 'vitest';
import { assertCoilFinishCompatible } from './finishCompat';
import { CoilFinish } from '../services/finishService';

describe('assertCoilFinishCompatible', () => {
  const mockFinishes: CoilFinish[] = [
    { id: 'GALVANIZADO', label: 'GALVANIZADO', active: true, lines: ['drywall'] },
    { id: 'ALUZINC', label: 'ALUZINC', active: true, lines: ['metallic-roofing'] },
    { id: 'INACTIVO', label: 'INACTIVO', active: false, lines: ['drywall'] },
    { id: 'MIXTO', label: 'MIXTO', active: true, lines: ['drywall', 'metallic-roofing'] },
  ];

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
