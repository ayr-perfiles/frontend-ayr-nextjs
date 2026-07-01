import { describe, it, expect } from 'vitest';
import { parseCoilDescription } from './parseCoilDescription';

describe('parseCoilDescription', () => {
  describe('Color/finish explícito → token', () => {
    it('GALV con 1200', () => {
      expect(parseCoilDescription("BOBINA GALV. 0.42 X 1200")).toEqual({
        finishToken: 'GALV',
        thickness: 0.42,
        width: 1200,
        flags: []
      });
    });

    it('NATURAL con palabra COLOR', () => {
      expect(parseCoilDescription("BOBINA ALUZINC 0.38 X 1220 MM COLOR NATURAL")).toEqual({
        finishToken: 'NATURAL',
        thickness: 0.38,
        width: 1220,
        flags: []
      });
    });

    it('NATURAL con guion JAVISAC', () => {
      expect(parseCoilDescription("BOBINA ALUZINC NATURAL 0.28 X 1220 - JAVISAC")).toEqual({
        finishToken: 'NATURAL',
        thickness: 0.28,
        width: 1220,
        flags: []
      });
    });

    it('AZUL 1219 RAL5002', () => {
      expect(parseCoilDescription("BOBINA ALUZINC AZUL 0.28 X 1219 - RAL5002 C/FILM - JAVISAC")).toEqual({
        finishToken: 'AZUL',
        thickness: 0.28,
        width: 1219,
        flags: []
      });
    });

    it('AZUL 0.38 1219', () => {
      expect(parseCoilDescription("BOBINA ALUZINC AZUL 0.38 X 1219 - RAL5002 C/FILM - JAVISAC")).toEqual({
        finishToken: 'AZUL',
        thickness: 0.38,
        width: 1219,
        flags: []
      });
    });

    it('ROJO 1219 RAL3020', () => {
      expect(parseCoilDescription("BOBINA ALUZINC ROJO 0.38 X 1219 - RAL3020 C/FILM - JAVISAC")).toEqual({
        finishToken: 'ROJO',
        thickness: 0.38,
        width: 1219,
        flags: []
      });
    });

    it('Inglés sin espacios BLUE → AZUL', () => {
      expect(parseCoilDescription("PREPAINTED STEEL COIL 0.28X1220XC BLUE A")).toEqual({
        finishToken: 'AZUL',
        thickness: 0.28,
        width: 1220,
        flags: []
      });
    });

    it('AZUL sin ancho (falla explícitamente)', () => {
      expect(parseCoilDescription("BOBINA ALUZINC 0.40MM AZUL")).toEqual({
        finishToken: 'AZUL',
        thickness: 0.40,
        width: null,
        flags: ['WIDTH_NOT_FOUND']
      });
    });

    it('NATURAL sin ancho (falla explícitamente)', () => {
      expect(parseCoilDescription("BOBINA ALUZINC 0.40MM NATURAL")).toEqual({
        finishToken: 'NATURAL',
        thickness: 0.40,
        width: null,
        flags: ['WIDTH_NOT_FOUND']
      });
    });
  });

  describe('Ambiguo (aluzinc pelado sin color, o prepintada sin color)', () => {
    it('ALUZINC sin color', () => {
      expect(parseCoilDescription("BOB ALUZINC ASTM A-792 0.28 MM X 1220 MM")).toEqual({
        finishToken: null,
        thickness: 0.28,
        width: 1220,
        flags: ['FINISH_AMBIGUOUS']
      });
    });

    it('ALUZINC pegado sin espacios', () => {
      expect(parseCoilDescription("BOBINA ALUZINC 0.38X1220MM")).toEqual({
        finishToken: null,
        thickness: 0.38,
        width: 1220,
        flags: ['FINISH_AMBIGUOUS']
      });
    });

    it('PREPINTADA sin color', () => {
      expect(parseCoilDescription("BOB PREPINTADA ASTM A-755 0.28 MM X 1220 MM")).toEqual({
        finishToken: null,
        thickness: 0.28,
        width: 1220,
        flags: ['FINISH_AMBIGUOUS']
      });
    });
  });

  describe('Basura / borde', () => {
    it('Cualquier texto que no sea bobina parseable', () => {
      expect(parseCoilDescription("FLEJADO DE BOBINA")).toEqual({
        finishToken: null,
        thickness: null,
        width: null,
        flags: ['FINISH_AMBIGUOUS', 'THICKNESS_NOT_FOUND', 'WIDTH_NOT_FOUND']
      });
    });

    it('String vacío', () => {
      expect(parseCoilDescription("")).toEqual({
        finishToken: null,
        thickness: null,
        width: null,
        flags: ['FINISH_AMBIGUOUS', 'THICKNESS_NOT_FOUND', 'WIDTH_NOT_FOUND']
      });
    });
  });
});
