import type { MetallicProduct } from '../types';

export function getFinishArray(product: MetallicProduct | null | undefined): string[] {
  if (!product) return [];
  if (product.finishes && product.finishes.length > 0) return product.finishes;
  if (product.finish) return [product.finish];
  return [];
}

export function buildFinishChips(product: MetallicProduct | null | undefined): { visible: string[], overflow: number, total: string[] } {
  const all = getFinishArray(product);
  if (all.length === 0) return { visible: [], overflow: 0, total: [] };
  if (all.length <= 2) return { visible: all, overflow: 0, total: all };
  return {
    visible: all.slice(0, 2),
    overflow: all.length - 2,
    total: all
  };
}

