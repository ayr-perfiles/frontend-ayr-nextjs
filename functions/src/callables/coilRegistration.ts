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

  const { coils, invoice, requestId } = request.data as { coils: CoilInput[]; invoice: InvoiceInput; requestId: string };

  if (!requestId || typeof requestId !== "string") {
    throw new HttpsError("invalid-argument", "El requestId es obligatorio para garantizar idempotencia");
  }

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
    if (isNaN(weight) || weight <= 0) {
      throw new HttpsError("invalid-argument", `El peso de la bobina debe ser mayor a 0`);
    }
    if (!coil.finish || typeof coil.finish !== "string") {
      throw new HttpsError("invalid-argument", `La bobina debe tener un acabado`);
    }
  }

  const provParts = (invoice?.provider || "PROV").toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  const provCode = provParts.length > 0 ? provParts[0].substring(0, 6) : "PROV";

  const db = admin.firestore();

  // Parse invoice date outside transaction (doesn't need to be consistent)
  let finalInvoiceDate: Date | null = null;
  if (invoice?.invoiceDate) {
    finalInvoiceDate = new Date(`${invoice.invoiceDate}T12:00:00`);
  }

  return await db.runTransaction(async (transaction) => {
    // === ALL READS FIRST ===
    const idempotencyRef = db.collection("idempotency_keys").doc(requestId);
    const idempotencySnap = await transaction.get(idempotencyRef);
    if (idempotencySnap.exists) {
      return idempotencySnap.data()!.result as { success: boolean, coilIds: string[] };
    }

    const counterRef = db.collection("counters").doc("coils");
    const counterSnap = await transaction.get(counterRef);
    let currentCounter = counterSnap.exists ? (counterSnap.data()?.current || 0) : 0;

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
      currentCounter++;
      
      const safeFinish = coil.finish.toUpperCase().replace(/[^A-Z0-9-]/g, "");
      const esp = Math.round(Number(coil.thickness) * 100).toString().padStart(3, "0");
      const peso = Math.round(Number(coil.weight)).toString();
      const nnnnn = currentCounter.toString().padStart(5, "0");
      
      const id = `${provCode}-${safeFinish}-${esp}-${peso}-${nnnnn}`;
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
        isClosed: true,
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

      const coilRef = db.collection("coils").doc(id);
      transaction.set(coilRef, coilDoc);
      coilIds.push(id);
    }

    transaction.set(counterRef, {
      current: currentCounter,
      updatedAt: now,
    }, { merge: true });

    const auditRef = db.collection("audit_logs").doc();
    transaction.set(auditRef, {
      action: "REGISTER_COIL",
      coilIds,
      userEmail: email,
      details: `Registró ${coilIds.length} bobina(s): ${coilIds.join(", ")}`,
      timestamp: now,
    });

    const result = { success: true, coilIds };
    transaction.set(idempotencyRef, {
      result,
      createdAt: now,
    });

    return result;
  });
});
