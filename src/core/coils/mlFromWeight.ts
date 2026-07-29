export function computeMlFromWeight(
  weight: number,
  masterWidthMm: number,
  thicknessMm: number,
  densityFactor: number
): number | null {
  if (weight === 0) return 0;
  
  const factor = masterWidthMm * thicknessMm * densityFactor;
  if (factor <= 0) return null;
  
  return weight / factor;
}
