import type { CoilStatus } from '@/types';

/**
 * Calcula el costo S/.kg a partir del valor total de factura.
 * Para USD convierte a PEN con el TC antes de dividir.
 * Lanza si el TC es inválido (≤ 1) para USD — sin fallback silencioso.
 */
export function computePricePerKg(
  totalValue: number,
  weightKg: number,
  currency: 'PEN' | 'USD',
  exchangeRate: number,
): number {
  if (weightKg <= 0) throw new Error('El peso debe ser mayor a 0.');
  if (currency === 'USD') {
    if (exchangeRate <= 1) {
      throw new Error(
        'Tipo de cambio inválido para USD. Ingresa el TC correcto (debe ser mayor a 1).',
      );
    }
    return Number(((totalValue * exchangeRate) / weightKg).toFixed(6));
  }
  return Number((totalValue / weightKg).toFixed(6));
}

export interface SplitCalculation {
  /** Peso de la bobina hija (proporcional al ancho cortado). */
  childWeight: number;
  newParentWeight: number;
  newParentWidth: number;
  newParentStatus: CoilStatus;
}

/**
 * Slitting longitudinal: divide la bobina por ANCHO.
 * El peso se reparte proporcional al ancho (mismo espesor, mismo largo).
 *   childWeight = parent.currentWeight × (newChildWidthMm / parent.masterWidth)
 * pricePerKg se hereda idéntico — no se recalcula.
 */
export function validateAndCalculateSplit(
  parent: { currentWeight: number; masterWidth: number; status: string },
  newChildWidthMm: number,
): SplitCalculation {
  if (parent.status !== 'AVAILABLE') {
    throw new Error(
      `Solo se pueden partir bobinas DISPONIBLES. Estado actual: ${parent.status}`,
    );
  }
  if (newChildWidthMm <= 0) {
    throw new Error('El ancho de corte debe ser mayor a 0 mm.');
  }
  if (newChildWidthMm >= parent.masterWidth) {
    throw new Error(
      `El ancho de corte (${newChildWidthMm} mm) debe ser estrictamente menor al ancho maestro (${parent.masterWidth} mm).`,
    );
  }

  const ratio = newChildWidthMm / parent.masterWidth;
  const childWeight = Number((parent.currentWeight * ratio).toFixed(4));
  const newParentWeight = Number((parent.currentWeight - childWeight).toFixed(4));
  const newParentWidth = Number((parent.masterWidth - newChildWidthMm).toFixed(4));
  const newParentStatus: CoilStatus =
    newParentWidth === 0 || newParentWeight === 0 ? 'SPLIT_PARENT' : 'AVAILABLE';

  return { childWeight, newParentWeight, newParentWidth, newParentStatus };
}
