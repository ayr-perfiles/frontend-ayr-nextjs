import { describe, it, expect } from 'vitest';
import { coilEntryFormSchema } from './coil';

describe('coilEntryFormSchema', () => {
  it('acepta un objeto válido con todos los campos', () => {
    const validCoil = {
      coilId: 'BOB-001',
      weight: 5000,
      width: 1200,
      thickness: 0.45,
      finish: 'GALVANIZADO',
      value: 15000,
    };
    const result = coilEntryFormSchema.safeParse(validCoil);
    expect(result.success).toBe(true);
  });

  it('rechaza si falta el acabado (finish)', () => {
    const invalidCoil = {
      coilId: 'BOB-001',
      weight: 5000,
      width: 1200,
      thickness: 0.45,
      value: 15000,
    };
    const result = coilEntryFormSchema.safeParse(invalidCoil);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('finish');
    }
  });

  it('rechaza valores no positivos', () => {
    const invalidCoil = {
      coilId: 'BOB-001',
      weight: -10,
      width: 1200,
      thickness: 0.45,
      finish: 'GALVANIZADO',
      value: 15000,
    };
    const result = coilEntryFormSchema.safeParse(invalidCoil);
    expect(result.success).toBe(false);
  });

  it('coerza strings a números correctamente', () => {
    const stringCoil = {
      coilId: 'BOB-001',
      weight: '5000.50',
      width: '1200',
      thickness: '0.45',
      finish: 'GALVANIZADO',
      value: '15000',
    };
    const result = coilEntryFormSchema.safeParse(stringCoil);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.weight).toBe(5000.50);
      expect(result.data.thickness).toBe(0.45);
    }
  });
});
