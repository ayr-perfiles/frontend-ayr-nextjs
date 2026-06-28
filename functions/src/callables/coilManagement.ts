import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export const voidCoil = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const role = request.auth.token.role;
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    throw new HttpsError("permission-denied", "Solo un ADMIN o SUPERVISOR puede anular bobinas");
  }

  const { coilId } = request.data;
  if (!coilId) {
    throw new HttpsError("invalid-argument", "El coilId es obligatorio");
  }

  const email = request.auth.token.email || "unknown";
  const db = admin.firestore();

  return await db.runTransaction(async (transaction) => {
    const coilRef = db.collection("coils").doc(coilId);
    const coilSnap = await transaction.get(coilRef);

    if (!coilSnap.exists) {
      throw new HttpsError("not-found", "La bobina no existe.");
    }

    const coilData = coilSnap.data()!;

    if (coilData.status !== "AVAILABLE") {
      throw new HttpsError(
        "failed-precondition",
        "Solo se pueden anular bobinas DISPONIBLES. Si ya tiene cortes, anula los cortes primero."
      );
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    transaction.update(coilRef, {
      status: "VOIDED",
      voidedBy: email,
      voidedAt: now,
      updatedAt: now,
    });

    const auditRef = db.collection("audit_logs").doc();
    transaction.set(auditRef, {
      action: "VOID_COIL",
      entityId: coilId,
      userEmail: email,
      details: `Se anuló el ingreso de la bobina madre: ${coilId}`,
      timestamp: now,
    });

    return { success: true };
  });
});

export const updateCoil = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const role = request.auth.token.role;
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    throw new HttpsError("permission-denied", "Solo un ADMIN o SUPERVISOR puede editar bobinas");
  }

  const { coilId, updates } = request.data;
  if (!coilId || !updates || typeof updates !== "object") {
    throw new HttpsError("invalid-argument", "Faltan datos obligatorios para la edición");
  }

  const email = request.auth.token.email || "unknown";
  const db = admin.firestore();

  return await db.runTransaction(async (transaction) => {
    const coilRef = db.collection("coils").doc(coilId);
    const coilSnap = await transaction.get(coilRef);

    if (!coilSnap.exists) {
      throw new HttpsError("not-found", "La bobina no existe.");
    }

    const coilData = coilSnap.data()!;

    if (coilData.status !== "AVAILABLE") {
      throw new HttpsError(
        "failed-precondition",
        "Solo puedes editar bobinas DISPONIBLES para no corromper los costos actuales."
      );
    }

    const initialWeight = Number(updates.initialWeight);
    if (isNaN(initialWeight) || initialWeight <= 0) {
        throw new HttpsError("invalid-argument", "El initialWeight es inválido");
    }

    let finalInvoiceDate = null;
    if (updates.invoiceDate) {
      // Usar fecha a las 12:00:00 para evitar problemas de timezone
      finalInvoiceDate = new Date(`${updates.invoiceDate}T12:00:00`);
    }

    const updatePayload: Record<string, any> = {
      initialWeight: initialWeight,
      currentWeight: initialWeight, // derivado, ignoramos el del cliente
      masterWidth: updates.masterWidth,
      thickness: updates.thickness,
      finish: updates.finish,
      pricePerKg: updates.pricePerKg,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Actualizar metadata flat
    if (updates.providerName !== undefined) {
      updatePayload["metadata.providerName"] = updates.providerName;
      updatePayload["metadata.provider"] = updates.providerName;
    }
    if (updates.providerDoc !== undefined) {
      updatePayload["metadata.providerDoc"] = updates.providerDoc;
    }
    if (updates.providerDocType !== undefined) {
      updatePayload["metadata.providerDocType"] = updates.providerDocType;
    }
    if (updates.invoiceNumber !== undefined) {
      updatePayload["metadata.invoiceNumber"] = updates.invoiceNumber;
    }
    if (finalInvoiceDate) {
      updatePayload["metadata.invoiceDate"] = admin.firestore.Timestamp.fromDate(finalInvoiceDate);
    }

    transaction.update(coilRef, updatePayload);

    const auditRef = db.collection("audit_logs").doc();
    transaction.set(auditRef, {
      action: "EDIT_COIL",
      entityId: coilId,
      userEmail: email,
      details: `Editó bobina: Peso ${initialWeight}kg, Espesor ${updates.thickness}mm, Acabado ${updates.finish}, Valor /Kg S/ ${updates.pricePerKg}.`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  });
});

export const cancelCoilPlan = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const role = request.auth.token.role;
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    throw new HttpsError("permission-denied", "Solo un ADMIN o SUPERVISOR puede cancelar planes");
  }

  const { coilId } = request.data;
  if (!coilId) {
    throw new HttpsError("invalid-argument", "El coilId es obligatorio");
  }

  const email = request.auth.token.email || "unknown";
  const db = admin.firestore();

  return await db.runTransaction(async (transaction) => {
    const coilRef = db.collection("coils").doc(coilId);
    const coilSnap = await transaction.get(coilRef);

    if (!coilSnap.exists) {
      throw new HttpsError("not-found", "La bobina no existe.");
    }

    const coilData = coilSnap.data()!;

    if (coilData.status !== "IN_PROGRESS") {
      throw new HttpsError(
        "failed-precondition",
        "Solo se pueden cancelar planes de bobinas EN PROCESO."
      );
    }

    const plannedStrips = coilData.plannedStrips || [];
    const hasProcessedStrips = plannedStrips.some(
      (strip: any) => strip.initialCount !== strip.pendingCount
    );

    if (hasProcessedStrips) {
      throw new HttpsError(
        "failed-precondition",
        "⛔ IMPOSIBLE CANCELAR: Ya se han ejecutado cortes en esta bobina. Para cancelar, primero debes anular los cortes realizados desde el historial de producción."
      );
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    
    transaction.update(coilRef, {
      status: "AVAILABLE",
      plannedStrips: [],
      updatedAt: now,
    });

    const auditRef = db.collection("audit_logs").doc();
    transaction.set(auditRef, {
      action: "CANCEL_CUTTING_PLAN",
      entityId: coilId,
      userEmail: email,
      details: "Canceló plan de corte/producción. Bobina devuelta a DISPONIBLE de forma segura.",
      timestamp: now,
    });

    return { success: true };
  });
});
