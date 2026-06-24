import { describe, it, expect } from 'vitest';
import { normalizeUnit, classifyLine } from './catalogImport';

describe('normalizeUnit', () => {
  it('normaliza unidades correctamente', () => {
    expect(normalizeUnit('UNIDAD')).toBe('PIEZA');
    expect(normalizeUnit('METRO LINEAL')).toBe('METRO');
    expect(normalizeUnit('KILOGRAMO')).toBe('KILOGRAMO');
    expect(normalizeUnit('TONELADA')).toBe('TONELADA');
    expect(normalizeUnit('ROLLO')).toBe('ROLLO');
    expect(normalizeUnit('CUALQUIER COSA')).toBe('UNKNOWN');
  });

  it('es insensible a mayúsculas/minúsculas', () => {
    expect(normalizeUnit('unidad')).toBe('PIEZA');
    expect(normalizeUnit('Kilogramo')).toBe('KILOGRAMO');
  });
});

describe('classifyLine', () => {
  it('clasifica productos correctamente por SKU y nombre', () => {
    // Trading
    expect(classifyLine('COBPOLI001', 'POLICARBONATO')).toBe('trading');
    expect(classifyLine('POLI-X', 'OTRO')).toBe('trading');
    
    // Skip
    expect(classifyLine('ANTI001', 'ANTICIPO')).toBe('skip');
    expect(classifyLine('ITEM-X', 'PAGO ANTICIPO')).toBe('skip');
    
    // Coil
    expect(classifyLine('BOB045GALV', 'BOBINA GALV')).toBe('coil');
    
    // Metallic
    expect(classifyLine('COB030ROJO', 'COBERTURA')).toBe('metallic-roofing');
    expect(classifyLine('PL040NAT', 'PLANCHA')).toBe('metallic-roofing');
    
    // Drywall
    expect(classifyLine('P64GALV045', 'PARANTE')).toBe('drywall');
    expect(classifyLine('R90GALV045', 'RIEL')).toBe('drywall');
    expect(classifyLine('OMEGA045', 'OMEGA')).toBe('drywall');
    
    // Roofing
    expect(classifyLine('UPVC6MT', 'COBERTURA PVC')).toBe('roofing');
    expect(classifyLine('TC5-ROJO', 'TC5')).toBe('roofing');
    
    // Services
    expect(classifyLine('CONFORMADO', 'SERVICIO')).toBe('services');
    
    // Unclassified
    expect(classifyLine('DESCONOCIDO', 'PRODUCTO X')).toBe('unclassified');
  });
});
