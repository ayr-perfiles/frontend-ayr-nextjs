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
        requestId: "test-req-pen-1",
      },
      auth: ADMIN_AUTH,
    };

    const result: any = await registerCoil.run(request as any);
    const coilId1 = result.coilIds[0];
    const coilId2 = result.coilIds[1];

    const adminDb = admin.firestore();
    const snap1 = await adminDb.collection("coils").doc(coilId1).get();
    const coil1 = snap1.data()!;
    expect(coil1.id).toBe(coilId1);
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

    const snap2 = await adminDb.collection("coils").doc(coilId2).get();
    expect(snap2.data()!.pricePerKg).toBe(3.0); // 9000 / 3000 = 3.0

    const auditSnap = await adminDb.collection("audit_logs")
      .where("action", "==", "REGISTER_COIL").get();
    expect(auditSnap.size).toBe(1);
    expect(auditSnap.docs[0].data().coilIds).toEqual([coilId1, coilId2]);
  });

  it('feliz USD: value=4000, exchangeRate=3.5, weight=2000 → pricePerKg=7.0', async () => {
    const request = {
      data: {
        coils: [{ coilId: "BOB-USD-1", weight: 2000, width: 1200, thickness: 0.45, finish: "GALV", value: 4000 }],
        invoice: { ...baseInvoice, currency: "USD" as const, exchangeRate: 3.5 },
        requestId: "test-req-usd-1",
      },
      auth: ADMIN_AUTH,
    };

    const result: any = await registerCoil.run(request as any);
    const coilId = result.coilIds[0];

    const adminDb = admin.firestore();
    const snap = await adminDb.collection("coils").doc(coilId).get();
    const coil = snap.data()!;
    expect(coil.pricePerKg).toBe(7.0); // 4000 * 3.5 / 2000 = 7.0
    expect(coil.metadata.currency).toBe("USD");
    expect(coil.metadata.exchangeRate).toBe(3.5);
    expect(coil.metadata.originalCurrencyValue).toBe(4000);
  });

  it('rechaza rol OPERATOR → permission-denied', async () => {
    const request = {
      data: { coils: [{ coilId: "BOB-X", weight: 1000, width: 1200, thickness: 0.45, finish: "GALV", value: 3000 }], invoice: baseInvoice, requestId: "test-req-op-1" },
      auth: OPERATOR_AUTH,
    };
    await expect(registerCoil.run(request as any)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rechaza weight <= 0 → invalid-argument', async () => {
    const request = {
      data: { coils: [{ coilId: "BOB-X", weight: 0, width: 1200, thickness: 0.45, finish: "GALV", value: 3000 }], invoice: baseInvoice, requestId: "test-req-w-1" },
      auth: ADMIN_AUTH,
    };
    await expect(registerCoil.run(request as any)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rechaza USD con exchangeRate fuera de rango [2,7] → invalid-argument', async () => {
    const request = {
      data: {
        coils: [{ coilId: "BOB-X", weight: 1000, width: 1200, thickness: 0.45, finish: "GALV", value: 3000 }],
        invoice: { ...baseInvoice, currency: "USD" as const, exchangeRate: 37 },
        requestId: "test-req-usd-2",
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
        requestId: "test-req-fin-1",
      },
      auth: ADMIN_AUTH,
    };
    await expect(registerCoil.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('mismo invoiceNumber con distinto requestId SÍ crea la bobina (single no deduplica por invoiceNumber a propósito)', async () => {
    // Aclaración: En el registro manual/XML, una misma factura física puede tener múltiples bobinas que se cargan de a una.
    // Por ende, 'registerCoil' NO debe bloquear por invoiceNumber. La dedup por factura es exclusiva del bulk (importación Excel).
    const adminDb = admin.firestore();
    const testInvoice = { ...baseInvoice, invoiceNumber: "F-DUP-SINGLE" };

    const req1 = {
      data: {
        coils: [{ coilId: "B1", weight: 1000, width: 1200, thickness: 0.45, finish: "GALV", value: 3000 }],
        invoice: testInvoice,
        requestId: "req-single-1",
      },
      auth: ADMIN_AUTH,
    };
    
    const req2 = {
      data: {
        coils: [{ coilId: "B2", weight: 2000, width: 900, thickness: 0.40, finish: "GALV", value: 6000 }],
        invoice: testInvoice,
        requestId: "req-single-2",
      },
      auth: ADMIN_AUTH,
    };

    // Primera bobina (con la factura F-DUP-SINGLE)
    const result1: any = await registerCoil.run(req1 as any);
    expect(result1.success).toBe(true);

    // Segunda bobina (con la MISMA factura pero DISTINTO requestId)
    // Debería pasar, a diferencia del bulk que bloquearía esto.
    const result2: any = await registerCoil.run(req2 as any);
    expect(result2.success).toBe(true);

    // Verificamos que ambas bobinas existan en base de datos
    const snap1 = await adminDb.collection("coils").doc(result1.coilIds[0]).get();
    const snap2 = await adminDb.collection("coils").doc(result2.coilIds[0]).get();
    
    expect(snap1.exists).toBe(true);
    expect(snap2.exists).toBe(true);
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
        requestId: "test-req-bypass-1",
      },
      auth: ADMIN_AUTH,
    };

    const result: any = await registerCoil.run(request as any);
    const coilId = result.coilIds[0];

    const adminDb = admin.firestore();
    const snap = await adminDb.collection("coils").doc(coilId).get();
    const coil = snap.data()!;
    expect(coil.currentWeight).toBe(5000);     // forzado = weight
    expect(coil.status).toBe("AVAILABLE");     // forzado
    expect(coil.pricePerKg).toBe(3.0);         // recalculado: 15000/5000
  });
  it('rechaza si falta requestId en el payload (guard v6.22)', async () => {
    const request = {
      data: {
        coils: [{ coilId: "BOB-NOREQ", weight: 5000, width: 1200, thickness: 0.45, finish: "GALV", value: 15000 }],
        invoice: baseInvoice,
      },
      auth: ADMIN_AUTH,
    };
    await expect(registerCoil.run(request as any)).rejects.toMatchObject({ code: 'invalid-argument', message: /requestId/ });
  });

  it('idempotencia real: dos llamadas con el mismo requestId solo crean docs la primera vez', async () => {
    const request = {
      data: {
        coils: [{ coilId: "BOB-IDEM", weight: 5000, width: 1200, thickness: 0.45, finish: "GALV", value: 15000 }],
        invoice: baseInvoice,
        requestId: "test-req-idempotent-1",
      },
      auth: ADMIN_AUTH,
    };

    const result1: any = await registerCoil.run(request as any);
    expect(result1).toMatchObject({ success: true });
    const coilId = result1.coilIds[0];

    // Verificar que se crearon los documentos
    const adminDb = admin.firestore();
    const snap1 = await adminDb.collection("coils").doc(coilId).get();
    expect(snap1.exists).toBe(true);

    const audit1 = await adminDb.collection("audit_logs").where("action", "==", "REGISTER_COIL").get();
    const kardex1 = await adminDb.collection("kardex_movements").where("sku", "==", coilId).get();

    // Segunda llamada
    const result2 = await registerCoil.run(request as any);
    expect(result2).toMatchObject({ success: true }); // retorna early cached success

    // Verificar que NO se duplicaron registros
    const audit2 = await adminDb.collection("audit_logs").where("action", "==", "REGISTER_COIL").get();
    const kardex2 = await adminDb.collection("kardex_movements").where("sku", "==", coilId).get();

    expect(audit2.size).toBe(audit1.size);
    expect(kardex2.size).toBe(kardex1.size);
  });
});
