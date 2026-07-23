import { describe, it, expect } from 'vitest';
import { getFinishArray, buildFinishChips } from './finishUtils';
import type { MetallicProduct } from '../types';

describe('getFinishArray', () => {
  it('producto con finishes[] -> devuelve el array (multi-RAL)', () => {
    const product = { finishes: ['ALU-ROJO', 'ALU-ROJO-RAL-3020'], finish: 'ALU-ROJO' } as MetallicProduct;
    expect(getFinishArray(product)).toEqual(['ALU-ROJO', 'ALU-ROJO-RAL-3020']);
  });

  it('producto solo con finish escalar -> devuelve [finish] (retrocompatibilidad)', () => {
    const product = { finish: 'ALU-ROJO' } as MetallicProduct;
    expect(getFinishArray(product)).toEqual(['ALU-ROJO']);
  });

  it('producto sin ninguno -> devuelve []', () => {
    const product = {} as MetallicProduct;
    expect(getFinishArray(product)).toEqual([]);
  });
});

describe('buildFinishChips', () => {
  it('0 finishes -> visible [], overflow 0', () => {
    const product = {} as MetallicProduct;
    expect(buildFinishChips(product)).toEqual({ visible: [], overflow: 0, total: [] });
  });

  it('1 finish -> visible [1], overflow 0 (sin "+0")', () => {
    const product = { finish: 'ROJO' } as MetallicProduct;
    expect(buildFinishChips(product)).toEqual({ visible: ['ROJO'], overflow: 0, total: ['ROJO'] });
  });

  it('2 finishes -> visible [1,2], overflow 0', () => {
    const product = { finishes: ['ROJO', 'AZUL'] } as MetallicProduct;
    expect(buildFinishChips(product)).toEqual({ visible: ['ROJO', 'AZUL'], overflow: 0, total: ['ROJO', 'AZUL'] });
  });

  it('>2 finishes -> visible [1,2], overflow N', () => {
    const product = { finishes: ['ROJO', 'AZUL', 'VERDE', 'BLANCO'] } as MetallicProduct;
    expect(buildFinishChips(product)).toEqual({
      visible: ['ROJO', 'AZUL'],
      overflow: 2,
      total: ['ROJO', 'AZUL', 'VERDE', 'BLANCO']
    });
  });
});

