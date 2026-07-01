import { describe, it, expect } from 'vitest';
import { validateCoilRow, buildInvoicesPayload, normalizeFecha, normalizeCurrency, parseWeightToKg, CoilRow, TOKEN_TO_FINISH, WEIGHT_MIN_KG, WEIGHT_MAX_KG } from '@/core/coils/bulkUploadLogic';

const liveFinishKeys = ['GALV', 'ALU-NATURAL', 'ALU-AZUL', 'ALU-BLANCO', 'ALU-ROJO', 'ALU-VERDE', 'ALU-GRIS'];

describe('bulkUploadLogic', () => {

  describe('TOKEN_TO_FINISH', () => {
    it('should have correct mapping for GALV without mapping to GALVANIZADO', () => {
      expect(TOKEN_TO_FINISH['GALV']).toBe('GALV');
    });
  });

  describe('normalizeFecha', () => {
    it('should correctly parse ambiguous DD/MM dates with day <= 12', () => {
      expect(normalizeFecha("01/04/2026")).toBe("2026-04-01"); 
      expect(normalizeFecha("05/06/2026")).toBe("2026-06-05"); 
    });
  });

  describe('normalizeCurrency', () => {
    it('should return USD for DOLLAR variants and PEN for SOLES variants', () => {
      expect(normalizeCurrency('US DOLLAR')).toBe('USD');
      expect(normalizeCurrency('DOLARES')).toBe('USD');
      expect(normalizeCurrency('USD')).toBe('USD');
      expect(normalizeCurrency('SOLES')).toBe('PEN');
      expect(normalizeCurrency('PEN')).toBe('PEN');
      expect(normalizeCurrency('S/.')).toBe('PEN');
    });

    it('should return null for unrecognized currency (no silent fallback)', () => {
      expect(normalizeCurrency('EUROS')).toBe(null);
      expect(normalizeCurrency('XYZ')).toBe(null);
      expect(normalizeCurrency('')).toBe(null);
    });
  });

  describe('parseWeightToKg', () => {
    it('should parse KILOGRAMO correctly', () => {
      expect(parseWeightToKg('3.708,', 'KILOGRAMO')).toBe(3708);
      expect(parseWeightToKg('4000', 'KG')).toBe(4000);
    });

    it('should parse TONELADA by multiplying by 1000', () => {
      expect(parseWeightToKg('3.5', 'TONELADA')).toBe(3500);
      expect(parseWeightToKg('11.214', 'TONELADA')).toBe(11214); 
    });

    it('should return null for non-convertible units', () => {
      expect(parseWeightToKg('5', 'ROLLO')).toBeNull();
      expect(parseWeightToKg('10', 'UNIDAD')).toBeNull();
      expect(parseWeightToKg('500', '')).toBeNull();
      expect(parseWeightToKg('500', 'UNKNOWN')).toBeNull();
    });

    it('should return null for invalid numbers', () => {
      expect(parseWeightToKg('abc', 'TONELADA')).toBeNull();
    });
  });

  describe('validateCoilRow', () => {
    const validBase: CoilRow = {
      serie: 'F001', nroDoc: '123', fecha: '2026-06-30',
      provider: 'Test', providerDoc: '111',
      currencyRaw: 'US DOLLAR', exchangeRateRaw: '3.5',
      finish: 'GALV', widthRaw: '1200', thicknessRaw: '0.45', 
      weightRaw: '5000', unitRaw: 'KILOGRAMO', weightKgRaw: '', valueRaw: '5500'
    };

    it('should return valid for a complete USD row', () => {
      const res = validateCoilRow(validBase, liveFinishKeys);
      expect(res.valid).toBe(true);
      expect(res.errors.length).toBe(0);
    });

    it('should return invalid if finish is empty', () => {
      const res = validateCoilRow({ ...validBase, finish: '' }, liveFinishKeys);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('Acabado no seleccionado');
    });

    it('should return invalid if finish is GALVANIZADO (not in live keys)', () => {
      const res = validateCoilRow({ ...validBase, finish: 'GALVANIZADO' }, liveFinishKeys);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('Acabado inválido o no existe');
    });

    it('should return invalid if widthRaw is empty or 0', () => {
      const res1 = validateCoilRow({ ...validBase, widthRaw: '' }, liveFinishKeys);
      expect(res1.valid).toBe(false);
      expect(res1.errors.some(e => e.toLowerCase().includes('ancho'))).toBe(true);
      
      const res2 = validateCoilRow({ ...validBase, widthRaw: '0' }, liveFinishKeys);
      expect(res2.valid).toBe(false);
      expect(res2.errors.some(e => e.toLowerCase().includes('ancho'))).toBe(true);
    });

    it('should return invalid if thicknessRaw is 0 or negative', () => {
      const res1 = validateCoilRow({ ...validBase, thicknessRaw: '0' }, liveFinishKeys);
      expect(res1.valid).toBe(false);
      expect(res1.errors.some(e => e.toLowerCase().includes('espesor'))).toBe(true);

      const res2 = validateCoilRow({ ...validBase, thicknessRaw: '-0.45' }, liveFinishKeys);
      expect(res2.valid).toBe(false);
      expect(res2.errors.some(e => e.toLowerCase().includes('espesor'))).toBe(true);
    });

    it('should return invalid if effective weight cannot be resolved', () => {
      const res = validateCoilRow({ ...validBase, unitRaw: 'ROLLO' }, liveFinishKeys);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.toLowerCase().includes('peso inválido'))).toBe(true);
    });

    it('should return valid if unit is ROLLO but weightKgRaw is provided in range', () => {
      const res = validateCoilRow({ ...validBase, unitRaw: 'ROLLO', weightKgRaw: '5000' }, liveFinishKeys);
      expect(res.valid).toBe(true);
    });

    it('should favor weightKgRaw over parsed weightRaw', () => {
      const res = validateCoilRow({ ...validBase, weightRaw: '5000', unitRaw: 'KILOGRAMO', weightKgRaw: '4000' }, liveFinishKeys);
      expect(res.valid).toBe(true);
    });

    // --- WEIGHT RANGE TESTS ---
    it('should return invalid for weightKg 500 (out of range)', () => {
      const res = validateCoilRow({ ...validBase, weightRaw: '500' }, liveFinishKeys);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('fuera de rango esperado'))).toBe(true);
    });

    it('should return invalid for weightKg 11.214 (without comma -> 11.214 kg out of range)', () => {
      // BOMBA A TRAPADA
      const res = validateCoilRow({ ...validBase, weightRaw: '11.214', unitRaw: 'KILOGRAMO' }, liveFinishKeys);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('fuera de rango esperado'))).toBe(true);
    });

    it('should return invalid for weightKg 11214000 (TON mal)', () => {
      const res = validateCoilRow({ ...validBase, weightRaw: '11214', unitRaw: 'TONELADA' }, liveFinishKeys);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('fuera de rango esperado'))).toBe(true);
    });

    it('should return valid for weightKg 3500', () => {
      const res = validateCoilRow({ ...validBase, weightRaw: '3500', unitRaw: 'KILOGRAMO' }, liveFinishKeys);
      expect(res.valid).toBe(true);
    });

    it('should return valid for weightKg 3708 (real format "3.708," KILOGRAMO)', () => {
      const res = validateCoilRow({ ...validBase, weightRaw: '3.708,', unitRaw: 'KILOGRAMO' }, liveFinishKeys);
      expect(res.valid).toBe(true);
    });

    it('should return valid for exact borders and invalid for just outside', () => {
      expect(validateCoilRow({ ...validBase, weightRaw: '2000' }, liveFinishKeys).valid).toBe(true);
      expect(validateCoilRow({ ...validBase, weightRaw: '7000' }, liveFinishKeys).valid).toBe(true);
      expect(validateCoilRow({ ...validBase, weightRaw: '1999' }, liveFinishKeys).valid).toBe(false);
      expect(validateCoilRow({ ...validBase, weightRaw: '7001' }, liveFinishKeys).valid).toBe(false);
    });
    // --------------------------

    it('should return invalid if valueRaw is 0', () => {
      const res = validateCoilRow({ ...validBase, valueRaw: '0' }, liveFinishKeys);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.toLowerCase().includes('valor'))).toBe(true);
    });

    it('should return invalid for date 2026-13-45', () => {
      const res = validateCoilRow({ ...validBase, fecha: '2026-13-45' }, liveFinishKeys);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.toLowerCase().includes('fecha'))).toBe(true);
    });

    it('should return invalid for USD with exchangeRate out of bounds [2,7]', () => {
      const res = validateCoilRow({ ...validBase, currencyRaw: 'US DOLLAR', exchangeRateRaw: '9' }, liveFinishKeys);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.toLowerCase().includes('tipo de cambio'))).toBe(true);
    });

    it('should return invalid for USD if exchangeRateRaw is empty', () => {
      const res = validateCoilRow({ ...validBase, currencyRaw: 'US DOLLAR', exchangeRateRaw: '' }, liveFinishKeys);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.toLowerCase().includes('tipo de cambio vacío'))).toBe(true);
    });

    it('should return valid for PEN regardless of exchangeRate', () => {
      const res = validateCoilRow({ ...validBase, currencyRaw: 'SOLES', exchangeRateRaw: '999' }, liveFinishKeys);
      expect(res.valid).toBe(true);
    });

    it('should return invalid for unrecognized currency', () => {
      const res = validateCoilRow({ ...validBase, currencyRaw: 'EUROS' }, liveFinishKeys);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.toLowerCase().includes('moneda no reconocida'))).toBe(true);
    });
  });

  describe('buildInvoicesPayload', () => {
    it('should group 4 rows into 2 invoices and keep stable order', () => {
      const rows: CoilRow[] = [
        { serie: 'F001', nroDoc: '13070', fecha: '01/04/2026', provider: 'A', providerDoc: '1', currencyRaw: 'US DOLLAR', exchangeRateRaw: '3.5', finish: 'GALV', widthRaw: '1200', thicknessRaw: '0.45', weightRaw: '5000', unitRaw: 'KILOGRAMO', weightKgRaw: '', valueRaw: '5500' },
        { serie: 'F001', nroDoc: '13071', fecha: '2026-04-02', provider: 'A', providerDoc: '1', currencyRaw: 'SOLES', exchangeRateRaw: '0', finish: 'ALU-AZUL', widthRaw: '1219', thicknessRaw: '0.38', weightRaw: '4000', unitRaw: 'KILOGRAMO', weightKgRaw: '', valueRaw: '4400' },
        { serie: 'F001', nroDoc: '13070', fecha: '01/04/2026', provider: 'A', providerDoc: '1', currencyRaw: 'US DOLLAR', exchangeRateRaw: '3.5', finish: 'ALU-NATURAL', widthRaw: '1000', thicknessRaw: '0.40', weightRaw: '3', unitRaw: 'TONELADA', weightKgRaw: '', valueRaw: '3300' },
        { serie: 'F001', nroDoc: '13071', fecha: '2026-04-02', provider: 'A', providerDoc: '1', currencyRaw: 'SOLES', exchangeRateRaw: '0', finish: 'ALU-BLANCO', widthRaw: '1219', thicknessRaw: '0.38', weightRaw: '4000', unitRaw: 'KILOGRAMO', weightKgRaw: '', valueRaw: '4400' },
      ];

      const { invoices, invalidCount } = buildInvoicesPayload(rows, liveFinishKeys);
      expect(invalidCount).toBe(0);
      expect(invoices.length).toBe(2);
      
      // Invoice 1 (F001-13070)
      expect(invoices[0].serie).toBe('F001');
      expect(invoices[0].nroDoc).toBe('13070');
      expect(invoices[0].fecha).toBe('2026-04-01'); 
      expect(invoices[0].currency).toBe('USD');
      expect(invoices[0].exchangeRate).toBe(3.5);
      expect(invoices[0].coils.length).toBe(2);
      expect(invoices[0].coils[0].finish).toBe('GALV');
      expect(invoices[0].coils[0].weight).toBe(5000);
      expect(invoices[0].coils[1].finish).toBe('ALU-NATURAL');
      expect(invoices[0].coils[1].weight).toBe(3000); // 3 tons -> 3000 kg

      // Invoice 2 (F001-13071)
      expect(invoices[1].serie).toBe('F001');
      expect(invoices[1].nroDoc).toBe('13071');
      expect(invoices[1].fecha).toBe('2026-04-02'); 
      expect(invoices[1].currency).toBe('PEN');
      expect(invoices[1].exchangeRate).toBe(1); 
      expect(invoices[1].coils.length).toBe(2);
      expect(invoices[1].coils[0].finish).toBe('ALU-AZUL');
    });

    it('should parse numbers and formats robustly in original currency and apply weightKgRaw override', () => {
      const rows: CoilRow[] = [
        {
          serie: 'F002', nroDoc: '999', fecha: '30/06/2026', provider: 'B', providerDoc: '2',
          currencyRaw: 'DOLARES', exchangeRateRaw: '3,5000',
          finish: 'ALU-VERDE', widthRaw: '1220', thicknessRaw: '0,28', weightRaw: '3.708,50', unitRaw: 'KILOGRAMO', weightKgRaw: '3500.5', valueRaw: '2.862,58'
        }
      ];

      const { invoices } = buildInvoicesPayload(rows, liveFinishKeys);
      expect(invoices[0].currency).toBe('USD');
      expect(invoices[0].exchangeRate).toBe(3.5);
      expect(invoices[0].coils[0].width).toBe(1220);
      expect(invoices[0].coils[0].thickness).toBe(0.28);
      expect(invoices[0].coils[0].weight).toBe(3500.5); // override takes precedence
      expect(invoices[0].coils[0].value).toBe(2862.58);
    });

    it('should strictly round raw value floats to 2 decimal places (accounting truth)', () => {
      const rawRows: CoilRow[] = [
        {
          serie: 'F001', nroDoc: '999', fecha: '2026-06-30', provider: 'A', providerDoc: '1', currencyRaw: 'USD', exchangeRateRaw: '3.5',
          finish: 'ALU-VERDE', widthRaw: '1220', thicknessRaw: '0,28', weightRaw: '3000', unitRaw: 'KILOGRAMO', weightKgRaw: '', valueRaw: '3564.5423728802'
        }
      ];
      const res = buildInvoicesPayload(rawRows, liveFinishKeys);
      expect(res.invalidCount).toBe(0);
      expect(res.invoices[0].coils[0].value).toBe(3564.54);
    });

    it('should exclude invalid rows based on validateCoilRow and count them', () => {
      const rows: CoilRow[] = [
        { serie: 'F003', nroDoc: '111', fecha: '2026-06-30', provider: 'A', providerDoc: '1', currencyRaw: 'USD', exchangeRateRaw: '3.5', finish: 'GALV', widthRaw: '1200', thicknessRaw: '0.45', weightRaw: '5000', unitRaw: 'KILOGRAMO', weightKgRaw: '', valueRaw: '5500' },
        { serie: 'F003', nroDoc: '111', fecha: '2026-06-30', provider: 'A', providerDoc: '1', currencyRaw: 'USD', exchangeRateRaw: '3.5', finish: 'GALV', widthRaw: '0', thicknessRaw: '0.45', weightRaw: '5000', unitRaw: 'KILOGRAMO', weightKgRaw: '', valueRaw: '5500' }, 
        { serie: 'F003', nroDoc: '111', fecha: '2026-06-30', provider: 'A', providerDoc: '1', currencyRaw: 'USD', exchangeRateRaw: '3.5', finish: 'GALV', widthRaw: '1200', thicknessRaw: '0.45', weightRaw: '5000', unitRaw: 'KILOGRAMO', weightKgRaw: '', valueRaw: '5500' },
        { serie: 'F003', nroDoc: '222', fecha: '2026-13-45', provider: 'A', providerDoc: '1', currencyRaw: 'USD', exchangeRateRaw: '3.5', finish: 'GALV', widthRaw: '1200', thicknessRaw: '0.45', weightRaw: '5000', unitRaw: 'KILOGRAMO', weightKgRaw: '', valueRaw: '5500' }, 
        { serie: 'F003', nroDoc: '333', fecha: '2026-06-30', provider: 'A', providerDoc: '1', currencyRaw: 'EUROS', exchangeRateRaw: '3.5', finish: 'GALV', widthRaw: '1200', thicknessRaw: '0.45', weightRaw: '5000', unitRaw: 'KILOGRAMO', weightKgRaw: '', valueRaw: '5500' },
        { serie: 'F003', nroDoc: '444', fecha: '2026-06-30', provider: 'A', providerDoc: '1', currencyRaw: 'USD', exchangeRateRaw: '', finish: 'GALV', widthRaw: '1200', thicknessRaw: '0.45', weightRaw: '5000', unitRaw: 'KILOGRAMO', weightKgRaw: '', valueRaw: '5500' } // invalid USD exchange rate empty
      ];

      const { invoices, invalidCount } = buildInvoicesPayload(rows, liveFinishKeys);
      expect(invalidCount).toBe(4); // width, date, currency, exchangeRate empty
      expect(invoices.length).toBe(1); 
      
      expect(invoices[0].nroDoc).toBe('111');
      expect(invoices[0].coils.length).toBe(2); 
    });
  });
});
