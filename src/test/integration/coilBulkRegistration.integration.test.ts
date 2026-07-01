import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import * as admin from '../../../functions/node_modules/firebase-admin';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { clearFirestore } from './firestore-helpers';
import { registerCoilsBulk } from '../../../functions/src/callables/coilBulkRegistration';

const ADMIN_AUTH = { token: { role: "ADMIN", email: "admin@example.com" } };
const OPERATOR_AUTH = { token: { role: "OPERATOR", email: "op@ayrsteel.com" } };

describe('registerCoilsBulk (Integration)', () => {
  beforeAll(async () => {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: TEST_PROJECT_ID });
    }
  });

  beforeEach(async () => {
    await clearFirestore(TEST_PROJECT_ID);
    const adminDb = admin.firestore();
    
    // Sembrar coil_finishes con las llaves detectadas
    await adminDb.collection("coil_finishes").doc("GALVANIZADO").set({
      active: true, label: "Galvanizado", densityFactor: 0.00785, lines: ["drywall"],
    });
    await adminDb.collection("coil_finishes").doc("NATURAL").set({
      active: true, label: "Natural", densityFactor: 0.00785, lines: ["metallic-roofing"],
    });
    await adminDb.collection("coil_finishes").doc("AZUL").set({
      active: true, label: "Azul", densityFactor: 0.008, lines: ["metallic-roofing"],
    });
  });

  it('1. HAPPY 1 factura / 2 coils', async () => {
    const request = {
      data: {
        invoices: [{
          serie: "F001",
          nroDoc: "13070",
          fecha: "2026-06-30",
          provider: "Prov SA",
          providerDoc: "20123456789",
          currency: "PEN" as const,
          exchangeRate: 1,
          coils: [
            { finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 3708, value: 2862.58 }, // PEN
            { finish: "NATURAL", width: 1220, thickness: 0.40, weight: 1000, value: 1000 }
          ]
        }]
      },
      auth: ADMIN_AUTH,
    };

    const result = await registerCoilsBulk.run(request as any);
    expect(result).toHaveProperty('results');
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      invoice: "F001-13070",
      status: "created",
      count: 2
    });

    const adminDb = admin.firestore();
    const snap1 = await adminDb.collection("coils").doc("F001-13070-01").get();
    expect(snap1.exists).toBe(true);
    const coil1 = snap1.data()!;
    expect(coil1.id).toBe("F001-13070-01");
    expect(coil1.status).toBe("AVAILABLE");
    expect(coil1.initialWeight).toBe(3708);
    expect(coil1.currentWeight).toBe(3708);
    expect(coil1.masterWidth).toBe(1200);
    expect(coil1.thickness).toBe(0.45);
    expect(coil1.finish).toBe("GALVANIZADO");
    expect(coil1.pricePerKg).toBe(0.772001); // 2862.58 / 3708 = 0.772001... -> 0.772001
    expect(coil1.registeredBy).toBe("admin@example.com");

    const snap2 = await adminDb.collection("coils").doc("F001-13070-02").get();
    expect(snap2.exists).toBe(true);
  });

  it('2. USD conversión', async () => {
    const request = {
      data: {
        invoices: [{
          serie: "F002",
          nroDoc: "13071",
          fecha: "2026-06-30",
          provider: "Prov SA",
          providerDoc: "20123456789",
          currency: "USD" as const,
          exchangeRate: 3.5,
          coils: [
            { finish: "AZUL", width: 1219, thickness: 0.38, weight: 2000, value: 4000 } // USD 4000 -> PEN 14000 -> 7.0 per kg
          ]
        }]
      },
      auth: ADMIN_AUTH,
    };

    const result = await registerCoilsBulk.run(request as any);
    expect(result.results[0].status).toBe("created");

    const adminDb = admin.firestore();
    const snap1 = await adminDb.collection("coils").doc("F002-13071-01").get();
    expect(snap1.data()!.pricePerKg).toBe(7.0);
  });

  it('3. MULTI-factura fallo parcial', async () => {
    const request = {
      data: {
        invoices: [
          {
            serie: "F001", nroDoc: "001", fecha: "2026-06-30", provider: "A", providerDoc: "1", currency: "PEN" as const, exchangeRate: 1,
            coils: [{ finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 }]
          },
          {
            serie: "F002", nroDoc: "002", fecha: "2026-06-30", provider: "B", providerDoc: "2", currency: "PEN" as const, exchangeRate: 1,
            coils: [{ finish: "NO-EXISTE", width: 1200, thickness: 0.45, weight: 1000, value: 1000 }]
          },
          {
            serie: "F003", nroDoc: "003", fecha: "2026-06-30", provider: "C", providerDoc: "3", currency: "PEN" as const, exchangeRate: 1,
            coils: [{ finish: "AZUL", width: 1200, thickness: 0.45, weight: 1000, value: 1000 }]
          }
        ]
      },
      auth: ADMIN_AUTH,
    };

    const result = await registerCoilsBulk.run(request as any);
    expect(result.results).toHaveLength(3);
    
    expect(result.results[0]).toMatchObject({ invoice: "F001-001", status: "created", count: 1 });
    expect(result.results[1]).toMatchObject({ invoice: "F002-002", status: "failed", count: 0 });
    expect(result.results[2]).toMatchObject({ invoice: "F003-003", status: "created", count: 1 });

    const adminDb = admin.firestore();
    expect((await adminDb.collection("coils").doc("F001-001-01").get()).exists).toBe(true);
    expect((await adminDb.collection("coils").doc("F002-002-01").get()).exists).toBe(false);
    expect((await adminDb.collection("coils").doc("F003-003-01").get()).exists).toBe(true);
  });

  it('4. DEDUP skip-factura', async () => {
    const adminDb = admin.firestore();
    // Pre-sembrar una bobina de la factura F001-13070
    await adminDb.collection("coils").doc("F001-13070-01").set({ status: "AVAILABLE", initialWeight: 1000 });

    const request = {
      data: {
        invoices: [
          {
            serie: "F001", nroDoc: "13070", fecha: "2026-06-30", provider: "A", providerDoc: "1", currency: "PEN" as const, exchangeRate: 1,
            coils: [
              { finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 },
              { finish: "NATURAL", width: 1200, thickness: 0.40, weight: 1000, value: 1000 }
            ]
          },
          {
            serie: "F002", nroDoc: "12345", fecha: "2026-06-30", provider: "B", providerDoc: "2", currency: "PEN" as const, exchangeRate: 1,
            coils: [{ finish: "AZUL", width: 1200, thickness: 0.45, weight: 1000, value: 1000 }]
          }
        ]
      },
      auth: ADMIN_AUTH,
    };

    const result = await registerCoilsBulk.run(request as any);
    
    expect(result.results[0]).toMatchObject({ invoice: "F001-13070", status: "skipped-dup", count: 0 });
    expect(result.results[1]).toMatchObject({ invoice: "F002-12345", status: "created", count: 1 });

    // La bobina -02 de la F001-13070 no debió crearse (todo-o-nada skip por factura)
    expect((await adminDb.collection("coils").doc("F001-13070-02").get()).exists).toBe(false);
    // La bobina de la F002 sí debió crearse
    expect((await adminDb.collection("coils").doc("F002-12345-01").get()).exists).toBe(true);
  });

  it('5. TC fuera de rango', async () => {
    const request = {
      data: {
        invoices: [{
          serie: "F004", nroDoc: "999", fecha: "2026-06-30", provider: "Prov", providerDoc: "123",
          currency: "USD" as const, exchangeRate: 9, // Fuera de rango
          coils: [{ finish: "AZUL", width: 1200, thickness: 0.45, weight: 1000, value: 1000 }]
        }]
      },
      auth: ADMIN_AUTH,
    };

    const result = await registerCoilsBulk.run(request as any);
    expect(result.results[0].status).toBe("failed");

    const adminDb = admin.firestore();
    expect((await adminDb.collection("coils").doc("F004-999-01").get()).exists).toBe(false);
  });

  it('6. AUTH: caller OPERATOR → throw', async () => {
    const request = {
      data: { invoices: [] },
      auth: OPERATOR_AUTH,
    };
    
    await expect(registerCoilsBulk.run(request as any)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('7. AUDIT logs', async () => {
    const request = {
      data: {
        invoices: [{
          serie: "F005", nroDoc: "111", fecha: "2026-06-30", provider: "Prov SA", providerDoc: "20123456789", currency: "PEN" as const, exchangeRate: 1,
          coils: [{ finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 }]
        }]
      },
      auth: ADMIN_AUTH,
    };

    await registerCoilsBulk.run(request as any);

    const adminDb = admin.firestore();
    const auditSnap = await adminDb.collection("audit_logs").where("action", "==", "REGISTER_COIL_BULK").get();
    expect(auditSnap.size).toBe(1);
    
    const auditData = auditSnap.docs[0].data();
    expect(auditData.userEmail).toBe("admin@example.com");
    expect(auditData.coilIds).toContain("F005-111-01");
  });

  it('8. Fecha Válida YYYY-MM-DD se persiste correctamente', async () => {
    const request = {
      data: {
        invoices: [
          {
            serie: "F006", nroDoc: "INV4", fecha: "2026-06-30", provider: "D", providerDoc: "4", currency: "PEN" as const, exchangeRate: 1,
            coils: [{ finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 }]
          }
        ]
      },
      auth: ADMIN_AUTH,
    };

    const result = await registerCoilsBulk.run(request as any);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].status).toBe("created");

    const adminDb = admin.firestore();
    const snap = await adminDb.collection("coils").doc("F006-INV4-01").get();
    expect(snap.exists).toBe(true);
    const invoiceDateStr = snap.data()!.metadata.invoiceDate.toDate().toISOString().split('T')[0];
    expect(invoiceDateStr).toBe("2026-06-30");
  });

  it('9. BUG: Fecha ISO / Inválida NO debe crashear, debe ser failed', async () => {
    const request = {
      data: {
        invoices: [
          {
            serie: "F006", nroDoc: "INV1", fecha: "2026-06-30T16:50:00.000Z", provider: "A", providerDoc: "1", currency: "PEN" as const, exchangeRate: 1,
            coils: [{ finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 }]
          },
          {
            serie: "F006", nroDoc: "INV2", fecha: "2026-13-45", provider: "B", providerDoc: "2", currency: "PEN" as const, exchangeRate: 1,
            coils: [{ finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 }]
          },
          {
            serie: "F006", nroDoc: "INV3", fecha: "basura", provider: "C", providerDoc: "3", currency: "PEN" as const, exchangeRate: 1,
            coils: [{ finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 }]
          }
        ]
      },
      auth: ADMIN_AUTH,
    };

    const result = await registerCoilsBulk.run(request as any);
    expect(result.results).toHaveLength(3);

    // Los primeros 3 deben fallar limpiamente con reason
    expect(result.results[0].status).toBe("failed");
    expect(result.results[0].reason).toContain("formato YYYY-MM-DD");
    expect(result.results[1].status).toBe("failed");
    expect(result.results[1].reason).toContain("formato YYYY-MM-DD");
    expect(result.results[2].status).toBe("failed");
    expect(result.results[2].reason).toContain("formato YYYY-MM-DD");
  });

  it('10. BUG: Coil con width <= 0 o inválido falla la factura entera', async () => {
    const request = {
      data: {
        invoices: [
          {
            serie: "F010", nroDoc: "INV-W0", fecha: "2026-06-30", provider: "A", providerDoc: "1", currency: "PEN" as const, exchangeRate: 1,
            coils: [
              { finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 },
              { finish: "GALVANIZADO", width: 0, thickness: 0.45, weight: 1000, value: 1000 }
            ]
          }
        ]
      },
      auth: ADMIN_AUTH,
    };

    const result = await registerCoilsBulk.run(request as any);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].status).toBe("failed");
    expect(result.results[0].reason).toContain("Las dimensiones (ancho/espesor) deben ser numéricas y mayores a 0");

    const adminDb = admin.firestore();
    const q = await adminDb.collection("coils").where("invoice", "==", "F010-INV-W0").get();
    expect(q.size).toBe(0);
  });

  it('11. BUG: Coil con thickness <= 0 o inválido falla la factura entera', async () => {
    const request = {
      data: {
        invoices: [
          {
            serie: "F011", nroDoc: "INV-T0", fecha: "2026-06-30", provider: "A", providerDoc: "1", currency: "PEN" as const, exchangeRate: 1,
            coils: [
              { finish: "GALVANIZADO", width: 1200, thickness: -0.5, weight: 1000, value: 1000 }
            ]
          },
          {
            serie: "F011", nroDoc: "INV-TNAN", fecha: "2026-06-30", provider: "B", providerDoc: "2", currency: "PEN" as const, exchangeRate: 1,
            coils: [
              { finish: "GALVANIZADO", width: 1200, thickness: NaN, weight: 1000, value: 1000 }
            ]
          }
        ]
      },
      auth: ADMIN_AUTH,
    };

    const result = await registerCoilsBulk.run(request as any);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].status).toBe("failed");
    expect(result.results[0].reason).toContain("Las dimensiones (ancho/espesor) deben ser numéricas y mayores a 0");
    expect(result.results[1].status).toBe("failed");
    expect(result.results[1].reason).toContain("Las dimensiones (ancho/espesor) deben ser numéricas y mayores a 0");

    const adminDb = admin.firestore();
    const q1 = await adminDb.collection("coils").where("invoice", "==", "F011-INV-T0").get();
    expect(q1.size).toBe(0);
    const q2 = await adminDb.collection("coils").where("invoice", "==", "F011-INV-TNAN").get();
    expect(q2.size).toBe(0);
  });

  it('12. Sanidad: Factura con width/thickness válidos se crea correctamente', async () => {
    const request = {
      data: {
        invoices: [
          {
            serie: "F012", nroDoc: "INV-OK", fecha: "2026-06-30", provider: "A", providerDoc: "1", currency: "PEN" as const, exchangeRate: 1,
            coils: [
              { finish: "GALVANIZADO", width: 1219, thickness: 0.38, weight: 1000, value: 1000 }
            ]
          }
        ]
      },
      auth: ADMIN_AUTH,
    };

    const result = await registerCoilsBulk.run(request as any);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].status).toBe("created");
    expect(result.results[0].count).toBe(1);

    const adminDb = admin.firestore();
    const q = await adminDb.collection("coils").doc("F012-INV-OK-01").get();
    expect(q.exists).toBe(true);
    expect(q.data()!.masterWidth).toBe(1219);
    expect(q.data()!.thickness).toBe(0.38);
  });
});

