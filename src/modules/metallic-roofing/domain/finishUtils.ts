import type { MetallicProduct } from '../types';

export function getFinishArray(product: MetallicProduct | null | undefined): string[] {
  if (!product) return [];
  if (product.finishes && product.finishes.length > 0) return product.finishes;
  if (product.finish) return [product.finish];
  return [];
}
