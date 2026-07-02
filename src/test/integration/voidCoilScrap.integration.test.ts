import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import * as admin from '../../../functions/node_modules/firebase-admin';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { clearFirestore } from './firestore-helpers';
import { voidCoilScrap } from '../../../functions/src/callables/scrap';

describe('voidCoilScrap (Integration)', () => {
  beforeAll(async () => {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: TEST_PROJECT_ID });
    }
  });

  beforeEach(async () => {
    await clearFirestore(TEST_PROJECT_ID);
  });

  const getBaseCoil = (id: string, overrides = {}) => ({
    id,
    status: "AVAILABLE",
    initialWeight: 1000,
    currentWeight: 800, // asume merma previa de 200
    masterWidth: 1000,
    thickness: 1,
    finish: "GALV",
    pricePerKg: 2.5,
    registeredBy: "admin@test.com",
    metadata: {},
    ...overrides
  });

  const getBaseScrapLog = (id: string, coilId: string, timestamp: admin.firestore.Timestamp, overrides = {}) => ({
    id,
    coilId,
    scrapWeightKg: 200,
    scrapCostPEN: 500, // 200 * 2.5
    reason: "Test scrap",
    adminId: "admin_1",
    timestamp,
    ...overrides
  });

  const getAdminAuth = () => ({ token: { role: "ADMIN", email: "admin@test.com" }, uid: "admin_uid" });

  it('1. HAPPY: Scrap válido revertido, recupera peso y status, registra kardex compensatorio', async () => {
    const adminDb = admin.firestore();
    const coilId = "COIL-HAP-1";
    const scrapId = "SCRAP-HAP-1";
    const scrapTimestamp = admin.firestore.Timestamp.fromDate(new Date("2026-07-02T10:00:00Z"));

    await adminDb.collection("coils").doc(coilId).set(getBaseCoil(coilId));
    await adminDb.collection("scrap_logs").doc(scrapId).set(getBaseScrapLog(scrapId, coilId, scrapTimestamp));
    await adminDb.collection("kardex_movements").doc("KARDEX-OLD-1").set({ sku: coilId, type: "SCRAP" });

    const request = {
      data: { scrapLogId: scrapId },
      auth: getAdminAuth()
    };

    const kardexBefore = await adminDb.collection("kardex_movements").get();
    expect(kardexBefore.size).toBe(1);

    await voidCoilScrap.run(request as any);

    // Assert coil state
    const coilSnap = await adminDb.collection("coils").doc(coilId).get();
    const coil = coilSnap.data()!;
    expect(coil.currentWeight).toBe(1000); // 800 + 200
    expect(coil.status).toBe("AVAILABLE"); 

    // Assert scrap log status
    const scrapSnap = await adminDb.collection("scrap_logs").doc(scrapId).get();
    expect(scrapSnap.data()!.status).toBe("VOIDED");

    // Assert kardex reversal
    const kardexAfter = await adminDb.collection("kardex_movements").get();
    expect(kardexAfter.size).toBe(2); // exactly +1
    const newKardexQuery = await adminDb.collection("kardex_movements").where("type", "==", "SCRAP_REVERSAL").get();
    expect(newKardexQuery.size).toBe(1);
    const revKardex = newKardexQuery.docs[0].data();
    expect(revKardex).toMatchObject({
      sku: coilId,
      type: "SCRAP_REVERSAL",
      quantity: 1,
      weightKg: 200, // TODO confirmar convención de signo
      costPerKg: 2.5, // costPerKg congelado = scrapCostPEN/scrapWeightKg, NO re-leer del coil (WAC pudo cambiar)
      balance: 1000,
      reference: scrapId,
      user: "admin_uid"
    });

    // Assert audit log
    const auditSnap = await adminDb.collection("audit_logs").where("action", "==", "VOID_COIL_SCRAP").get();
    expect(auditSnap.size).toBe(1);
    expect(auditSnap.docs[0].data().entityId).toBe(coilId);
  });

  it('2. GUARDS: P2 - scrap_log ya VOIDED aborta', async () => {
    const adminDb = admin.firestore();
    const coilId = "COIL-G2";
    const scrapId = "SCRAP-G2";
    await adminDb.collection("coils").doc(coilId).set(getBaseCoil(coilId));
    await adminDb.collection("scrap_logs").doc(scrapId).set(
      getBaseScrapLog(scrapId, coilId, admin.firestore.Timestamp.now(), { status: "VOIDED" })
    );

    const request = { data: { scrapLogId: scrapId }, auth: getAdminAuth() };
    await expect(voidCoilScrap.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });

    const coilSnap = await adminDb.collection("coils").doc(coilId).get();
    expect(coilSnap.data()!.currentWeight).toBe(800);
  });

  it('3. GUARDS: P3 - coil VOIDED aborta', async () => {
    const adminDb = admin.firestore();
    const coilId = "COIL-G3";
    const scrapId = "SCRAP-G3";
    await adminDb.collection("coils").doc(coilId).set(getBaseCoil(coilId, { status: "VOIDED" }));
    await adminDb.collection("scrap_logs").doc(scrapId).set(
      getBaseScrapLog(scrapId, coilId, admin.firestore.Timestamp.now())
    );

    const request = { data: { scrapLogId: scrapId }, auth: getAdminAuth() };
    await expect(voidCoilScrap.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('4. GUARDS: P1(b) - production_log posterior aborta', async () => {
    const adminDb = admin.firestore();
    const coilId = "COIL-G4";
    const scrapId = "SCRAP-G4";
    const scrapTimestamp = admin.firestore.Timestamp.fromDate(new Date("2026-07-02T10:00:00Z"));
    const prodTimestamp = admin.firestore.Timestamp.fromDate(new Date("2026-07-02T11:00:00Z")); // POSTERIOR

    await adminDb.collection("coils").doc(coilId).set(getBaseCoil(coilId));
    await adminDb.collection("scrap_logs").doc(scrapId).set(getBaseScrapLog(scrapId, coilId, scrapTimestamp));
    await adminDb.collection("production_logs").doc("PROD-G4").set({
      parentCoilIds: [coilId],
      status: "ACTIVE",
      createdAt: prodTimestamp
    });

    const request = { data: { scrapLogId: scrapId }, auth: getAdminAuth() };
    await expect(voidCoilScrap.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });
    
    // assert no cambia peso
    const coilSnap = await adminDb.collection("coils").doc(coilId).get();
    expect(coilSnap.data()!.currentWeight).toBe(800);
  });

  it('5. GUARDS: P1(b) - coil hija posterior aborta', async () => {
    const adminDb = admin.firestore();
    const coilId = "COIL-G5";
    const scrapId = "SCRAP-G5";
    const scrapTimestamp = admin.firestore.Timestamp.fromDate(new Date("2026-07-02T10:00:00Z"));
    const splitTimestamp = admin.firestore.Timestamp.fromDate(new Date("2026-07-02T11:00:00Z")); // POSTERIOR

    await adminDb.collection("coils").doc(coilId).set(getBaseCoil(coilId));
    await adminDb.collection("scrap_logs").doc(scrapId).set(getBaseScrapLog(scrapId, coilId, scrapTimestamp));
    await adminDb.collection("coils").doc("CHILD-G5").set({
      parentCoilId: coilId,
      createdAt: splitTimestamp
    });

    const request = { data: { scrapLogId: scrapId }, auth: getAdminAuth() };
    await expect(voidCoilScrap.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('6. GUARDS: P1(b) NEGATIVO - movimiento ANTERIOR no bloquea', async () => {
    const adminDb = admin.firestore();
    const coilId = "COIL-G6";
    const scrapId = "SCRAP-G6";
    const prodTimestamp = admin.firestore.Timestamp.fromDate(new Date("2026-07-02T09:00:00Z")); // ANTERIOR
    const scrapTimestamp = admin.firestore.Timestamp.fromDate(new Date("2026-07-02T10:00:00Z")); 

    await adminDb.collection("coils").doc(coilId).set(getBaseCoil(coilId));
    await adminDb.collection("scrap_logs").doc(scrapId).set(getBaseScrapLog(scrapId, coilId, scrapTimestamp));
    await adminDb.collection("production_logs").doc("PROD-G6").set({
      parentCoilIds: [coilId],
      status: "ACTIVE",
      createdAt: prodTimestamp
    });

    const request = { data: { scrapLogId: scrapId }, auth: getAdminAuth() };
    
    const kardexBefore = await adminDb.collection("kardex_movements").get();

    // debe pasar!
    await voidCoilScrap.run(request as any);

    const coilSnap = await adminDb.collection("coils").doc(coilId).get();
    expect(coilSnap.data()!.currentWeight).toBe(1000);

    const scrapSnap = await adminDb.collection("scrap_logs").doc(scrapId).get();
    expect(scrapSnap.data()!.status).toBe("VOIDED");

    const kardexAfter = await adminDb.collection("kardex_movements").get();
    expect(kardexAfter.size).toBe(kardexBefore.size + 1);

    const newKardexQuery = await adminDb.collection("kardex_movements").where("type", "==", "SCRAP_REVERSAL").get();
    expect(newKardexQuery.size).toBe(1);
  });

  it('7. GUARDS: P4 - caller sin claim ADMIN rechazado', async () => {
    const adminDb = admin.firestore();
    const scrapId = "SCRAP-G7";
    await adminDb.collection("coils").doc("COIL").set(getBaseCoil("COIL"));
    await adminDb.collection("scrap_logs").doc(scrapId).set(getBaseScrapLog(scrapId, "COIL", admin.firestore.Timestamp.now()));

    const request = {
      data: { scrapLogId: scrapId },
      auth: { token: { role: "SUPERVISOR", email: "sup@test.com" }, uid: "sup" }
    };
    await expect(voidCoilScrap.run(request as any)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('8. GUARDS: scrapLogId inexistente da error', async () => {
    const request = { data: { scrapLogId: "MISSING" }, auth: getAdminAuth() };
    await expect(voidCoilScrap.run(request as any)).rejects.toMatchObject({ code: 'not-found' });
  });

  // test 9 (retrocompat reporte) movido a reportFunctions.test.ts como unit puro

});
