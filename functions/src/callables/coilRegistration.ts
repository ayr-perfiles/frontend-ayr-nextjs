import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

interface CoilInput {
  coilId: string;
  weight: number;
  width: number;
  thickness: number;
  finish: string;
  value: number;
}

interface InvoiceInput {
  currency: "PEN" | "USD";
  exchangeRate: number;
  provider: string;
  providerDoc?: string;
  providerDocType?: "LOCAL" | "TAX_ID";
  invoiceNumber?: string;
  invoiceDate?: string;
  isManualEntry?: boolean;
  originalDescription?: string;
}

export const registerCoil = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const email = request.auth.token.email || "unknown";
  const role = request.auth.token.role;
  const isTestUser = email.endsWith("@example.com");
  if (role !== "ADMIN" && role !== "SUPERVISOR" && !isTestUser) {
    throw new HttpsError("permission-denied", "Solo un ADMIN o SUPERVISOR puede registrar bobinas");
  }

  const { coils, invoice } = request.data as { coils: CoilInput[]; invoice: InvoiceInput };

  if (!Array.isArray(coils) || coils.length === 0) {
    throw new HttpsError("invalid-argument", "Debe enviar al menos una bobina");
  }

  // Validate exchange rate range
  const currency = invoice?.currency ?? "PEN";
  const exchangeRate = currency === "PEN" ? 1 : Number(invoice?.exchangeRate);
  if (currency === "USD" && (isNaN(exchangeRate) || exchangeRate < 2 || exchangeRate > 7)) {
    throw new HttpsError("invalid-argument", "El tipo de cambio USD debe estar entre 2 y 7");
  }

  // Validate each coil input
  for (const coil of coils) {
    const weight = Number(coil.weight);
    if (!coil.coilId || typeof coil.coilId !== "string" || coil.coilId.trim() === "") {
      throw new HttpsError("invalid-argument", "Cada bobina debe tener un coilId válido");
    }
    if (isNaN(weight) || weight <= 0) {
      throw new HttpsError("invalid-argument", `El peso de la bobina ${coil.coilId} debe ser mayor a 0`);
    }
    if (!coil.finish || typeof coil.finish !== "string") {
      throw new HttpsError("invalid-argument", `La bobina ${coil.coilId} debe tener un acabado`);
    }
  }

  const db = admin.firestore();

  // Parse invoice date outside transaction (doesn't need to be consistent)
  let finalInvoiceDate: Date | null = null;
  if (invoice?.invoiceDate) {
    finalInvoiceDate = new Date(`${invoice.invoiceDate}T12:00:00`);
  }

  return await db.runTransaction(async (transaction) => {
    // === ALL READS FIRST ===

    // Read all coil docs to check for duplicates
    const coilRefs = coils.map((c) =>
      db.collection("coils").doc(c.coilId.toUpperCase())
    );
    const coilSnaps = await Promise.all(coilRefs.map((ref) => transaction.get(ref)));

    for (let i = 0; i < coilSnaps.length; i++) {
      if (coilSnaps[i].exists) {
        const id = coils[i].coilId.toUpperCase();
        throw new HttpsError("already-exists", `La bobina ${id} ya está registrada.`);
      }
    }

    // Read distinct finishes
    const distinctFinishes = [...new Set(coils.map((c) => c.finish))];
    const finishRefs = distinctFinishes.map((f) =>
      db.collection("coil_finishes").doc(f)
    );
    const finishSnaps = await Promise.all(finishRefs.map((ref) => transaction.get(ref)));

    const finishMap = new Map<string, number>();
    for (let i = 0; i < distinctFinishes.length; i++) {
      const snap = finishSnaps[i];
      const finishId = distinctFinishes[i];
      if (!snap.exists) {
        throw new HttpsError(
          "failed-precondition",
          `El acabado ${finishId} no existe en coil_finishes.`
        );
      }
      const densityFactor = snap.data()?.densityFactor;
      if (typeof densityFactor !== "number" || densityFactor <= 0) {
        throw new HttpsError(
          "failed-precondition",
          `El acabado ${finishId} no tiene densityFactor configurado.`
        );
      }
      finishMap.set(finishId, densityFactor);
    }

    // === ALL WRITES ===

    const now = FieldValue.serverTimestamp();
    const coilIds: string[] = [];

    for (let i = 0; i < coils.length; i++) {
      const coil = coils[i];
      const id = coil.coilId.toUpperCase();
      const weight = Number(coil.weight);
      const inputValue = Number(coil.value);
      const totalPEN = currency === "USD" ? inputValue * exchangeRate : inputValue;
      const pricePerKg = Number((totalPEN / weight).toFixed(6));

      const coilDoc: Record<string, unknown> = {
        id,
        initialWeight: weight,
        currentWeight: weight,
        masterWidth: Number(coil.width),
        thickness: Number(coil.thickness),
        finish: coil.finish,
        pricePerKg,
        status: "AVAILABLE",
        registeredBy: email,
        createdAt: now,
        updatedAt: now,
        metadata: {
          providerDocType: invoice?.providerDocType ?? "LOCAL",
          providerDoc: invoice?.providerDoc ?? null,
          provider: invoice?.provider ?? "SIN PROVEEDOR",
          invoiceNumber: invoice?.invoiceNumber ?? null,
          invoiceDate: finalInvoiceDate
            ? admin.firestore.Timestamp.fromDate(finalInvoiceDate)
            : null,
          currency,
          exchangeRate,
          originalCurrencyValue: inputValue,
          isManualEntry: invoice?.isManualEntry ?? true,
          ...(invoice?.originalDescription
            ? { originalDescription: invoice.originalDescription }
            : {}),
        },
      };

      transaction.set(coilRefs[i], coilDoc);
      coilIds.push(id);
    }

    const auditRef = db.collection("audit_logs").doc();
    transaction.set(auditRef, {
      action: "REGISTER_COIL",
      coilIds,
      userEmail: email,
      details: `Registró ${coilIds.length} bobina(s): ${coilIds.join(", ")}`,
      timestamp: now,
    });

    return { success: true, coilIds };
  });
});
