import { describe, it, expect } from 'vitest';
import { stockAdjustmentFormSchema } from './stockAdjustment';

const validEntry = {
  type: 'ENTRY' as const,
  quantity: '10',
  unitCost: '25.50',
  reason: 'Recepción OC-2025-001',
};

const validExit = {
  type: 'EXIT' as const,
  quantity: '5',
  unitCost: '',
  reason: 'Merma por transporte',
};

const validAdjustment = {
  type: 'ADJUSTMENT' as const,
  quantity: '100',
  unitCost: '',
  reason: 'Inventario físico enero',
};

describe('stockAdjustmentFormSchema', () => {
  describe('ENTRY', () => {
    it('acepta entrada válida con costo', () => {
      expect(stockAdjustmentFormSchema.safeParse(validEntry).success).toBe(true);
    });

    it('rechaza entrada sin costo unitario', () => {
      const r = stockAdjustmentFormSchema.safeParse({ ...validEntry, unitCost: '' });
      expect(r.success).toBe(false);
      if (!r.success) {
        const issue = r.error.issues.find(i => i.path.includes('unitCost'));
        expect(issue).toBeDefined();
      }
    });

    it('rechaza entrada con costo = 0', () => {
      const r = stockAdjustmentFormSchema.safeParse({ ...validEntry, unitCost: '0' });
      expect(r.success).toBe(false);
    });

    it('rechaza entrada con costo negativo', () => {
      const r = stockAdjustmentFormSchema.safeParse({ ...validEntry, unitCost: '-5' });
      expect(r.success).toBe(false);
    });
  });

  describe('EXIT', () => {
    it('acepta salida sin costo unitario', () => {
      expect(stockAdjustmentFormSchema.safeParse(validExit).success).toBe(true);
    });

    it('acepta salida ignorando el costo', () => {
      const r = stockAdjustmentFormSchema.safeParse({ ...validExit, unitCost: '99' });
      expect(r.success).toBe(true);
    });
  });

  describe('ADJUSTMENT', () => {
    it('acepta ajuste sin costo', () => {
      expect(stockAdjustmentFormSchema.safeParse(validAdjustment).success).toBe(true);
    });
  });

  describe('cantidad', () => {
    it('rechaza cantidad vacía', () => {
      const r = stockAdjustmentFormSchema.safeParse({ ...validExit, quantity: '' });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].path).toContain('quantity');
    });

    it('rechaza cantidad = 0', () => {
      const r = stockAdjustmentFormSchema.safeParse({ ...validExit, quantity: '0' });
      expect(r.success).toBe(false);
    });

    it('rechaza cantidad negativa', () => {
      const r = stockAdjustmentFormSchema.safeParse({ ...validExit, quantity: '-3' });
      expect(r.success).toBe(false);
    });

    it('acepta cantidad decimal', () => {
      const r = stockAdjustmentFormSchema.safeParse({ ...validExit, quantity: '2.5' });
      expect(r.success).toBe(true);
    });
  });

  describe('motivo', () => {
    it('rechaza motivo vacío', () => {
      const r = stockAdjustmentFormSchema.safeParse({ ...validExit, reason: '' });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].path).toContain('reason');
    });

    it('acepta motivo corto', () => {
      const r = stockAdjustmentFormSchema.safeParse({ ...validExit, reason: 'OK' });
      expect(r.success).toBe(true);
    });
  });

  describe('tipo', () => {
    it('rechaza tipo inválido', () => {
      const r = stockAdjustmentFormSchema.safeParse({ ...validExit, type: 'OTRO' });
      expect(r.success).toBe(false);
    });
  });
});
