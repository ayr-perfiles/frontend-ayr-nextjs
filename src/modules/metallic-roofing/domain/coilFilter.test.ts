import { describe, it, expect } from 'vitest';
import { isCoilEligibleForProduct } from './coilFilter';
import type { MetallicProduct } from '../types';

describe('isCoilEligibleForProduct (Filtro de bobinas)', () => {
  it('producto con finishes ["ALU-ROJO", "ALU-ROJO-RAL-3020"] -> bobinas de AMBOS acabados son elegibles', () => {
    const product = { finish: 'ALU-ROJO', finishes: ['ALU-ROJO', 'ALU-ROJO-RAL-3020'] } as MetallicProduct;
    
    expect(isCoilEligibleForProduct('ALU-ROJO', product)).toBe(true);
    expect(isCoilEligibleForProduct('ALU-ROJO-RAL-3020', product)).toBe(true);
    expect(isCoilEligibleForProduct('ALU-AZUL', product)).toBe(false);
  });

  it('producto con finish escalar -> solo ese acabado es elegible', () => {
    const product = { finish: 'ALU-ROJO' } as MetallicProduct;
    
    expect(isCoilEligibleForProduct('ALU-ROJO', product)).toBe(true);
    expect(isCoilEligibleForProduct('ALU-ROJO-RAL-3020', product)).toBe(false);
  });
});
