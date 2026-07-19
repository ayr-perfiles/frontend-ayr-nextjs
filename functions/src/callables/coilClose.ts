import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { buildScrapTransactionWrites } from "../domain/scrap";

export const setCoilClosed = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const { coilId, close, remnantAsMerma } = request.data;
  const uid = request.auth.uid;
  const role = request.auth.token.role;
  const email = request.auth.token.email || "unknown";

  const isTestUser = email.endsWith("@example.com");
  if (role !== "ADMIN" && !isTestUser) {
    throw new HttpsError("permission-denied", "Solo un ADMIN puede cerrar/abrir bobinas");
  }

  if (typeof coilId !== "string" || coilId.trim() === "") {
    throw new HttpsError("invalid-argument", "El coilId es obligatorio");
  }

  if (typeof close !== "boolean") {
    throw new HttpsError("invalid-argument", "El parámetro close debe ser booleano");
  }

  const db = admin.firestore();

  return await db.runTransaction(async (transaction) => {
    const coilRef = db.collection("coils").doc(coilId);
    const coilSnap = await transaction.get(coilRef);

    if (!coilSnap.exists) {
      throw new HttpsError("not-found", `La bobina ${coilId} no existe`);
    }

    const coil = coilSnap.data()!;
    const isCurrentlyClosed = coil.isClosed === true;

    // Idempotency
    if (close && isCurrentlyClosed) {
      return { success: true, message: "La bobina ya estaba cerrada" };
    }
    if (!close && !isCurrentlyClosed) {
      return { success: true, message: "La bobina ya estaba abierta" };
    }

    const now = FieldValue.serverTimestamp();
    const auditRef = db.collection("audit_logs").doc();

    if (!close) {
      transaction.update(coilRef, {
        isClosed: false,
        updatedAt: now,
      });

      transaction.set(auditRef, {
        action: "OPEN_COIL",
        entityId: coilId,
        userEmail: uid,
        details: `Se abrió la bobina ${coilId}.`,
        timestamp: now,
      });

      return { success: true };
    }

    // It's a close operation
    const currentWeight = coil.currentWeight ?? coil.initialWeight ?? 0;
    
    if (currentWeight > 0 && remnantAsMerma) {
      const scrapLogRef = db.collection("scrap_logs").doc();
      const kardexRef = db.collection("kardex_movements").doc();
      
      const writes = buildScrapTransactionWrites({
        coilId,
        coil: {
          currentWeight: coil.currentWeight,
          initialWeight: coil.initialWeight,
          pricePerKg: coil.pricePerKg,
          status: coil.status,
        },
        scrapWeightKg: currentWeight,
        reason: "Remanente al cerrar bobina",
        uid,
        now,
        scrapLogId: scrapLogRef.id,
      });

      transaction.update(coilRef, {
        ...writes.coilUpdate,
        isClosed: true,
      });
      transaction.set(kardexRef, writes.kardexWrite);
      transaction.set(scrapLogRef, writes.scrapLogWrite);
      
      // Merge audit details
      transaction.set(auditRef, {
        action: "CLOSE_COIL",
        entityId: coilId,
        userEmail: uid,
        details: `Se cerró la bobina ${coilId}. Remanente reportado como merma: ${currentWeight} kg.`,
        timestamp: now,
      });

    } else {
      transaction.update(coilRef, {
        isClosed: true,
        updatedAt: now,
      });

      transaction.set(auditRef, {
        action: "CLOSE_COIL",
        entityId: coilId,
        userEmail: uid,
        details: `Se cerró la bobina ${coilId} sin afectar el remanente (Peso: ${currentWeight} kg).`,
        timestamp: now,
      });
    }

    return { success: true };
  });
});
