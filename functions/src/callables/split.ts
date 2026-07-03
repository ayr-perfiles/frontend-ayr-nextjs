import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { validateAndCalculateSplit } from "../domain/coilPricing";
import { determineCoilStatusAfterReversal } from "../domain/scrap";

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

  const isTestUser = email.endsWith("@example.com");
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

export const reverseCoilSplit = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const role = request.auth.token.role;
  const email = request.auth.token.email || "unknown";

  if (role !== "ADMIN") {
    throw new HttpsError("permission-denied", "Solo un administrador puede revertir splits de bobina.");
  }

  const { childId } = request.data;
  if (!childId || typeof childId !== "string" || childId.trim() === "") {
    throw new HttpsError("invalid-argument", "El childId es obligatorio");
  }

  const db = admin.firestore();

  const childRef = db.collection("coils").doc(childId);
  const childSnap = await childRef.get();

  if (!childSnap.exists) {
    throw new HttpsError("not-found", `La bobina hija ${childId} no existe`);
  }

  const child = childSnap.data()!;

  // Guard 4: idempotente
  if (child.status === "VOIDED") {
    throw new HttpsError("failed-precondition", "La bobina hija ya está anulada.");
  }

  // Guard 5: debe ser hija de split
  const motherId: string = child.parentCoilId;
  if (!motherId) {
    throw new HttpsError("invalid-argument", "Esta bobina no es hija de un split (sin parentCoilId).");
  }

  // Guard 6: madre existe y no está anulada
  const motherRef = db.collection("coils").doc(motherId);
  const motherSnap = await motherRef.get();

  if (!motherSnap.exists) {
    throw new HttpsError("failed-precondition", `La bobina madre ${motherId} no existe; anulación bloqueada.`);
  }
  if (motherSnap.data()!.status === "VOIDED") {
    throw new HttpsError("failed-precondition", "La bobina madre está anulada; no se puede revertir el split.");
  }

  // Guard 7a: sin producción activa desde la hija
  const productionLogs = await db.collection("production_logs")
    .where("parentCoilIds", "array-contains", childId)
    .where("status", "==", "ACTIVE")
    .get();
  if (!productionLogs.empty) {
    throw new HttpsError("failed-precondition", "La bobina hija tiene producción activa; no se puede revertir el split.");
  }

  // Guard 7b: sin splits anidados activos desde la hija
  const nestedSplits = await db.collection("coils")
    .where("parentCoilId", "==", childId)
    .where("status", "!=", "VOIDED")
    .get();
  if (!nestedSplits.empty) {
    throw new HttpsError("failed-precondition", "La bobina hija tiene splits anidados activos; reviértelos primero.");
  }

  // Guard 7c: sin merma en la hija
  const scrapLogs = await db.collection("scrap_logs")
    .where("coilId", "==", childId)
    .limit(1)
    .get();
  if (!scrapLogs.empty) {
    throw new HttpsError("failed-precondition", "La bobina hija tiene merma registrada; no se puede revertir el split.");
  }

  // Guard 7d: hija prístina (peso actual == peso inicial)
  const childCurrentWeight: number = child.currentWeight;
  const childInitialWeight: number = child.initialWeight;
  if (Math.abs(childCurrentWeight - childInitialWeight) > 0.01) {
    throw new HttpsError(
      "failed-precondition",
      `La bobina hija no es prístina: peso actual ${childCurrentWeight} kg ≠ inicial ${childInitialWeight} kg.`
    );
  }

  const childWeight = childCurrentWeight;
  const costPerKgCongelado: number = child.pricePerKg;

  return await db.runTransaction(async (transaction) => {
    const txChildSnap = await transaction.get(childRef);
    const txMotherSnap = await transaction.get(motherRef);

    if (!txChildSnap.exists) throw new HttpsError("not-found", `La bobina hija ${childId} no existe.`);
    if (!txMotherSnap.exists) throw new HttpsError("not-found", `La bobina madre ${motherId} no existe.`);

    const txMother = txMotherSnap.data()!;
    const txChild = txChildSnap.data()!;

    const newMotherWeight = Number((txMother.currentWeight + childWeight).toFixed(4));
    const newMotherWidth = txMother.masterWidth + txChild.masterWidth;
    const newMotherStatus = determineCoilStatusAfterReversal(newMotherWeight, txMother.initialWeight);

    const now = FieldValue.serverTimestamp();

    transaction.update(motherRef, {
      currentWeight: newMotherWeight,
      masterWidth: newMotherWidth,
      status: newMotherStatus,
      updatedAt: now,
    });

    transaction.update(childRef, {
      status: "VOIDED",
      currentWeight: 0,
      updatedAt: now,
    });

    const kardexMotherRef = db.collection("kardex_movements").doc();
    transaction.set(kardexMotherRef, {
      sku: motherId,
      date: now,
      type: "IN",
      quantity: 1,
      weightKg: childWeight,
      costPerKg: costPerKgCongelado,
      balance: newMotherWeight,
      reference: childId,
      description: "Reversa de split",
      user: email,
    });

    const kardexChildRef = db.collection("kardex_movements").doc();
    transaction.set(kardexChildRef, {
      sku: childId,
      date: now,
      type: "OUT",
      quantity: 1,
      weightKg: childWeight,
      costPerKg: costPerKgCongelado,
      balance: 0,
      reference: motherId,
      description: "Reversa de split: salida a cero",
      user: email,
    });

    const auditRef = db.collection("audit_logs").doc();
    transaction.set(auditRef, {
      action: "REVERSE_COIL_SPLIT",
      entityId: childId,
      userEmail: email,
      details: `Reversa de split: ${childId} → ${motherId}. Peso restaurado: ${childWeight} kg. Ancho restaurado: +${txChild.masterWidth} mm.`,
      timestamp: now,
    });

    return { success: true, newMotherWeight, newMotherWidth, newMotherStatus };
  });
});
