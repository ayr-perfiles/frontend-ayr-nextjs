export function validateScrapRequest(
  scrapWeightKg: number,
  reason: string,
  role: string | null | undefined,
): void {
  if (role !== "ADMIN") {
    throw new Error("Solo un ADMIN puede registrar merma de bobina");
  }
  if (typeof scrapWeightKg !== "number" || Number.isNaN(scrapWeightKg) || scrapWeightKg <= 0) {
    throw new Error("El peso de merma debe ser mayor a 0 kg");
  }
  if (!reason || !reason.trim()) {
    throw new Error("El motivo de la merma es obligatorio");
  }
}

export function calculateScrapCost(
  scrapWeightKg: number,
  pricePerKg: number,
): number {
  return Number((scrapWeightKg * pricePerKg).toFixed(2));
}

export function calculateNewWeight(
  currentWeight: number,
  scrapWeightKg: number,
): number {
  return Number((currentWeight - scrapWeightKg).toFixed(2));
}

export function determineCoilStatusAfterScrap(
  newWeight: number,
  existingStatus: string,
): string {
  return newWeight <= 0 ? "PROCESSED" : existingStatus;
}
