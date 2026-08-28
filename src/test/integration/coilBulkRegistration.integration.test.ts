import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import * as admin from '../../../functions/node_modules/firebase-admin';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { clearFirestore } from './firestore-helpers';
import { registerCoilsBulk } from '../../../functions/src/callables/coilBulkRegistration';

const ADMIN_AUTH = { token: { role: "ADMIN", email: "admin@example.com" } };
const OPERATOR_AUTH = { token: { role: "OPERATOR", email: "op@ayrsteel.com" } };

describe('registerCoilsBulk (Integration Composite ID & Dedup)', () => {
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
    await adminDb.collection("coil_finishes").doc("GALV").set({
      active: true, label: "Galv", densityFactor: 0.00785, lines: ["drywall"],
    });
    await adminDb.collection("coil_finishes").doc("NATURAL").set({
      active: true, label: "Natural", densityFactor: 0.00785, lines: ["metallic-roofing"],
    });
    await adminDb.collection("coil_finishes").doc("AZUL").set({
      active: true, label: "Azul", densityFactor: 0.008, lines: ["metallic-roofing"],
    });
    await adminDb.collection("coil_finishes").doc("ALU-AZUL").set({
      active: true, label: "Aluzinc Azul", densityFactor: 0.008, lines: ["metallic-roofing"],
    });
  });

  it('1. ID FORMATO: 1 invoice, 2 bobinas -> composite ID (PROV-ACABADO-ESP-PESO-NNNNN), provCode primera palabra 6 chars', async () => {
    const request = {
      data: {
        invoices: [{
          serie: "F001",
          nroDoc: "13070",
          fecha: "2026-06-30",
          provider: "REPRESENTACIONES JAVI",
          providerDoc: "20123456789",
          currency: "PEN" as const,
          exchangeRate: 1,
          coils: [
            { finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 3708, value: 2862.58 },
            { finish: "NATURAL", width: 1220, thickness: 0.40, weight: 1000, value: 1000 }
          ]
        }]
      },
      auth: ADMIN_AUTH,
    };

    const result = await registerCoilsBulk.run(request as any);
    expect(result.results[0]).toMatchObject({ invoice: "F001-13070", status: "created", count: 2 });

    const adminDb = admin.firestore();
    const coilsSnap = await adminDb.collection("coils").where("metadata.invoiceNumber", "==", "F001-13070").get();
    expect(coilsSnap.size).toBe(2);

    for (const doc of coilsSnap.docs) {
      expect(doc.id).toMatch(/^[A-Z0-9]{1,6}-[A-Z0-9-]+-\d{3}-\d+-\d{5}$/);
      expect(doc.id).not.toMatch(/^F001-13070-\d{2}$/);
      expect(doc.id.startsWith("REPRES-")).toBe(true);
    }

    // [COIL-TYPE-KEY] cada doc del lote lleva su propia clave correcta
    const byThickness = coilsSnap.docs.map((d) => d.data());
    const galvanizado = byThickness.find((c) => c.finish === "GALVANIZADO")!;
    const natural = byThickness.find((c) => c.finish === "NATURAL")!;
    expect(galvanizado.coilTypeKey).toBe("BOB-GALVANIZADO-045");
    expect(natural.coilTypeKey).toBe("BOB-NATURAL-040");
  });

  it('[COIL-TYPE-KEY] thickness invalido en un item -> ese invoice queda "failed" con motivo claro, NO crea coils de ese invoice', async () => {
    const request = {
      data: {
        invoices: [{
          serie: "F002",
          nroDoc: "99000",
          fecha: "2026-06-30",
          provider: "PROV BAD",
          providerDoc: "20123456789",
          currency: "PEN" as const,
          exchangeRate: 1,
          coils: [
            { finish: "GALV", width: 1200, thickness: 0, weight: 1000, value: 3000 },
          ]
        }]
      },
      auth: ADMIN_AUTH,
    };

    const result = await registerCoilsBulk.run(request as any);
    expect(result.results[0].status).toBe("failed");
    expect(result.results[0].reason).toBeTruthy();

    const adminDb = admin.firestore();
    const coilsSnap = await adminDb.collection("coils").where("metadata.invoiceNumber", "==", "F002-99000").get();
    expect(coilsSnap.size).toBe(0);
  });

  it('1b. KEY CON GUION INTACTA: finish="ALU-AZUL" -> doc.id contiene "-ALU-AZUL-", finish="GALV" -> "-GALV-"', async () => {
    const request = {
      data: {
        invoices: [{
          serie: "F001",
          nroDoc: "13071",
          fecha: "2026-06-30",
          provider: "PROV SA",
          providerDoc: "20123456789",
          currency: "PEN" as const,
          exchangeRate: 1,
          coils: [
            { finish: "ALU-AZUL", width: 1200, thickness: 0.45, weight: 2000, value: 2000 },
            { finish: "GALV", width: 1200, thickness: 0.45, weight: 2000, value: 2000 }
          ]
        }]
      },
      auth: ADMIN_AUTH,
    };

    const result = await registerCoilsBulk.run(request as any);
    expect(result.results[0].status).toBe("created");

    const adminDb = admin.firestore();
    const coilsSnap = await adminDb.collection("coils").where("metadata.invoiceNumber", "==", "F001-13071").get();
    expect(coilsSnap.size).toBe(2);

    const docIds = coilsSnap.docs.map(d => d.id);
    const aluAzulDoc = docIds.find(id => id.includes("-ALU-AZUL-"));
    const galvDoc = docIds.find(id => id.includes("-GALV-"));

    expect(aluAzulDoc).toBeDefined();
    expect(aluAzulDoc).toMatch(/-ALU-AZUL-\d{3}-/);
    expect(galvDoc).toBeDefined();
    expect(galvDoc).toMatch(/-GALV-\d{3}-/);
  });

  it('2. COUNTER COMPARTIDO: counters/coils.current sube +2 y luego +1', async () => {
    const adminDb = admin.firestore();
    await adminDb.collection("counters").doc("coils").set({ current: 10, updatedAt: new Date() });

    const req1 = {
      data: {
        invoices: [{
          serie: "F001", nroDoc: "100", fecha: "2026-06-30", provider: "PROV", currency: "PEN" as const, exchangeRate: 1,
          coils: [
            { finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 },
            { finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 }
          ]
        }]
      },
      auth: ADMIN_AUTH,
    };
    await registerCoilsBulk.run(req1 as any);

    let counterSnap = await adminDb.collection("counters").doc("coils").get();
    expect(counterSnap.data()?.current).toBe(12);

    const req2 = {
      data: {
        invoices: [{
          serie: "F001", nroDoc: "101", fecha: "2026-06-30", provider: "PROV", currency: "PEN" as const, exchangeRate: 1,
          coils: [
            { finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 }
          ]
        }]
      },
      auth: ADMIN_AUTH,
    };
    await registerCoilsBulk.run(req2 as any);

    counterSnap = await adminDb.collection("counters").doc("coils").get();
    expect(counterSnap.data()?.current).toBe(13);
  });

  it('3. DEDUP re-import: re-importar mismo serie/nroDoc -> skipped-dup por query metadata.invoiceNumber (incluso con ID no-posicional)', async () => {
    const adminDb = admin.firestore();
    // Sembrar manualmente 1 bobina con metadata.invoiceNumber=="F001-999" PERO con doc.id "SEED-XYZ"
    await adminDb.collection("coils").doc("SEED-XYZ").set({
      status: "AVAILABLE",
      initialWeight: 1000,
      metadata: { invoiceNumber: "F001-999" }
    });

    const req = {
      data: {
        invoices: [{
          serie: "F001", nroDoc: "999", fecha: "2026-06-30", provider: "PROV", currency: "PEN" as const, exchangeRate: 1,
          coils: [
            { finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 },
            { finish: "NATURAL", width: 1200, thickness: 0.45, weight: 1000, value: 1000 }
          ]
        }]
      },
      auth: ADMIN_AUTH,
    };

    const res = await registerCoilsBulk.run(req as any);
    expect(res.results[0].status).toBe("skipped-dup");

    const coilsSnap = await adminDb.collection("coils").where("metadata.invoiceNumber", "==", "F001-999").get();
    expect(coilsSnap.size).toBe(1); // Sigue 1 (solo la semilla)
  });

  it('4. DEDUP tolera VOIDED: bobina VOIDED con invoiceNumber y doc.id no-posicional -> re-import SIGUE bloqueado (skipped-dup)', async () => {
    const adminDb = admin.firestore();
    // Sembrar 1 bobina VOIDED con doc.id "SEED-VOIDED-00001" y metadata.invoiceNumber "F001-999"
    await adminDb.collection("coils").doc("SEED-VOIDED-00001").set({
      status: "VOIDED",
      initialWeight: 1000,
      metadata: { invoiceNumber: "F001-999" }
    });

    const req = {
      data: {
        invoices: [{
          serie: "F001", nroDoc: "999", fecha: "2026-06-30", provider: "PROV", currency: "PEN" as const, exchangeRate: 1,
          coils: [
            { finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 },
            { finish: "NATURAL", width: 1200, thickness: 0.45, weight: 1000, value: 1000 }
          ]
        }]
      },
      auth: ADMIN_AUTH,
    };

    const res2 = await registerCoilsBulk.run(req as any);
    expect(res2.results[0].status).toBe("skipped-dup");
  });

  it('5. ESCAPE deleteCoilDraft: importar F001-777 -> IDs composite, borrar físico, re-importar -> IDs composite y distintos de primera corrida', async () => {
    const adminDb = admin.firestore();
    const req = {
      data: {
        invoices: [{
          serie: "F001", nroDoc: "777", fecha: "2026-06-30", provider: "PROV", currency: "PEN" as const, exchangeRate: 1,
          coils: [
            { finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 },
            { finish: "NATURAL", width: 1200, thickness: 0.45, weight: 1000, value: 1000 }
          ]
        }]
      },
      auth: ADMIN_AUTH,
    };

    const res1 = await registerCoilsBulk.run(req as any);
    expect(res1.results[0].status).toBe("created");

    const snap1 = await adminDb.collection("coils").where("metadata.invoiceNumber", "==", "F001-777").get();
    expect(snap1.size).toBe(2);
    const firstRunIds = snap1.docs.map(d => d.id);

    // Ambas deben tener formato composite PROV-ACABADO-ESP-PESO-NNNNN
    for (const id of firstRunIds) {
      expect(id).toMatch(/^[A-Z0-9]{1,6}-[A-Z0-9-]+-\d{3}-\d+-\d{5}$/);
    }

    // Borrar físicamente ambas
    for (const doc of snap1.docs) {
      await doc.ref.delete();
    }

    // Re-importar
    const res2 = await registerCoilsBulk.run(req as any);
    expect(res2.results[0].status).toBe("created");

    const snap2 = await adminDb.collection("coils").where("metadata.invoiceNumber", "==", "F001-777").get();
    expect(snap2.size).toBe(2);
    const secondRunIds = snap2.docs.map(d => d.id);

    for (const id of secondRunIds) {
      expect(id).toMatch(/^[A-Z0-9]{1,6}-[A-Z0-9-]+-\d{3}-\d+-\d{5}$/);
      expect(firstRunIds).not.toContain(id);
    }
  });

  it('6. IDs IDÉNTICOS EN ESPEC: 2 bobinas mismo acabado/espesor/peso -> doc.id con sufijo counter de 5 dígitos consecutivo', async () => {
    const req = {
      data: {
        invoices: [{
          serie: "F001", nroDoc: "888", fecha: "2026-06-30", provider: "PROV", currency: "PEN" as const, exchangeRate: 1,
          coils: [
            { finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 },
            { finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 }
          ]
        }]
      },
      auth: ADMIN_AUTH,
    };

    const res = await registerCoilsBulk.run(req as any);
    expect(res.results[0].status).toBe("created");

    const adminDb = admin.firestore();
    const coilsSnap = await adminDb.collection("coils").where("metadata.invoiceNumber", "==", "F001-888").get();
    expect(coilsSnap.size).toBe(2);

    const ids = coilsSnap.docs.map(d => d.id);
    expect(ids[0]).toMatch(/-\d{5}$/);
    expect(ids[1]).toMatch(/-\d{5}$/);
    expect(ids[0]).not.toBe(ids[1]);

    const num0 = parseInt(ids[0].slice(-5), 10);
    const num1 = parseInt(ids[1].slice(-5), 10);
    expect(Math.abs(num1 - num0)).toBe(1);
  });

  it('7. COUNTER SIN STALE ENTRE INVOICES: 2 invoices en la misma corrida -> 4 correlativos únicos y +4 en counter', async () => {
    const adminDb = admin.firestore();
    await adminDb.collection("counters").doc("coils").set({ current: 100, updatedAt: new Date() });

    const req = {
      data: {
        invoices: [
          {
            serie: "F001", nroDoc: "100", fecha: "2026-06-30", provider: "PROV", currency: "PEN" as const, exchangeRate: 1,
            coils: [
              { finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 },
              { finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 }
            ]
          },
          {
            serie: "F001", nroDoc: "200", fecha: "2026-06-30", provider: "PROV", currency: "PEN" as const, exchangeRate: 1,
            coils: [
              { finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 },
              { finish: "GALVANIZADO", width: 1200, thickness: 0.45, weight: 1000, value: 1000 }
            ]
          }
        ]
      },
      auth: ADMIN_AUTH,
    };

    const res = await registerCoilsBulk.run(req as any);
    expect(res.results[0].status).toBe("created");
    expect(res.results[1].status).toBe("created");

    const counterSnap = await adminDb.collection("counters").doc("coils").get();
    expect(counterSnap.data()?.current).toBe(104);

    const coilsSnap100 = await adminDb.collection("coils").where("metadata.invoiceNumber", "==", "F001-100").get();
    const coilsSnap200 = await adminDb.collection("coils").where("metadata.invoiceNumber", "==", "F001-200").get();

    const ids100 = coilsSnap100.docs.map(d => d.id);
    const ids200 = coilsSnap200.docs.map(d => d.id);
    const allIds = [...ids100, ...ids200];
    const uniqueIds = new Set(allIds);

    expect(allIds.length).toBe(4);
    expect(uniqueIds.size).toBe(4);
  });
});
