import { CoilStatus } from "./coilPricing";

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

const REVERSAL_EPSILON = 0.01;
export function determineCoilStatusAfterReversal(
  newWeight: number,
  initialWeight: number
): CoilStatus {
  return newWeight >= initialWeight - REVERSAL_EPSILON ? "AVAILABLE" : "IN_PROGRESS";
}

export function buildScrapTransactionWrites({
  coilId,
  coil,
  scrapWeightKg,
  reason,
  uid,
  now,
  scrapLogId,
}: {
  coilId: string;
  coil: { currentWeight?: number; initialWeight?: number; pricePerKg?: number; status: string };
  scrapWeightKg: number;
  reason: string;
  uid: string;
  now: any;
  scrapLogId: string;
}) {
  const currentWeight = coil.currentWeight ?? coil.initialWeight ?? 0;
  const pricePerKg = coil.pricePerKg ?? 0;

  const scrapCostPEN = calculateScrapCost(scrapWeightKg, pricePerKg);
  const newWeight = calculateNewWeight(currentWeight, scrapWeightKg);
  const hasNegativeCoilWarning = newWeight < 0;
  const newStatus = determineCoilStatusAfterScrap(newWeight, coil.status);

  return {
    newWeight,
    scrapCostPEN,
    hasNegativeCoilWarning,
    newStatus,
    coilUpdate: {
      currentWeight: newWeight,
      status: newStatus,
      updatedAt: now,
    },
    kardexWrite: {
      sku: coilId,
      date: now,
      type: "SCRAP",
      quantity: 1,
      weightKg: scrapWeightKg,
      costPerKg: pricePerKg,
      balance: newWeight,
      reference: scrapLogId,
      description: `Merma: ${reason.trim()}`,
      user: uid,
    },
    scrapLogWrite: {
      coilId,
      scrapWeightKg,
      scrapCostPEN,
      reason: reason.trim(),
      adminId: uid,
      timestamp: now,
    },
    auditWrite: {
      action: "REGISTER_SCRAP",
      entityId: coilId,
      userEmail: uid,
      details: `Merma: ${scrapWeightKg} kg (S/ ${scrapCostPEN}). Motivo: ${reason.trim()}. Peso resultante: ${newWeight} kg.`,
      timestamp: now,
    }
  };
}
