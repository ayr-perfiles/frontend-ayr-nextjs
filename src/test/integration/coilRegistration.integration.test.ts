import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import * as admin from '../../../functions/node_modules/firebase-admin';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { clearFirestore } from './firestore-helpers';
import { registerCoil } from '../../../functions/src/callables/coilRegistration';

const ADMIN_AUTH = { token: { role: "ADMIN", email: "admin@example.com" } };
const OPERATOR_AUTH = { token: { role: "OPERATOR", email: "op@ayrsteel.com" } };

const baseInvoice = {
  currency: "PEN" as const,
  exchangeRate: 1,
  provider: "Aceros SA",
  providerDoc: "20123456789",
  providerDocType: "LOCAL" as const,
  invoiceNumber: "F001-001",
  invoiceDate: "2026-06-30",
  isManualEntry: true,
};

describe('registerCoil (Integration)', () => {
  beforeAll(async () => {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: TEST_PROJECT_ID });
    }
  });

  beforeEach(async () => {
    await clearFirestore(TEST_PROJECT_ID);
    const adminDb = admin.firestore();
    await adminDb.collection("coil_finishes").doc("GALV").set({
      active: true, label: "Galvanizado", densityFactor: 0.00785, lines: ["drywall"],
    });
  });

  it('feliz PEN: 2 coils → creados con campos correctos + audit_log', async () => {
    const request = {
      data: {
        coils: [
          { coilId: "BOB-PEN-1", weight: 5000, width: 1200, thickness: 0.45, finish: "GALV", value: 15000 },
          { coilId: "BOB-PEN-2", weight: 3000, width: 900, thickness: 0.40, finish: "GALV", value: 9000 },
        ],
        invoice: baseInvoice,
      },
      auth: ADMIN_AUTH,
    };

    await registerCoil.run(request as any);

    const adminDb = admin.firestore();
    const snap1 = await adminDb.collection("coils").doc("BOB-PEN-1").get();
    const coil1 = snap1.data()!;
    expect(coil1.id).toBe("BOB-PEN-1");
    expect(coil1.status).toBe("AVAILABLE");
    expect(coil1.initialWeight).toBe(5000);
    expect(coil1.currentWeight).toBe(5000);
    expect(coil1.masterWidth).toBe(1200);
    expect(coil1.thickness).toBe(0.45);
    expect(coil1.finish).toBe("GALV");
    expect(coil1.pricePerKg).toBe(3.0); // 15000 / 5000 = 3.0
    expect(coil1.registeredBy).toBe("admin@example.com");
    expect(coil1.metadata.originalCurrencyValue).toBe(15000);
    expect(coil1.metadata.currency).toBe("PEN");
    expect(coil1.metadata.exchangeRate).toBe(1);

    const snap2 = await adminDb.collection("coils").doc("BOB-PEN-2").get();
    expect(snap2.data()!.pricePerKg).toBe(3.0); // 9000 / 3000 = 3.0

    const auditSnap = await adminDb.collection("audit_logs")
      .where("action", "==", "REGISTER_COIL").get();
    expect(auditSnap.size).toBe(1);
    expect(auditSnap.docs[0].data().coilIds).toEqual(["BOB-PEN-1", "BOB-PEN-2"]);
  });

  it('feliz USD: value=4000, exchangeRate=3.5, weight=2000 → pricePerKg=7.0', async () => {
    const request = {
      data: {
        coils: [{ coilId: "BOB-USD-1", weight: 2000, width: 1200, thickness: 0.45, finish: "GALV", value: 4000 }],
        invoice: { ...baseInvoice, currency: "USD" as const, exchangeRate: 3.5 },
      },
      auth: ADMIN_AUTH,
    };

    await registerCoil.run(request as any);

    const adminDb = admin.firestore();
    const snap = await adminDb.collection("coils").doc("BOB-USD-1").get();
    const coil = snap.data()!;
    expect(coil.pricePerKg).toBe(7.0); // 4000 * 3.5 / 2000 = 7.0
    expect(coil.metadata.currency).toBe("USD");
    expect(coil.metadata.exchangeRate).toBe(3.5);
    expect(coil.metadata.originalCurrencyValue).toBe(4000);
  });

  it('rechaza rol OPERATOR → permission-denied', async () => {
    const request = {
      data: { coils: [{ coilId: "BOB-X", weight: 1000, width: 1200, thickness: 0.45, finish: "GALV", value: 3000 }], invoice: baseInvoice },
      auth: OPERATOR_AUTH,
    };
    await expect(registerCoil.run(request as any)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rechaza weight <= 0 → invalid-argument', async () => {
    const request = {
      data: { coils: [{ coilId: "BOB-X", weight: 0, width: 1200, thickness: 0.45, finish: "GALV", value: 3000 }], invoice: baseInvoice },
      auth: ADMIN_AUTH,
    };
    await expect(registerCoil.run(request as any)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rechaza USD con exchangeRate fuera de rango [2,7] → invalid-argument', async () => {
    const request = {
      data: {
        coils: [{ coilId: "BOB-X", weight: 1000, width: 1200, thickness: 0.45, finish: "GALV", value: 3000 }],
        invoice: { ...baseInvoice, currency: "USD" as const, exchangeRate: 37 },
      },
      auth: ADMIN_AUTH,
    };
    await expect(registerCoil.run(request as any)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rechaza finish inexistente en coil_finishes → failed-precondition', async () => {
    const request = {
      data: {
        coils: [{ coilId: "BOB-X", weight: 1000, width: 1200, thickness: 0.45, finish: "NO-EXISTE", value: 3000 }],
        invoice: baseInvoice,
      },
      auth: ADMIN_AUTH,
    };
    await expect(registerCoil.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('dedup: coilId ya existe → already-exists + NINGÚN coil del batch creado', async () => {
    const adminDb = admin.firestore();
    await adminDb.collection("coils").doc("BOB-DUP-1").set({ status: "AVAILABLE", initialWeight: 1000 });

    const request = {
      data: {
        coils: [
          { coilId: "BOB-DUP-NEW", weight: 1000, width: 1200, thickness: 0.45, finish: "GALV", value: 3000 },
          { coilId: "BOB-DUP-1", weight: 2000, width: 900, thickness: 0.40, finish: "GALV", value: 6000 }, // ya existe
        ],
        invoice: baseInvoice,
      },
      auth: ADMIN_AUTH,
    };

    await expect(registerCoil.run(request as any)).rejects.toMatchObject({ code: 'already-exists' });

    // Atomicidad: el primero (nuevo) TAMPOCO debió crearse
    const newCoilSnap = await adminDb.collection("coils").doc("BOB-DUP-NEW").get();
    expect(newCoilSnap.exists).toBe(false);
  });

  it('ignora valores derivados del cliente: currentWeight, status, pricePerKg forzados backend', async () => {
    const request = {
      data: {
        coils: [{
          coilId: "BOB-BYPASS-1",
          weight: 5000,
          width: 1200,
          thickness: 0.45,
          finish: "GALV",
          value: 15000,
          // intento de inyección de campos forzados
          currentWeight: 999,
          status: "SOLD",
          pricePerKg: 0.01,
        }],
        invoice: baseInvoice,
      },
      auth: ADMIN_AUTH,
    };

    await registerCoil.run(request as any);

    const adminDb = admin.firestore();
    const snap = await adminDb.collection("coils").doc("BOB-BYPASS-1").get();
    const coil = snap.data()!;
    expect(coil.currentWeight).toBe(5000);     // forzado = weight
    expect(coil.status).toBe("AVAILABLE");     // forzado
    expect(coil.pricePerKg).toBe(3.0);         // recalculado: 15000/5000
  });
});
