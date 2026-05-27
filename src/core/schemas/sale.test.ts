import { describe, it, expect } from 'vitest';
import { saleCustomerSchema } from './sale';

describe('saleCustomerSchema', () => {
  describe('customerName', () => {
    it('acepta nombre válido', () => {
      const r = saleCustomerSchema.safeParse({ customerName: 'EMPRESA SAC', documentNumber: '20123456789' });
      expect(r.success).toBe(true);
    });

    it('rechaza nombre vacío', () => {
      const r = saleCustomerSchema.safeParse({ customerName: '', documentNumber: '20123456789' });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].path).toContain('customerName');
    });
  });

  describe('documentNumber', () => {
    it('acepta RUC de 11 dígitos', () => {
      const r = saleCustomerSchema.safeParse({ customerName: 'EMPRESA', documentNumber: '20123456789' });
      expect(r.success).toBe(true);
    });

    it('acepta DNI de 8 dígitos', () => {
      const r = saleCustomerSchema.safeParse({ customerName: 'PERSONA', documentNumber: '12345678' });
      expect(r.success).toBe(true);
    });

    it('rechaza documento de 7 dígitos', () => {
      const r = saleCustomerSchema.safeParse({ customerName: 'PERSONA', documentNumber: '1234567' });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].path).toContain('documentNumber');
    });

    it('rechaza documento de 12 dígitos', () => {
      const r = saleCustomerSchema.safeParse({ customerName: 'EMPRESA', documentNumber: '201234567890' });
      expect(r.success).toBe(false);
    });

    it('rechaza documento con letras', () => {
      const r = saleCustomerSchema.safeParse({ customerName: 'EMPRESA', documentNumber: '20123ABC789' });
      expect(r.success).toBe(false);
      if (!r.success) {
        const issue = r.error.issues.find(i => i.path.includes('documentNumber'));
        expect(issue).toBeDefined();
      }
    });

    it('rechaza documento vacío', () => {
      const r = saleCustomerSchema.safeParse({ customerName: 'EMPRESA', documentNumber: '' });
      expect(r.success).toBe(false);
    });
  });
});
