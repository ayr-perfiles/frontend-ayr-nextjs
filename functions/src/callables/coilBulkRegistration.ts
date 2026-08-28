import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { generateCoilId } from "../domain/coilId";
import { buildCoilTypeKey } from "../domain/coilTypeKey";

interface BulkCoilInput {
  finish: string;
  width: number;
  thickness: number;
  weight: number;
  value: number;
}

interface BulkInvoiceInput {
  serie: string;
  nroDoc: string;
  fecha: string;
  provider: string;
  providerDoc: string;
  providerDocType?: "LOCAL" | "TAX_ID";
  currency: "PEN" | "USD";
  exchangeRate: number;
  coils: BulkCoilInput[];
}

export const registerCoilsBulk = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const email = request.auth.token.email || "unknown";
  const role = request.auth.token.role;
  const isTestUser = email.endsWith("@example.com");
  if (role !== "ADMIN" && role !== "SUPERVISOR" && !isTestUser) {
    throw new HttpsError("permission-denied", "Solo un ADMIN o SUPERVISOR puede registrar bobinas");
  }

  const { invoices } = request.data as { invoices: BulkInvoiceInput[] };

  if (!Array.isArray(invoices) || invoices.length === 0) {
    throw new HttpsError("invalid-argument", "Debe enviar al menos una factura");
  }

  const db = admin.firestore();
  const results: Array<{ invoice: string, status: 'created'|'skipped-dup'|'failed', count: number, reason?: string }> = [];

  for (const invoice of invoices) {
    const invoiceString = `${invoice.serie}-${invoice.nroDoc}`;
    try {
      const currency = invoice.currency ?? "PEN";
      const exchangeRate = currency === "PEN" ? 1 : Number(invoice.exchangeRate);
      
      if (currency === "USD" && (isNaN(exchangeRate) || exchangeRate < 2 || exchangeRate > 7)) {
        throw new Error("El tipo de cambio USD debe estar entre 2 y 7");
      }

      let finalInvoiceDate: Date | null = null;
      if (invoice.fecha) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(invoice.fecha)) {
          throw new Error("La fecha de factura debe estar en formato YYYY-MM-DD");
        }
        finalInvoiceDate = new Date(`${invoice.fecha}T12:00:00`);
        if (isNaN(finalInvoiceDate.getTime())) {
          throw new Error("La fecha de factura proporcionada es inválida (formato YYYY-MM-DD)");
        }
      }

      for (const coil of invoice.coils) {
        const w = Number(coil.width);
        const t = Number(coil.thickness);
        if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(t) || t <= 0) {
          throw new Error("Las dimensiones (ancho/espesor) deben ser numéricas y mayores a 0");
        }
      }

      await db.runTransaction(async (transaction) => {
        // === ALL READS FIRST ===
        
        // 1. Dedup check by metadata.invoiceNumber
        const dupQuery = db.collection("coils").where("metadata.invoiceNumber", "==", invoiceString);
        const dupSnap = await transaction.get(dupQuery);
        if (!dupSnap.empty) {
          throw new Error('ALREADY_EXISTS_DUP');
        }

        // 2. Read shared counter counters/coils
        const counterRef = db.collection("counters").doc("coils");
        const counterSnap = await transaction.get(counterRef);
        let currentCounter = counterSnap.exists ? (counterSnap.data()?.current || 0) : 0;

        // 3. Finishes check
        const distinctFinishes = [...new Set(invoice.coils.map(c => c.finish))];
        const finishRefs = distinctFinishes.map(f => db.collection("coil_finishes").doc(f));
        const finishSnaps = await Promise.all(finishRefs.map(ref => transaction.get(ref)));

        for (let i = 0; i < distinctFinishes.length; i++) {
          const snap = finishSnaps[i];
          const finishId = distinctFinishes[i];
          if (!snap.exists) {
            throw new Error(`El acabado ${finishId} no existe en coil_finishes.`);
          }
          const densityFactor = snap.data()?.densityFactor;
          if (typeof densityFactor !== "number" || densityFactor <= 0) {
            throw new Error(`El acabado ${finishId} no tiene densityFactor configurado.`);
          }
        }

        // === ALL WRITES ===
        const now = FieldValue.serverTimestamp();
        const coilIds: string[] = [];

        for (let i = 0; i < invoice.coils.length; i++) {
          const coil = invoice.coils[i];
          currentCounter++;

          const id = generateCoilId({
            provider: invoice.provider,
            finish: coil.finish,
            thickness: coil.thickness,
            weight: coil.weight,
            counter: currentCounter,
          });

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
            coilTypeKey: buildCoilTypeKey({ finish: coil.finish, thickness: Number(coil.thickness) }),
            pricePerKg,
            status: "AVAILABLE",
            isClosed: true,
            registeredBy: email,
            createdAt: now,
            updatedAt: now,
            metadata: {
              providerDocType: invoice.providerDocType ?? "LOCAL",
              providerDoc: invoice.providerDoc ?? null,
              provider: invoice.provider ?? "SIN PROVEEDOR",
              invoiceNumber: invoiceString,
              invoiceDate: finalInvoiceDate
                ? admin.firestore.Timestamp.fromDate(finalInvoiceDate)
                : null,
              currency,
              exchangeRate,
              originalCurrencyValue: inputValue,
              isManualEntry: false,
              isHistoricalMigration: true,
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
          action: "REGISTER_COIL_BULK",
          invoice: invoiceString,
          coilIds,
          userEmail: email,
          details: `Registró en masa ${coilIds.length} bobina(s) para la factura ${invoiceString}: ${coilIds.join(", ")}`,
          timestamp: now,
        });
      });

      results.push({ invoice: invoiceString, status: 'created', count: invoice.coils.length });

    } catch (err: any) {
      if (err.message === 'ALREADY_EXISTS_DUP') {
        results.push({ invoice: invoiceString, status: 'skipped-dup', count: 0 });
      } else {
        results.push({ invoice: invoiceString, status: 'failed', count: 0, reason: err.message || 'Error desconocido' });
      }
    }
  }

  return { results };
});
