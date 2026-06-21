import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import type { Coil } from "@/types";
import {
  validateScrapRequest,
  calculateScrapCost,
  calculateNewWeight,
  determineCoilStatusAfterScrap,
} from "@/core/coils/domain/scrap";

export interface RegisterScrapParams {
  coilId: string;
  scrapWeightKg: number;
  reason: string;
  adminEmail: string;
  role: string | null | undefined;
}

export interface RegisterScrapResult {
  scrapLogId: string;
  newWeight: number;
  scrapCostPEN: number;
  hasNegativeCoilWarning: boolean;
}

export async function registerCoilScrap(
  params: RegisterScrapParams,
): Promise<RegisterScrapResult> {
  const { coilId, scrapWeightKg, reason, adminEmail, role } = params;

  validateScrapRequest(scrapWeightKg, reason, role);

  let result: RegisterScrapResult = {
    scrapLogId: "",
    newWeight: 0,
    scrapCostPEN: 0,
    hasNegativeCoilWarning: false,
  };

  await runTransaction(db, async (transaction) => {
    // ── FASE 1: LECTURAS ─────────────────────────────────────────────────
    const coilRef = doc(db, "coils", coilId);
    const coilSnap = await transaction.get(coilRef);

    if (!coilSnap.exists()) {
      throw new Error(`La bobina ${coilId} no existe`);
    }

    const coil = coilSnap.data() as Coil;

    if (coil.status === "VOIDED" || coil.status === "SOLD") {
      throw new Error(
        `No se puede registrar merma en una bobina con estado ${coil.status}`,
      );
    }

    // ── FASE 2: CÁLCULOS ─────────────────────────────────────────────────
    const currentWeight = coil.currentWeight ?? coil.initialWeight ?? 0;
    const pricePerKg = coil.pricePerKg ?? 0;

    const scrapCostPEN = calculateScrapCost(scrapWeightKg, pricePerKg);
    const newWeight = calculateNewWeight(currentWeight, scrapWeightKg);
    const hasNegativeCoilWarning = newWeight < 0;
    const newStatus = determineCoilStatusAfterScrap(newWeight, coil.status);

    const kardexRef = doc(collection(db, "kardex_movements"));
    const scrapLogRef = doc(collection(db, "scrap_logs"));
    const auditRef = doc(collection(db, "audit_logs"));

    // ── FASE 3: ESCRITURAS ────────────────────────────────────────────────
    transaction.update(coilRef, {
      currentWeight: newWeight,
      status: newStatus,
      updatedAt: serverTimestamp(),
    });

    transaction.set(kardexRef, {
      sku: coilId,
      date: serverTimestamp(),
      type: "SCRAP",
      quantity: 1,
      weightKg: scrapWeightKg,
      costPerKg: pricePerKg,
      balance: newWeight,
      reference: scrapLogRef.id,
      description: `Merma: ${reason.trim()}`,
      user: adminEmail,
    });

    transaction.set(scrapLogRef, {
      coilId,
      scrapWeightKg,
      scrapCostPEN,
      reason: reason.trim(),
      adminId: adminEmail,
      timestamp: serverTimestamp(),
    });

    transaction.set(auditRef, {
      action: "REGISTER_SCRAP",
      entityId: coilId,
      userEmail: adminEmail,
      details: `Merma: ${scrapWeightKg} kg (S/ ${scrapCostPEN}). Motivo: ${reason.trim()}. Peso resultante: ${newWeight} kg.`,
      timestamp: serverTimestamp(),
    });

    result = {
      scrapLogId: scrapLogRef.id,
      newWeight,
      scrapCostPEN,
      hasNegativeCoilWarning,
    };
  });

  return result;
}
