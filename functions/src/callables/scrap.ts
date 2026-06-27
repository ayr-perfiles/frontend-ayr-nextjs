import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {
  validateScrapRequest,
  calculateScrapCost,
  calculateNewWeight,
  determineCoilStatusAfterScrap,
} from "../domain/scrap";

export const registerCoilScrap = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const { coilId, scrapWeightKg, reason } = request.data;
  const uid = request.auth.uid;
  const role = request.auth.token.role;

  if (role !== "ADMIN") {
    throw new HttpsError("permission-denied", "Solo un ADMIN puede registrar merma de bobina");
  }

  try {
    validateScrapRequest(scrapWeightKg, reason, role);
  } catch (err: any) {
    throw new HttpsError("invalid-argument", err.message);
  }

  const db = admin.firestore();

  return await db.runTransaction(async (transaction) => {
    const coilRef = db.collection("coils").doc(coilId);
    const coilSnap = await transaction.get(coilRef);

    if (!coilSnap.exists) {
      throw new HttpsError("not-found", `La bobina ${coilId} no existe`);
    }

    const coil = coilSnap.data()!;

    if (coil.status === "VOIDED" || coil.status === "SOLD") {
      throw new HttpsError(
        "failed-precondition",
        `No se puede registrar merma en una bobina con estado ${coil.status}`,
      );
    }

    const currentWeight = coil.currentWeight ?? coil.initialWeight ?? 0;
    const pricePerKg = coil.pricePerKg ?? 0;

    const scrapCostPEN = calculateScrapCost(scrapWeightKg, pricePerKg);
    const newWeight = calculateNewWeight(currentWeight, scrapWeightKg);
    const hasNegativeCoilWarning = newWeight < 0;
    const newStatus = determineCoilStatusAfterScrap(newWeight, coil.status);

    const kardexRef = db.collection("kardex_movements").doc();
    const scrapLogRef = db.collection("scrap_logs").doc();
    const auditRef = db.collection("audit_logs").doc();

    const now = admin.firestore.FieldValue.serverTimestamp();

    transaction.update(coilRef, {
      currentWeight: newWeight,
      status: newStatus,
      updatedAt: now,
    });

    transaction.set(kardexRef, {
      sku: coilId,
      date: now,
      type: "SCRAP",
      quantity: 1,
      weightKg: scrapWeightKg,
      costPerKg: pricePerKg,
      balance: newWeight,
      reference: scrapLogRef.id,
      description: `Merma: ${reason.trim()}`,
      user: uid,
    });

    transaction.set(scrapLogRef, {
      coilId,
      scrapWeightKg,
      scrapCostPEN,
      reason: reason.trim(),
      adminId: uid,
      timestamp: now,
    });

    transaction.set(auditRef, {
      action: "REGISTER_SCRAP",
      entityId: coilId,
      userEmail: uid,
      details: `Merma: ${scrapWeightKg} kg (S/ ${scrapCostPEN}). Motivo: ${reason.trim()}. Peso resultante: ${newWeight} kg.`,
      timestamp: now,
    });

    return {
      newWeight,
      scrapCostPEN,
      hasNegativeCoilWarning,
      scrapLogId: scrapLogRef.id,
    };
  });
});
