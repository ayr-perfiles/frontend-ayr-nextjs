import { THICKNESS_MATCH_TOLERANCE_MM } from "./constants";

export function isThicknessWithinTolerance(
  coilMm: number,
  skuMm: number,
  tolMm: number = THICKNESS_MATCH_TOLERANCE_MM
): boolean {
  // Convertimos a micrones para evitar problemas de precisin de punto flotante en JS
  return Math.abs(Math.round(coilMm * 1000) - Math.round(skuMm * 1000)) <= Math.round(tolMm * 1000);
}
