import { describe, it, expect } from 'vitest';
import { calcPesoKg, normalizeDocType, classifyNCStockAction } from './importHelpers';

describe('importHelpers - calcPesoKg', () => {
  it('debe calcular peso por UNIDAD', () => {
    const res = calcPesoKg('UNIDAD', 10, 2.5);
    expect(res.weight).toBe(25);
    expect(res.flag).toBeUndefined();
  });

  it('debe calcular peso por METRO LINEAL', () => {
    const res = calcPesoKg('METRO LINEAL', 5, 1.2);
    expect(res.weight).toBe(6);
    expect(res.flag).toBeUndefined();
  });

  it('debe tomar la cantidad directo para KILOGRAMO', () => {
    const res = calcPesoKg('KILOGRAMO', 50, 2.5); // unitWeight se ignora
    expect(res.weight).toBe(50);
  });

  it('debe multiplicar por 1000 para TONELADA', () => {
    const res = calcPesoKg('TONELADA', 2, 2.5); // unitWeight se ignora
    expect(res.weight).toBe(2000);
  });

  it('debe usar peso catálogo y marcar flag si UM es desconocida', () => {
    const res = calcPesoKg('PAQUETE', 10, 5);
    expect(res.weight).toBe(50);
    expect(res.flag).toContain('UM no reconocida');
  });

  it('debe usar peso catálogo si UM está vacío', () => {
    const res = calcPesoKg('', 10, 5);
    expect(res.weight).toBe(50);
    expect(res.flag).toBeUndefined();
  });
});

describe('importHelpers - normalizeDocType', () => {
  it('debe normalizar Factura', () => {
    expect(normalizeDocType('FACTURA ELECTRÓNICA')).toBe('FACTURA');
  });
  it('debe normalizar Boleta', () => {
    expect(normalizeDocType('BOLETA DE VENTA')).toBe('BOLETA');
  });
  it('debe normalizar Nota de Crédito', () => {
    expect(normalizeDocType('NOTA DE CRÉDITO')).toBe('NOTA CRÉDITO');
    expect(normalizeDocType('NOTA CREDITO')).toBe('NOTA CRÉDITO');
    expect(normalizeDocType('Nota Crédito')).toBe('NOTA CRÉDITO');
    expect(normalizeDocType('NC')).toBe('NOTA CRÉDITO');
  });
  it('debe normalizar Nota de Débito', () => {
    expect(normalizeDocType('NOTA DE DÉBITO')).toBe('NOTA DÉBITO');
    expect(normalizeDocType('Nota Débito')).toBe('NOTA DÉBITO');
  });
});

describe('importHelpers - classifyNCStockAction', () => {
  it('debe retornar RETURNS_STOCK para SI', () => {
    expect(classifyNCStockAction('SI')).toBe('RETURNS_STOCK');
  });
  it('debe retornar RETURNS_STOCK para Sí (formato SUNAT con tilde)', () => {
    expect(classifyNCStockAction('Sí')).toBe('RETURNS_STOCK');
    expect(classifyNCStockAction('SÍ')).toBe('RETURNS_STOCK');
    expect(classifyNCStockAction('si')).toBe('RETURNS_STOCK');
  });
  it('debe retornar MONEY_ONLY para NO', () => {
    expect(classifyNCStockAction('NO')).toBe('MONEY_ONLY');
    expect(classifyNCStockAction('No')).toBe('MONEY_ONLY');
  });
  it('debe retornar UNDECIDED para vacío o desconocido', () => {
    expect(classifyNCStockAction('')).toBe('UNDECIDED');
    expect(classifyNCStockAction('TAL VEZ')).toBe('UNDECIDED');
  });
  it('RETURNS_STOCK y MONEY_ONLY producen acciones distintas (no colisionan)', () => {
    expect(classifyNCStockAction('Sí')).not.toBe(classifyNCStockAction('NO'));
  });
});
