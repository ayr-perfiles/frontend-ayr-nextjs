import type { MetallicProduct } from '../types';
import { getFinishArray } from './finishUtils';

export function isCoilEligibleForProduct(coilFinish: string | undefined | null, product: MetallicProduct): boolean {
  if (!coilFinish) return false;
  return getFinishArray(product).includes(coilFinish);
}
