import { describe, it, expect } from 'vitest';
import { coilInvoiceHeaderSchema, coilEntryFormSchema } from './coil';

// ─── coilInvoiceHeaderSchema ──────────────────────────────────────────────────

describe('coilInvoiceHeaderSchema', () => {
  const validHeader = {
    docType: 'LOCAL' as const,
    providerDoc: '20123456789',
    providerName: 'PROVEEDOR SAC',
    invoiceDate: '2025-01-15',
    invoiceNumber: 'F001-001',
    currency: 'PEN' as const,
    exchangeRate: 1,
  };

  it('acepta cabecera válida en soles', () => {
    expect(coilInvoiceHeaderSchema.safeParse(validHeader).success).toBe(true);
  });

  it('acepta origen extranjero con tipo de cambio', () => {
    const r = coilInvoiceHeaderSchema.safeParse({ ...validHeader, docType: 'TAX_ID', currency: 'USD', exchangeRate: 3.75 });
    expect(r.success).toBe(true);
  });

  it('rechaza fecha vacía', () => {
    const r = coilInvoiceHeaderSchema.safeParse({ ...validHeader, invoiceDate: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toContain('invoiceDate');
  });

  it('rechaza tipo de cambio <= 0', () => {
    const r = coilInvoiceHeaderSchema.safeParse({ ...validHeader, exchangeRate: 0 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toContain('exchangeRate');
  });

  it('rechaza tipo de cambio negativo', () => {
    const r = coilInvoiceHeaderSchema.safeParse({ ...validHeader, exchangeRate: -1 });
    expect(r.success).toBe(false);
  });

  it('rechaza docType inválido', () => {
    const r = coilInvoiceHeaderSchema.safeParse({ ...validHeader, docType: 'OTRO' });
    expect(r.success).toBe(false);
  });

  it('rechaza moneda inválida', () => {
    const r = coilInvoiceHeaderSchema.safeParse({ ...validHeader, currency: 'EUR' });
    expect(r.success).toBe(false);
  });

  it('acepta campos opcionales vacíos', () => {
    const r = coilInvoiceHeaderSchema.safeParse({ ...validHeader, providerDoc: '', providerName: '', invoiceNumber: '' });
    expect(r.success).toBe(true);
  });
});

// ─── coilEntryFormSchema ──────────────────────────────────────────────────────

describe('coilEntryFormSchema', () => {
  const validEntry = {
    coilId: 'F001-BOB001',
    weight: 500,
    width: 1200,
    thickness: 0.45,
    value: 2500,
  };

  it('acepta entrada válida con números', () => {
    expect(coilEntryFormSchema.safeParse(validEntry).success).toBe(true);
  });

  it('coerce string numérico a number', () => {
    const r = coilEntryFormSchema.safeParse({ ...validEntry, weight: '500', width: '1200', thickness: '0.45', value: '2500' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.weight).toBe(500);
      expect(r.data.width).toBe(1200);
      expect(r.data.thickness).toBe(0.45);
      expect(r.data.value).toBe(2500);
    }
  });

  it('rechaza coilId vacío', () => {
    const r = coilEntryFormSchema.safeParse({ ...validEntry, coilId: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toContain('coilId');
  });

  it('rechaza peso = 0', () => {
    const r = coilEntryFormSchema.safeParse({ ...validEntry, weight: 0 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toContain('weight');
  });

  it('rechaza peso vacío (string vacío coerce a 0)', () => {
    const r = coilEntryFormSchema.safeParse({ ...validEntry, weight: '' });
    expect(r.success).toBe(false);
  });

  it('rechaza ancho negativo', () => {
    const r = coilEntryFormSchema.safeParse({ ...validEntry, width: -1 });
    expect(r.success).toBe(false);
  });

  it('rechaza espesor = 0', () => {
    const r = coilEntryFormSchema.safeParse({ ...validEntry, thickness: 0 });
    expect(r.success).toBe(false);
  });

  it('rechaza valor negativo', () => {
    const r = coilEntryFormSchema.safeParse({ ...validEntry, value: -100 });
    expect(r.success).toBe(false);
  });
});
