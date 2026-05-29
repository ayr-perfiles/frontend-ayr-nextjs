import { describe, it, expect } from 'vitest';
import { classifyLine, normalizeUnit } from './catalogImport';

describe('Catalog Import Logic', () => {
  describe('normalizeUnit', () => {
    it('normalizes common units correctly', () => {
      expect(normalizeUnit('NIU')).toBe('PIEZA');
      expect(normalizeUnit('UNIDAD')).toBe('PIEZA');
      expect(normalizeUnit('PIEZA')).toBe('PIEZA');
      expect(normalizeUnit('METRO LINEAL')).toBe('METRO');
      expect(normalizeUnit('MTR')).toBe('METRO');
      expect(normalizeUnit('KGM')).toBe('KILOGRAMO');
      expect(normalizeUnit('TNE')).toBe('TONELADA');
      expect(normalizeUnit('ROLLO')).toBe('ROLLO');
      expect(normalizeUnit('LITROS')).toBe('UNKNOWN');
    });
  });

  describe('classifyLine', () => {
    it('classifies ANTI / Anticipo as skip', () => {
      expect(classifyLine('ANTI001', 'ANTICIPO')).toBe('skip');
      expect(classifyLine('123', 'ANTICIPO DE CLIENTE')).toBe('skip');
    });

    it('classifies COBPOLI / Policarbonato as trading', () => {
      expect(classifyLine('COBPOLI01', 'COBERTURA')).toBe('trading');
      expect(classifyLine('123', 'POLICARBONATO ALVEOLAR')).toBe('trading');
    });

    it('classifies BOB* as coil', () => {
      expect(classifyLine('BOB045GALV', 'BOBINA GALVANIZADA')).toBe('coil');
      expect(classifyLine('BOB28NAT', 'BOBINA NATURAL')).toBe('coil');
    });

    it('classifies Drywall (P*GALV, R*GALV, OMEGA, ESQ)', () => {
      expect(classifyLine('P38GALV045', 'PARANTE 38')).toBe('drywall');
      expect(classifyLine('R65GALV045', 'RIEL 65')).toBe('drywall');
      expect(classifyLine('OMEGA045', 'OMEGA')).toBe('drywall');
      expect(classifyLine('ESQ30', 'ESQUINERO')).toBe('drywall');
    });

    it('classifies Metallic Roofing (COB, PL, ACCES)', () => {
      expect(classifyLine('COB030ROJO', 'COBERTURA TR4')).toBe('metallic-roofing');
      expect(classifyLine('PL040X6MT', 'PLANCHA')).toBe('metallic-roofing');
      expect(classifyLine('ACCES030ROJO', 'CUMBRERA')).toBe('metallic-roofing');
    });

    it('classifies Roofing UPVC (UPVC, TC5)', () => {
      expect(classifyLine('UPVC6MT', 'TERMOACUSTICO')).toBe('roofing');
      expect(classifyLine('1234', 'COBERTURA TC5 BLANCA')).toBe('roofing');
    });

    it('classifies Trading (POLI, TUBO, AUTOP)', () => {
      expect(classifyLine('POLI600', 'POLICARBONATO')).toBe('trading');
      expect(classifyLine('TUBO2X2', 'TUBO RECTANGULAR')).toBe('trading');
      expect(classifyLine('AUTOP12', 'AUTOPERFORANTE')).toBe('trading');
    });

    it('classifies Services (CONFORM, SERV)', () => {
      expect(classifyLine('CONFORMADO', 'CONFORMADO')).toBe('services');
      expect(classifyLine('SERV01', 'SERVICIO DE CORTE')).toBe('services');
    });

    it('classifies unknown as unclassified', () => {
      expect(classifyLine('XXX123', 'PRODUCTO RARO')).toBe('unclassified');
    });
  });
});
