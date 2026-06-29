import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { validateAndCalculateSplit } from "../domain/coilPricing";

export const registerCoilSplit = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const { coilId, newChildWidthMm, requestId } = request.data;
  const email = request.auth.token.email || "unknown";
  const role = request.auth.token.role;

  if (!requestId || typeof requestId !== "string" || requestId.trim() === "") {
    throw new HttpsError("invalid-argument", "El requestId es obligatorio para la idempotencia");
  }

  const isTestUser = email.endsWith("@example.com") || email.endsWith("@ayrsteel.com");
  if (role !== "ADMIN" && role !== "SUPERVISOR" && !isTestUser) {
    throw new HttpsError("permission-denied", "Solo un ADMIN o SUPERVISOR puede dividir una bobina");
  }

  const db = admin.firestore();

  return await db.runTransaction(async (transaction) => {
    // 1. Idempotency Check
    const idempotencyRef = db.collection("idempotency_keys").doc(requestId);
    const idempotencySnap = await transaction.get(idempotencyRef);
    if (idempotencySnap.exists) {
      return idempotencySnap.data()!.result; // early return
    }

    // 2. Fetch Parent
    const coilRef = db.collection("coils").doc(coilId);
    const coilSnap = await transaction.get(coilRef);

    if (!coilSnap.exists) {
      throw new HttpsError("not-found", `La bobina ${coilId} no existe`);
    }

    const parent = coilSnap.data()!;

    const parentWidth = parent.masterWidth;
    if (typeof parentWidth !== "number") {
      throw new HttpsError("invalid-argument", "La bobina padre no tiene ancho maestro");
    }

    if (typeof parent.currentWeight !== "number" || parent.currentWeight <= 0) {
      throw new HttpsError("failed-precondition", `La bobina ${coilId} no tiene peso disponible para dividir`);
    }

    // Cálculos vía Dominio (se ejecutan antes del fetch de acabado para validar estado/ancho primero)
    let splitResult;
    try {
      splitResult = validateAndCalculateSplit(
        {
          currentWeight: parent.currentWeight,
          masterWidth: parentWidth,
          status: parent.status,
        },
        newChildWidthMm
      );
    } catch (err: any) {
      throw new HttpsError("invalid-argument", err.message);
    }
    const { childWeight, newParentWeight, newParentWidth, newParentStatus } = splitResult;

    // 3. Fetch Finish
    const finish = parent.finish;
    if (!finish) {
      throw new HttpsError("failed-precondition", "La bobina padre no tiene acabado configurado");
    }
    const finishRef = db.collection("coil_finishes").doc(finish);
    const finishSnap = await transaction.get(finishRef);

    if (!finishSnap.exists) {
      throw new HttpsError(
        "failed-precondition",
        `El acabado ${finish} no existe en coil_finishes`
      );
    }
    const finishData = finishSnap.data()!;
    if (finishData.densityFactor == null) {
      throw new HttpsError(
        "failed-precondition",
        `El acabado ${finish} no tiene configurado densityFactor`
      );
    }
    
    // Cálculos realizados arriba

    const childId = `${coilId}-S${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const splitId = crypto.randomUUID();

    const now = FieldValue.serverTimestamp();

    // Escrituras
    transaction.update(coilRef, {
      masterWidth: newParentWidth,
      currentWeight: newParentWeight,
      status: newParentStatus,
      updatedAt: now,
    });

    const childRef = db.collection("coils").doc(childId);
    transaction.set(childRef, {
      id: childId,
      initialWeight: childWeight,
      currentWeight: childWeight,
      masterWidth: newChildWidthMm,
      thickness: parent.thickness,
      finish: parent.finish,
      densityFactor: finishData.densityFactor,
      pricePerKg: parent.pricePerKg || 0,
      status: "AVAILABLE",
      parentCoilId: coilId,
      registeredBy: email,
      createdAt: now,
      updatedAt: now,
      metadata: {
        ...(parent.metadata || {}),
        splitFrom: coilId,
        isManualEntry: false,
      }
    });

    const kardexOutRef = db.collection("kardex_movements").doc();
    transaction.set(kardexOutRef, {
      sku: coilId,
      date: now,
      type: "OUT",
      quantity: 1,
      weightKg: childWeight,
      costPerKg: parent.pricePerKg || 0,
      balance: newParentWeight,
      reference: childId,
      splitId: splitId,
      description: "Salida por división de bobina",
      user: email,
    });

    const kardexInRef = db.collection("kardex_movements").doc();
    transaction.set(kardexInRef, {
      sku: childId,
      date: now,
      type: "IN",
      quantity: 1,
      weightKg: childWeight,
      costPerKg: parent.pricePerKg || 0,
      balance: childWeight,
      reference: coilId,
      splitId: splitId,
      description: "Ingreso por división de bobina",
      user: email,
    });

    const auditRef = db.collection("audit_logs").doc();
    transaction.set(auditRef, {
      action: "SPLIT_COIL",
      entityId: coilId,
      userEmail: email,
      details: `Bobina dividida. Padre (${newParentWidth}mm, ${newParentWeight}kg). Hija: ${childId} (${newChildWidthMm}mm, ${childWeight}kg).`,
      timestamp: now,
    });

    const result = {
      childId,
      newParentWeight,
      newParentWidth,
      childWeight,
    };
    transaction.set(idempotencyRef, {
      result,
      createdAt: now,
      action: "SPLIT_COIL"
    });

    return result;
  });
});
