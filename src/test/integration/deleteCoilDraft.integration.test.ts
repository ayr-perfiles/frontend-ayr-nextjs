import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import * as admin from '../../../functions/node_modules/firebase-admin';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { clearFirestore } from './firestore-helpers';
// @ts-ignore: callable not implemented yet (RED phase)
import { deleteCoilDraft } from '../../../functions/src/callables/coilManagement';

describe('deleteCoilDraft (Integration)', () => {
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
    status: "VOIDED",
    initialWeight: 1000,
    currentWeight: 1000,
    masterWidth: 1000,
    thickness: 1,
    finish: "GALV",
    pricePerKg: 2.5,
    registeredBy: "admin@test.com",
    metadata: {},
    ...overrides
  });

  it('1. HAPPY: coil VOIDED, sin hijas/producción/scrap/kardex, sin parentCoilId, caller ADMIN -> borra', async () => {
    const adminDb = admin.firestore();
    const coilId = "BOB-HAPPY-1";
    await adminDb.collection("coils").doc(coilId).set(getBaseCoil(coilId));

    const request = {
      data: { coilId },
      auth: { token: { role: "ADMIN", email: "admin@test.com" } }
    };

    await deleteCoilDraft.run(request as any);

    const coilSnap = await adminDb.collection("coils").doc(coilId).get();
    expect(coilSnap.exists).toBe(false);

    const auditSnap = await adminDb.collection("audit_logs").where("action", "==", "DELETE_COIL_DRAFT").get();
    expect(auditSnap.size).toBe(1);
    expect(auditSnap.docs[0].data()).toMatchObject({
      entityId: coilId,
      userEmail: "admin@test.com"
    });
  });

  it('2. AUTH: caller SUPERVISOR -> permission-denied, doc SIGUE existiendo', async () => {
    const adminDb = admin.firestore();
    const coilId = "BOB-AUTH-1";
    await adminDb.collection("coils").doc(coilId).set(getBaseCoil(coilId));

    const request = {
      data: { coilId },
      auth: { token: { role: "SUPERVISOR", email: "sup@test.com" } }
    };

    await expect(deleteCoilDraft.run(request as any)).rejects.toMatchObject({ code: 'permission-denied' });

    const coilSnap = await adminDb.collection("coils").doc(coilId).get();
    expect(coilSnap.exists).toBe(true);
  });

  it('3. AUTH: caller sin claim de rol -> error, doc sigue existiendo', async () => {
    const adminDb = admin.firestore();
    const coilId = "BOB-AUTH-2";
    await adminDb.collection("coils").doc(coilId).set(getBaseCoil(coilId));

    const request = {
      data: { coilId },
      auth: { token: { email: "user@test.com" } }
    };

    await expect(deleteCoilDraft.run(request as any)).rejects.toMatchObject({ code: 'permission-denied' });

    const coilSnap = await adminDb.collection("coils").doc(coilId).get();
    expect(coilSnap.exists).toBe(true);
  });

  it('4. STATUS: coil AVAILABLE (no VOIDED), sin movimientos, ADMIN -> failed-precondition, doc sigue existiendo', async () => {
    const adminDb = admin.firestore();
    const coilId = "BOB-STATUS-1";
    await adminDb.collection("coils").doc(coilId).set(getBaseCoil(coilId, { status: "AVAILABLE" }));

    const request = {
      data: { coilId },
      auth: { token: { role: "ADMIN", email: "admin@test.com" } }
    };

    await expect(deleteCoilDraft.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });

    const coilSnap = await adminDb.collection("coils").doc(coilId).get();
    expect(coilSnap.exists).toBe(true);
  });

  it('5. HIJA: coil VOIDED con parentCoilId presente -> failed-precondition, doc sigue existiendo', async () => {
    const adminDb = admin.firestore();
    const coilId = "BOB-CHILD-1";
    await adminDb.collection("coils").doc(coilId).set(getBaseCoil(coilId, { parentCoilId: "BOB-MOTHER-1" }));

    const request = {
      data: { coilId },
      auth: { token: { role: "ADMIN", email: "admin@test.com" } }
    };

    await expect(deleteCoilDraft.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });

    const coilSnap = await adminDb.collection("coils").doc(coilId).get();
    expect(coilSnap.exists).toBe(true);
  });

  it('6. MOV split: coil VOIDED + existe otra coil con parentCoilId==coilId -> failed-precondition, no borra', async () => {
    const adminDb = admin.firestore();
    const coilId = "BOB-MOTHER-2";
    await adminDb.collection("coils").doc(coilId).set(getBaseCoil(coilId));
    await adminDb.collection("coils").doc("BOB-CHILD-2").set(getBaseCoil("BOB-CHILD-2", { parentCoilId: coilId }));

    const request = {
      data: { coilId },
      auth: { token: { role: "ADMIN", email: "admin@test.com" } }
    };

    await expect(deleteCoilDraft.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });

    const coilSnap = await adminDb.collection("coils").doc(coilId).get();
    expect(coilSnap.exists).toBe(true);
  });

  it('7. MOV producción: coil VOIDED + production_log con parentCoilIds array-contains coilId -> failed-precondition, no borra', async () => {
    const adminDb = admin.firestore();
    const coilId = "BOB-PROD-1";
    await adminDb.collection("coils").doc(coilId).set(getBaseCoil(coilId));
    await adminDb.collection("production_logs").doc("LOG-1").set({
      parentCoilIds: [coilId]
    });

    const request = {
      data: { coilId },
      auth: { token: { role: "ADMIN", email: "admin@test.com" } }
    };

    await expect(deleteCoilDraft.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });

    const coilSnap = await adminDb.collection("coils").doc(coilId).get();
    expect(coilSnap.exists).toBe(true);
  });

  it('8. MOV scrap: coil VOIDED + scrap_log con coilId -> failed-precondition, no borra', async () => {
    const adminDb = admin.firestore();
    const coilId = "BOB-SCRAP-1";
    await adminDb.collection("coils").doc(coilId).set(getBaseCoil(coilId));
    await adminDb.collection("scrap_logs").doc("SCRAP-1").set({
      coilId: coilId
    });

    const request = {
      data: { coilId },
      auth: { token: { role: "ADMIN", email: "admin@test.com" } }
    };

    await expect(deleteCoilDraft.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });

    const coilSnap = await adminDb.collection("coils").doc(coilId).get();
    expect(coilSnap.exists).toBe(true);
  });

  it('9. MOV kardex: coil VOIDED + kardex_movements con sku==coilId -> failed-precondition, no borra', async () => {
    const adminDb = admin.firestore();
    const coilId = "BOB-KARDEX-1";
    await adminDb.collection("coils").doc(coilId).set(getBaseCoil(coilId));
    await adminDb.collection("kardex_movements").doc("KDX-1").set({
      sku: coilId
    });

    const request = {
      data: { coilId },
      auth: { token: { role: "ADMIN", email: "admin@test.com" } }
    };

    await expect(deleteCoilDraft.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });

    const coilSnap = await adminDb.collection("coils").doc(coilId).get();
    expect(coilSnap.exists).toBe(true);
  });

  it('10. NOT-FOUND: coilId inexistente -> not-found', async () => {
    const request = {
      data: { coilId: "BOB-GHOST-1" },
      auth: { token: { role: "ADMIN", email: "admin@test.com" } }
    };

    await expect(deleteCoilDraft.run(request as any)).rejects.toMatchObject({ code: 'not-found' });
  });

});
