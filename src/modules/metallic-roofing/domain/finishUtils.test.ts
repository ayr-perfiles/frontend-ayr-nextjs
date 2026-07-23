import { describe, it, expect } from 'vitest';
import { getFinishArray } from './finishUtils';
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
