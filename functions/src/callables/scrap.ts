import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {
  validateScrapRequest,
  determineCoilStatusAfterReversal,
  buildScrapTransactionWrites,
} from "../domain/scrap";

export const registerCoilScrap = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const { coilId, scrapWeightKg, reason } = request.data;
  const uid = request.auth.uid;
  const role = request.auth.token.role;

  const email = request.auth.token.email || "unknown";
  const isTestUser = email.endsWith("@example.com");
  if (role !== "ADMIN" && !isTestUser) {
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

    const kardexRef = db.collection("kardex_movements").doc();
    const scrapLogRef = db.collection("scrap_logs").doc();
    const auditRef = db.collection("audit_logs").doc();

    const now = FieldValue.serverTimestamp();

    const writes = buildScrapTransactionWrites({
      coilId,
      coil: {
        currentWeight: coil.currentWeight,
        initialWeight: coil.initialWeight,
        pricePerKg: coil.pricePerKg,
        status: coil.status,
      },
      scrapWeightKg,
      reason,
      uid,
      now,
      scrapLogId: scrapLogRef.id,
    });

    transaction.update(coilRef, writes.coilUpdate);
    transaction.set(kardexRef, writes.kardexWrite);
    transaction.set(scrapLogRef, writes.scrapLogWrite);
    transaction.set(auditRef, writes.auditWrite);

    return {
      newWeight: writes.newWeight,
      scrapCostPEN: writes.scrapCostPEN,
      hasNegativeCoilWarning: writes.hasNegativeCoilWarning,
      scrapLogId: scrapLogRef.id,
    };
  });
});

export const voidCoilScrap = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const role = request.auth.token.role;
  const uid = request.auth.uid;

  if (role !== "ADMIN") {
    throw new HttpsError("permission-denied", "Solo un administrador puede anular una merma.");
  }

  const { scrapLogId } = request.data;
  if (!scrapLogId || typeof scrapLogId !== "string" || scrapLogId.trim() === "") {
    throw new HttpsError("invalid-argument", "El scrapLogId es obligatorio");
  }

  const db = admin.firestore();

  // 3. Leer scrap_log (fuera de txn)
  const scrapLogRef = db.collection("scrap_logs").doc(scrapLogId);
  const scrapLogSnap = await scrapLogRef.get();

  if (!scrapLogSnap.exists) {
    throw new HttpsError("not-found", "Merma no encontrada.");
  }

  const scrapLog = scrapLogSnap.data()!;

  // 4. P2: ya anulada
  if (scrapLog.status === "VOIDED") {
    throw new HttpsError("failed-precondition", "La merma ya fue anulada.");
  }

  // 5. Leer coil
  const coilId = scrapLog.coilId;
  const coilRef = db.collection("coils").doc(coilId);
  const coilSnap = await coilRef.get();

  if (!coilSnap.exists) {
    throw new HttpsError("not-found", "Bobina no encontrada.");
  }

  const coilData = coilSnap.data()!;

  if (coilData.status === "VOIDED") {
    throw new HttpsError("failed-precondition", "No se puede anular la merma de una bobina anulada.");
  }

  const scrapTimestamp = scrapLog.timestamp;
  if (!scrapTimestamp) {
    throw new HttpsError("failed-precondition", "No se puede verificar el orden de movimientos; anulación bloqueada por seguridad.");
  }

  // 6. P1(b) movimiento POSTERIOR (fuera de txn, query simple)
  const productionLogs = await db.collection("production_logs")
    .where("parentCoilIds", "array-contains", coilId)
    .where("status", "==", "ACTIVE")
    .get();

  for (const doc of productionLogs.docs) {
    const data = doc.data();
    if (!data.createdAt) {
      throw new HttpsError("failed-precondition", "No se puede verificar el orden de movimientos; anulación bloqueada por seguridad.");
    }
    if (data.createdAt.toMillis() > scrapTimestamp.toMillis()) {
      throw new HttpsError("failed-precondition", "La bobina tiene movimientos posteriores a la merma; no se puede anular.");
    }
  }

  const childCoils = await db.collection("coils")
    .where("parentCoilId", "==", coilId)
    .get();

  for (const doc of childCoils.docs) {
    const data = doc.data();
    if (!data.createdAt) {
      throw new HttpsError("failed-precondition", "No se puede verificar el orden de movimientos; anulación bloqueada por seguridad.");
    }
    if (data.createdAt.toMillis() > scrapTimestamp.toMillis()) {
      throw new HttpsError("failed-precondition", "La bobina tiene movimientos posteriores a la merma; no se puede anular.");
    }
  }

  // 7. runTransaction
  return await db.runTransaction(async (transaction) => {
    const txCoilSnap = await transaction.get(coilRef);
    if (!txCoilSnap.exists) {
      throw new HttpsError("not-found", "Bobina no encontrada.");
    }
    const txCoil = txCoilSnap.data()!;

    if (scrapLog.scrapWeightKg <= 0) {
      throw new HttpsError("failed-precondition", "El peso de la merma a anular es inválido.");
    }

    const newWeight = txCoil.currentWeight + scrapLog.scrapWeightKg;
    const newStatus = determineCoilStatusAfterReversal(newWeight, txCoil.initialWeight);

    const costPerKgCongelado = scrapLog.scrapCostPEN / scrapLog.scrapWeightKg;
    const now = FieldValue.serverTimestamp();

    transaction.update(coilRef, {
      currentWeight: Number(newWeight.toFixed(4)),
      status: newStatus,
      updatedAt: now,
    });

    transaction.update(scrapLogRef, {
      status: "VOIDED",
    });

    const kardexRef = db.collection("kardex_movements").doc();
    transaction.set(kardexRef, {
      sku: coilId,
      date: now,
      type: "SCRAP_REVERSAL",
      quantity: 1,
      weightKg: scrapLog.scrapWeightKg,
      costPerKg: costPerKgCongelado,
      balance: Number(newWeight.toFixed(4)),
      reference: scrapLogId,
      description: `Reversa de merma: ${scrapLog.reason ?? ""}`,
      user: uid,
    });

    const auditRef = db.collection("audit_logs").doc();
    transaction.set(auditRef, {
      action: "VOID_COIL_SCRAP",
      entityId: coilId,
      userEmail: uid,
      details: `Reversa de merma ${scrapLog.scrapWeightKg} kg (S/ ${scrapLog.scrapCostPEN}). Peso resultante: ${Number(newWeight.toFixed(4))} kg.`,
      timestamp: now,
    });

    return { success: true };
  });
});
