import { describe, it, expect } from 'vitest';
import { calculateStockBobinas, CoilInput, FinishMetaInput } from './stockBobinasLogic';

describe('calculateStockBobinas', () => {
  const finishesMap: Record<string, FinishMetaInput> = {
    'ALZ-NATURAL': { tipo: 'Natural', acabado: null, densityFactor: 0.00785 },
    'ALZ-AZUL-5002': { tipo: 'Prepintado', acabado: 'AZUL 5002', densityFactor: 0.008 },
    'ALZ-ROJO-3020': { tipo: 'Prepintado', acabado: 'ROJO 3020', densityFactor: 0.008 },
    'GALV': { tipo: 'Galvanizado', acabado: null, densityFactor: 0.00785 },
  };

  it('f) pizarra vacía => { rows: [], negativeCoils: [] } sin crash', () => {
    const result = calculateStockBobinas({ coils: [], finishesMap: {} });
    expect(result).toEqual({ rows: [], negativeCoils: [] });
  });

  it('a) 2 prepintadas mismo espesor+acabado+proveedor+estado => 1 fila sumada; distinto proveedor => 2 filas', () => {
    const coils: CoilInput[] = [
      { id: 'P1', status: 'AVAILABLE', isClosed: true, finish: 'ALZ-AZUL-5002', thickness: 0.28, masterWidth: 1220, currentWeight: 1000, provider: 'TREAM PERU S.A.C.' },
      { id: 'P2', status: 'AVAILABLE', isClosed: true, finish: 'ALZ-AZUL-5002', thickness: 0.28, masterWidth: 1220, currentWeight: 1500, provider: 'TREAM PERU S.A.C.' },
      { id: 'P3', status: 'AVAILABLE', isClosed: true, finish: 'ALZ-AZUL-5002', thickness: 0.28, masterWidth: 1220, currentWeight: 2000, provider: 'HOUSEMART PERU S.A.C.' },
    ];
    const result = calculateStockBobinas({ coils, finishesMap });
    const tream = result.rows.find(r => r.proveedor === 'TREAM PERU S.A.C.');
    const housemart = result.rows.find(r => r.proveedor === 'HOUSEMART PERU S.A.C.');
    expect(result.rows).toHaveLength(2);
    expect(tream?.numBobinas).toBe(2);
    expect(tream?.pesoKg).toBe(2500);
    expect(housemart?.numBobinas).toBe(1);
    expect(result.negativeCoils).toEqual([]);
  });

  it('b) Natural agrupa solo por espesor: mismo espesor distinto proveedor => 1 fila, proveedores sumados, acabado/proveedor null', () => {
    const coils: CoilInput[] = [
      { id: 'N1', status: 'AVAILABLE', isClosed: false, finish: 'ALZ-NATURAL', thickness: 0.28, masterWidth: 1220, currentWeight: 3000, provider: 'TREAM PERU S.A.C.' },
      { id: 'N2', status: 'AVAILABLE', isClosed: false, finish: 'ALZ-NATURAL', thickness: 0.28, masterWidth: 1220, currentWeight: 4000, provider: 'YISENT INTERNACIONAL S.A.C.' },
    ];
    const result = calculateStockBobinas({ coils, finishesMap });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].numBobinas).toBe(2);
    expect(result.rows[0].pesoKg).toBe(7000);
    expect(result.rows[0].acabado).toBeNull();
    expect(result.rows[0].proveedor).toBeNull();
  });

  it('c) estado: isClosed true=>CERRADA, false=>ABIERTA; mismo grupo distinto estado => 2 filas. undefined=>CERRADA', () => {
    const coils: CoilInput[] = [
      { id: 'N1', status: 'AVAILABLE', isClosed: true, finish: 'ALZ-NATURAL', thickness: 0.28, masterWidth: 1220, currentWeight: 1000, provider: 'TREAM PERU S.A.C.' },
      { id: 'N2', status: 'AVAILABLE', isClosed: false, finish: 'ALZ-NATURAL', thickness: 0.28, masterWidth: 1220, currentWeight: 1000, provider: 'TREAM PERU S.A.C.' },
      { id: 'N3', status: 'AVAILABLE', isClosed: undefined, finish: 'ALZ-NATURAL', thickness: 0.28, masterWidth: 1220, currentWeight: 1000, provider: 'TREAM PERU S.A.C.' },
    ];
    const result = calculateStockBobinas({ coils, finishesMap });
    expect(result.rows).toHaveLength(2); // CERRADA and ABIERTA
    const cerrada = result.rows.find(r => r.estado === 'CERRADA');
    const abierta = result.rows.find(r => r.estado === 'ABIERTA');
    expect(cerrada?.numBobinas).toBe(2); // N1 and N3
    expect(abierta?.numBobinas).toBe(1); // N2
  });

  it('d) metraje: ML = pesoKg / (thickness × masterWidth × densityFactor)', () => {
    const coils: CoilInput[] = [
      { id: 'P1', status: 'AVAILABLE', isClosed: true, finish: 'ALZ-ROJO-3020', thickness: 0.28, masterWidth: 1220, currentWeight: 3711, provider: 'TREAM PERU S.A.C.' },
    ];
    const result = calculateStockBobinas({ coils, finishesMap });
    const expectedMl = 3711 / (0.28 * 1220 * 0.008);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].metrajeML).toBeCloseTo(expectedMl, 6);
  });

  it('d2) sin masterWidth/thickness/densityFactor => metraje 0, no inventa', () => {
    const coils: CoilInput[] = [
      { id: 'P1', status: 'AVAILABLE', isClosed: true, finish: 'ALZ-AZUL-5002', thickness: 0, masterWidth: 1220, currentWeight: 500, provider: 'TREAM PERU S.A.C.' },
    ];
    const result = calculateStockBobinas({ coils, finishesMap });
    expect(result.rows[0].metrajeML).toBe(0);
  });

  it('e) GALV excluido (no arma fila)', () => {
    const coils: CoilInput[] = [
      { id: 'G1', status: 'AVAILABLE', isClosed: false, finish: 'GALV', thickness: 0.45, masterWidth: 1200, currentWeight: 7000, provider: 'TREAM PERU S.A.C.' },
    ];
    const result = calculateStockBobinas({ coils, finishesMap });
    expect(result.rows).toEqual([]);
  });

  it('g) VOIDED excluido. currentWeight===0 excluido en silencio. currentWeight<0 excluido de filas pero en negativeCoils', () => {
    const coils: CoilInput[] = [
      { id: 'V1', status: 'VOIDED', isClosed: false, finish: 'ALZ-NATURAL', thickness: 0.28, masterWidth: 1220, currentWeight: 1000, provider: 'TREAM PERU S.A.C.' },
      { id: 'V2', status: 'PROCESSED', isClosed: false, finish: 'ALZ-NATURAL', thickness: 0.28, masterWidth: 1220, currentWeight: 0, provider: 'TREAM PERU S.A.C.' },
      { id: 'V3', status: 'PROCESSED', isClosed: false, finish: 'ALZ-AZUL-5002', thickness: 0.28, masterWidth: 1220, currentWeight: -39.09, provider: 'REPRES JAVI' },
    ];
    const result = calculateStockBobinas({ coils, finishesMap });
    expect(result.rows).toEqual([]);
    expect(result.negativeCoils).toEqual([
      { id: 'V3', finish: 'ALZ-AZUL-5002', currentWeight: -39.09 }
    ]);
  });
});
