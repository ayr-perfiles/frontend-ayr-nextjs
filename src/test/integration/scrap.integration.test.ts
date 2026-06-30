import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as admin from '../../../functions/node_modules/firebase-admin';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { clearFirestore } from './firestore-helpers';

// Import backend callable directly
import { registerCoilScrap } from '../../../functions/src/callables/scrap';

describe('Scrap Module (Integration - Backend Callable)', () => {
  beforeAll(async () => {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: TEST_PROJECT_ID });
    }
  });

  afterAll(async () => {
    // nothing to clean up
  });

  beforeEach(async () => {
    await clearFirestore(TEST_PROJECT_ID);
  });

  it('registerCoilScrap: descuenta peso, registra log, kardex y audit', async () => {
    const adminDb = admin.firestore();

    // 1. SEED usando Admin SDK para saltar rules
    await adminDb.collection("coils").doc("TEST-COIL-1").set({
      initialWeight: 1000,
      currentWeight: 1000,
      pricePerKg: 2.5,
      status: "AVAILABLE",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. INVOCA
    const uid = "admin-test-uid";
    const request = {
      data: {
        coilId: "TEST-COIL-1",
        scrapWeightKg: 50,
        reason: "prueba"
      },
      auth: {
        uid,
        token: { role: "ADMIN" }
      }
    };

    const result = await registerCoilScrap.run(request as any);

    // 3. AFIRMA estado final
    const coilSnap = await adminDb.collection("coils").doc("TEST-COIL-1").get();
    const coil = coilSnap.data()!;
    expect(coil.currentWeight).toBe(950);
    expect(coil.status).toBe("AVAILABLE");
    expect(coil.updatedAt).toBeDefined();

    const scrapLogsSnap = await adminDb.collection("scrap_logs").get();
    expect(scrapLogsSnap.size).toBe(1);
    const scrapLog = scrapLogsSnap.docs[0].data();
    expect(scrapLog.coilId).toBe("TEST-COIL-1");
    expect(scrapLog.scrapWeightKg).toBe(50);
    expect(scrapLog.reason).toBe("prueba");
    expect(scrapLog.adminId).toBe(uid);

    const kardexSnap = await adminDb.collection("kardex_movements").where("sku", "==", "TEST-COIL-1").get();
    expect(kardexSnap.size).toBe(1);
    const kardex = kardexSnap.docs[0].data();
    expect(kardex.type).toBe("SCRAP");
    expect(kardex.weightKg).toBe(50);
    expect(kardex.reference).toBe(scrapLogsSnap.docs[0].id);

    const auditSnap = await adminDb.collection("audit_logs").where("action", "==", "REGISTER_SCRAP").get();
    expect(auditSnap.size).toBe(1);
    const audit = auditSnap.docs[0].data();
    expect(audit.entityId).toBe("TEST-COIL-1");
    expect(audit.userEmail).toBe(uid);

    // 4. AFIRMA salida de la Callable
    // The test is expected to fail here because the draft callable returns resultingWeightKg instead of newWeight
    expect(result.newWeight).toBe(950);
    expect(result.scrapCostPEN).toBe(125);
    expect(result.hasNegativeCoilWarning).toBe(false);
    expect(result.scrapLogId).toBe(scrapLogsSnap.docs[0].id);
  });

  it('rechaza con permission-denied si el rol es OPERATOR (cero escrituras)', async () => {
    const adminDb = admin.firestore();

    await adminDb.collection("coils").doc("TEST-COIL-2").set({
      initialWeight: 1000,
      currentWeight: 1000,
      pricePerKg: 2.5,
      status: "AVAILABLE",
    });

    const request = {
      data: { coilId: "TEST-COIL-2", scrapWeightKg: 50, reason: "prueba" },
      auth: { uid: "operator-uid", token: { role: "OPERATOR" } }
    };

    let error: any;
    try {
      await registerCoilScrap.run(request as any);
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.code).toBe("permission-denied");

    // Verificar cero escrituras
    const coilSnap = await adminDb.collection("coils").doc("TEST-COIL-2").get();
    expect(coilSnap.data()?.currentWeight).toBe(1000); // no cambió

    const scrapLogsSnap = await adminDb.collection("scrap_logs").where("coilId", "==", "TEST-COIL-2").get();
    expect(scrapLogsSnap.empty).toBe(true);

    const kardexSnap = await adminDb.collection("kardex_movements").where("sku", "==", "TEST-COIL-2").get();
    expect(kardexSnap.empty).toBe(true);
  });

  it('rechaza con permission-denied si no hay rol en el token (cero escrituras)', async () => {
    const adminDb = admin.firestore();

    await adminDb.collection("coils").doc("TEST-COIL-3").set({
      initialWeight: 1000,
      currentWeight: 1000,
      pricePerKg: 2.5,
      status: "AVAILABLE",
    });

    const request = {
      data: { coilId: "TEST-COIL-3", scrapWeightKg: 50, reason: "prueba" },
      auth: { uid: "no-role-uid", token: {} } // sin rol
    };

    let error: any;
    try {
      await registerCoilScrap.run(request as any);
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.code).toBe("permission-denied");

    // Verificar cero escrituras
    const coilSnap = await adminDb.collection("coils").doc("TEST-COIL-3").get();
    expect(coilSnap.data()?.currentWeight).toBe(1000);

    const scrapLogsSnap = await adminDb.collection("scrap_logs").where("coilId", "==", "TEST-COIL-3").get();
    expect(scrapLogsSnap.empty).toBe(true);
  });

  describe('Rechazos por datos inválidos o estado de bobina (como ADMIN)', () => {
    let adminDb: admin.firestore.Firestore;
    const auth = { uid: "admin-uid", token: { role: "ADMIN" } };

    beforeAll(() => {
      adminDb = admin.firestore();
    });

    it('peso <= 0 -> invalid-argument, cero escrituras', async () => {
      await adminDb.collection("coils").doc("TEST-COIL-INV1").set({ currentWeight: 1000, status: "AVAILABLE" });
      const request = { data: { coilId: "TEST-COIL-INV1", scrapWeightKg: 0, reason: "prueba" }, auth };
      
      await expect(registerCoilScrap.run(request as any)).rejects.toMatchObject({ code: "invalid-argument" });
      
      const snap = await adminDb.collection("scrap_logs").where("coilId", "==", "TEST-COIL-INV1").get();
      expect(snap.empty).toBe(true);
    });

    it('peso NaN -> invalid-argument, cero escrituras', async () => {
      await adminDb.collection("coils").doc("TEST-COIL-INV2").set({ currentWeight: 1000, status: "AVAILABLE" });
      const request = { data: { coilId: "TEST-COIL-INV2", scrapWeightKg: NaN, reason: "prueba" }, auth };
      
      await expect(registerCoilScrap.run(request as any)).rejects.toMatchObject({ code: "invalid-argument" });
      
      const snap = await adminDb.collection("scrap_logs").where("coilId", "==", "TEST-COIL-INV2").get();
      expect(snap.empty).toBe(true);
    });

    it('reason vacío/whitespace -> invalid-argument, cero escrituras', async () => {
      await adminDb.collection("coils").doc("TEST-COIL-INV3").set({ currentWeight: 1000, status: "AVAILABLE" });
      const request = { data: { coilId: "TEST-COIL-INV3", scrapWeightKg: 50, reason: "   " }, auth };
      
      await expect(registerCoilScrap.run(request as any)).rejects.toMatchObject({ code: "invalid-argument" });
      
      const snap = await adminDb.collection("scrap_logs").where("coilId", "==", "TEST-COIL-INV3").get();
      expect(snap.empty).toBe(true);
    });

    it('coilId inexistente -> not-found, cero escrituras', async () => {
      const request = { data: { coilId: "TEST-COIL-NOTFOUND", scrapWeightKg: 50, reason: "prueba" }, auth };
      
      await expect(registerCoilScrap.run(request as any)).rejects.toMatchObject({ code: "not-found" });
      
      const snap = await adminDb.collection("scrap_logs").where("coilId", "==", "TEST-COIL-NOTFOUND").get();
      expect(snap.empty).toBe(true);
    });

    it('coil con status="VOIDED" -> failed-precondition, cero escrituras', async () => {
      await adminDb.collection("coils").doc("TEST-COIL-INV4").set({ currentWeight: 1000, status: "VOIDED" });
      const request = { data: { coilId: "TEST-COIL-INV4", scrapWeightKg: 50, reason: "prueba" }, auth };
      
      await expect(registerCoilScrap.run(request as any)).rejects.toMatchObject({ code: "failed-precondition" });
      
      const snap = await adminDb.collection("scrap_logs").where("coilId", "==", "TEST-COIL-INV4").get();
      expect(snap.empty).toBe(true);
    });

    it('coil con status="SOLD" -> failed-precondition, cero escrituras', async () => {
      await adminDb.collection("coils").doc("TEST-COIL-INV5").set({ currentWeight: 1000, status: "SOLD" });
      const request = { data: { coilId: "TEST-COIL-INV5", scrapWeightKg: 50, reason: "prueba" }, auth };
      
      await expect(registerCoilScrap.run(request as any)).rejects.toMatchObject({ code: "failed-precondition" });
      
      const snap = await adminDb.collection("scrap_logs").where("coilId", "==", "TEST-COIL-INV5").get();
      expect(snap.empty).toBe(true);
    });
  });
});
