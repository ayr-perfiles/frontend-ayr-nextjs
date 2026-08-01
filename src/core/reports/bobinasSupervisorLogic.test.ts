import { describe, it, expect } from 'vitest';
import { 
  classifyBobina, 
  deriveMetrajeML, 
  buildBobinaRow, 
  buildSupervisorReport,
  normalizeInvoiceDate,
  filterByMonth
} from './bobinasSupervisorLogic';

describe('bobinasSupervisorLogic', () => {
  describe('classifyBobina', () => {
    it('classifies ABIERTA correctly', () => {
      expect(classifyBobina({ status: 'AVAILABLE', finish: 'ALZ-AZUL', isClosed: false, currentWeight: 100 })).toBe('ABIERTA');
      expect(classifyBobina({ status: 'AVAILABLE', finish: 'ALU-ROJO', isClosed: false, currentWeight: 100 })).toBe('ABIERTA');
    });

    it('classifies CERRADA correctly', () => {
      expect(classifyBobina({ status: 'AVAILABLE', finish: 'ALZ-AZUL', isClosed: true, currentWeight: 100, initialWeight: 100 })).toBe('CERRADA');
      expect(classifyBobina({ status: 'AVAILABLE', finish: 'ALZ-AZUL', isClosed: undefined, currentWeight: 100, initialWeight: 100 })).toBe('CERRADA');
    });

    it('returns null for VOIDED', () => {
      expect(classifyBobina({ status: 'VOIDED', finish: 'ALZ-AZUL', isClosed: false, currentWeight: 100 })).toBeNull();
    });

    it('returns null for GALV', () => {
      expect(classifyBobina({ status: 'AVAILABLE', finish: 'GALV', isClosed: false, currentWeight: 100 })).toBeNull();
    });
  });

  describe('deriveMetrajeML', () => {
    it('calculates correctly', () => {
      expect(deriveMetrajeML({ currentWeight: 1000, thickness: 0.5, masterWidth: 1220 }, 0.008)).toBeCloseTo(204.92, 2);
    });

    it('returns 0 if any factor is missing', () => {
      expect(deriveMetrajeML({ currentWeight: 1000, thickness: 0, masterWidth: 1220 }, 0.008)).toBe(0);
      expect(deriveMetrajeML({ currentWeight: 1000, thickness: 0.5, masterWidth: 0 }, 0.008)).toBe(0);
      expect(deriveMetrajeML({ currentWeight: 1000, thickness: 0.5, masterWidth: 1220 }, 0)).toBe(0);
    });
  });

  describe('normalizeInvoiceDate', () => {
    it('handles seconds', () => {
      const d = normalizeInvoiceDate({ seconds: 1781784000 });
      expect(d?.getUTCFullYear()).toBe(2026);
    });
    it('handles _seconds', () => {
      const d = normalizeInvoiceDate({ _seconds: 1781784000 });
      expect(d?.getUTCFullYear()).toBe(2026);
    });
    it('handles toDate()', () => {
      const d = normalizeInvoiceDate({ toDate: () => new Date('2026-06-15T12:00:00Z') });
      expect(d?.getUTCFullYear()).toBe(2026);
    });
    it('handles Date', () => {
      const d = normalizeInvoiceDate(new Date('2026-06-15T12:00:00Z'));
      expect(d?.getUTCFullYear()).toBe(2026);
    });
    it('handles missing', () => {
      expect(normalizeInvoiceDate(undefined)).toBeNull();
      expect(normalizeInvoiceDate(null)).toBeNull();
    });
  });

  describe('filterByMonth', () => {
    const coilDate = { metadata: { invoiceDate: { seconds: 1781784000 } } }; // mid 2026 (approx) - actually let's use exact Date mock
    const coilNoDate = { metadata: {} };

    it('ALL passes everything', () => {
      expect(filterByMonth({ metadata: { invoiceDate: new Date('2026-06-15T12:00:00Z') } }, 'ALL')).toBe(true);
      expect(filterByMonth(coilNoDate, 'ALL')).toBe(true);
    });

    it('Filters exact month', () => {
      expect(filterByMonth({ metadata: { invoiceDate: new Date('2026-06-15T12:00:00Z') } }, '2026-06')).toBe(true);
      expect(filterByMonth({ metadata: { invoiceDate: new Date('2026-07-15T12:00:00Z') } }, '2026-06')).toBe(false);
    });

    it('Excludes missing date when month selected', () => {
      expect(filterByMonth(coilNoDate, '2026-06')).toBe(false);
    });
  });

  describe('buildSupervisorReport', () => {
    const coils = [
      { id: '1', status: 'AVAILABLE', finish: 'ALZ-ROJO', isClosed: false, currentWeight: 200, thickness: 0.5 },
      { id: '2', status: 'AVAILABLE', finish: 'ALZ-AZUL', isClosed: false, currentWeight: 300, thickness: 0.5 },
      { id: '3', status: 'AVAILABLE', finish: 'ALZ-AZUL', isClosed: false, currentWeight: 100, thickness: 0.4 },
    ];
    const finishesMap = {
      'ALZ-ROJO': { densityFactor: 0.008 },
      'ALZ-AZUL': { densityFactor: 0.008 }
    };

    it('sorts by espesor asc, acabado asc, peso desc', () => {
      const report = buildSupervisorReport(coils, finishesMap, 'ALL');
      expect(report.abiertas.map(r => r.id)).toEqual(['3', '2', '1']);
      // 0.4 ALZ-AZUL, 0.5 ALZ-AZUL (300), 0.5 ALZ-ROJO (200)
    });
  });
});
