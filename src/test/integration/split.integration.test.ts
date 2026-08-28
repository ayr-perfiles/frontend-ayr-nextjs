import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as admin from '../../../functions/node_modules/firebase-admin';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { clearFirestore } from './firestore-helpers';
import { db } from '@/lib/firebase/clientApp';
import { registerCoilSplit } from '../../../functions/src/callables/split';

describe('Split Module (Integration - Backend Callable)', () => {
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

  it('Test 1: feliz - split de bobina', async () => {
    const adminDb = admin.firestore();

    await adminDb.collection("coils").doc("BOB-TEST-1").set({
      initialWeight: 10000,
      currentWeight: 10000,
      masterWidth: 1200,
      pricePerKg: 3.5,
      status: "AVAILABLE",
      thickness: 0.45,
      finish: "GALV",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await adminDb.collection("coil_finishes").doc("GALV").set({ active: true, label: "GALV", densityFactor: 0.00785 });

    const uid = "admin-test-uid";
    const email = "admin@test.com";
    const requestId = "req-12345";
    
    const request = {
      data: {
        coilId: "BOB-TEST-1",
        newChildWidthMm: 300,
        requestId
      },
      auth: {
        uid,
        token: { role: "ADMIN", email }
      }
    };

    const result = await registerCoilSplit.run(request as any);

    // Padre asserts
    const parentSnap = await adminDb.collection("coils").doc("BOB-TEST-1").get();
    const parent = parentSnap.data()!;
    expect(parent.masterWidth).toBe(900); // 1200 - 300
    expect(parent.currentWeight).toBe(7500); // 10000 * 900 / 1200
    expect(parent.status).toBe("AVAILABLE");

    // Hija asserts
    expect(result.childId).toBeDefined();
    const childSnap = await adminDb.collection("coils").doc(result.childId).get();
    expect(childSnap.exists).toBe(true);
    const child = childSnap.data()!;
    expect(child.masterWidth).toBe(300);
    expect(child.currentWeight).toBe(2500);
    expect(child.initialWeight).toBe(2500);
    expect(child.densityFactor).toBe(0.00785);
    expect(child.finish).toBe("GALV");
    expect(child.coilTypeKey).toBe("BOB-GALV-045");
    expect(child.pricePerKg).toBe(3.5);
    expect(child.parentCoilId).toBe("BOB-TEST-1");
    expect(child.status).toBe("AVAILABLE");
    expect(child.registeredBy).toBe(email);
    expect(child.metadata?.splitFrom).toBe("BOB-TEST-1");
    expect(child.metadata?.isManualEntry).toBe(false);

    // Kardex asserts
    const kardexSnap = await adminDb.collection("kardex_movements").get();
    const movements = kardexSnap.docs.map(d => d.data());
    
    const parentOut = movements.find(m => m.sku === "BOB-TEST-1" && m.type === "OUT");
    const childIn = movements.find(m => m.sku === result.childId && m.type === "IN");

    expect(parentOut).toBeDefined();
    expect(parentOut!.balance).toBe(7500);
    expect(parentOut!.weightKg).toBe(2500);
    expect(parentOut!.reference).toBe(result.childId);
    expect(parentOut!.splitId).toBeDefined();

    expect(childIn).toBeDefined();
    expect(childIn!.balance).toBe(2500);
    expect(childIn!.weightKg).toBe(2500);
    expect(childIn!.reference).toBe("BOB-TEST-1");
    expect(childIn!.splitId).toBe(parentOut!.splitId); // mismo splitId

    // Audit asserts
    const auditSnap = await adminDb.collection("audit_logs").where("action", "==", "SPLIT_COIL").get();
    expect(auditSnap.size).toBe(1);
    const audit = auditSnap.docs[0].data();
    expect(audit.entityId).toBe("BOB-TEST-1");
    expect(audit.userEmail).toBe(email);

    // Idempotency asserts
    const idempSnap = await adminDb.collection("idempotency_keys").doc(requestId).get();
    expect(idempSnap.exists).toBe(true);
    const idempData = idempSnap.data()!;
    expect(idempData.action).toBe("SPLIT_COIL");
    expect(idempData.result.childId).toBe(result.childId);
    expect(idempData.result.newParentWeight).toBe(7500);
    expect(idempData.result.newParentWidth).toBe(900);
    expect(idempData.result.childWeight).toBe(2500);
  });

  it('[COIL-TYPE-KEY] hija.coilTypeKey === madre.coilTypeKey aunque el ancho sea otro (el ancho NO entra en la clave, por diseño)', async () => {
    const adminDb = admin.firestore();

    // Madre ya con coilTypeKey seteado (simula un doc post-backfill).
    await adminDb.collection("coils").doc("BOB-TYPEKEY-MOM").set({
      initialWeight: 10000,
      currentWeight: 10000,
      masterWidth: 1200,
      pricePerKg: 3.5,
      status: "AVAILABLE",
      thickness: 0.45,
      finish: "GALV",
      coilTypeKey: "BOB-GALV-045",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await adminDb.collection("coil_finishes").doc("GALV").set({ active: true, label: "GALV", densityFactor: 0.00785 });

    const request = {
      data: {
        coilId: "BOB-TYPEKEY-MOM",
        newChildWidthMm: 500, // ancho distinto al de la madre a propósito
        requestId: "req-typekey-1",
      },
      auth: { uid: "admin-test-uid", token: { role: "ADMIN", email: "admin@test.com" } },
    };

    const result = await registerCoilSplit.run(request as any);

    const motherSnap = await adminDb.collection("coils").doc("BOB-TYPEKEY-MOM").get();
    const childSnap = await adminDb.collection("coils").doc(result.childId).get();

    expect(motherSnap.data()!.masterWidth).not.toBe(childSnap.data()!.masterWidth); // anchos distintos, confirmado
    expect(childSnap.data()!.coilTypeKey).toBe(motherSnap.data()!.coilTypeKey); // MISMA clave, por diseño
    expect(childSnap.data()!.coilTypeKey).toBe("BOB-GALV-045");
  });

  it('Test 2: rechaza con permission-denied si el rol es OPERATOR', async () => {
    const adminDb = admin.firestore();
    const requestId = "req-role-fail";

    await adminDb.collection("coils").doc("BOB-TEST-2").set({
      initialWeight: 10000,
      currentWeight: 10000,
      masterWidth: 1200,
      status: "AVAILABLE",
    });

    const request = {
      data: { coilId: "BOB-TEST-2", newChildWidthMm: 300, requestId },
      auth: { uid: "operator", token: { role: "OPERATOR", email: "op@test.com" } }
    };

    let error: any;
    try {
      await registerCoilSplit.run(request as any);
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.code).toBe("permission-denied");

    // Assert no writes
    const snap = await adminDb.collection("idempotency_keys").doc(requestId).get();
    expect(snap.exists).toBe(false);
  });

  it('Test 3: input - rechaza por coilId inexistente, ancho inválido, o falta requestId', async () => {
    const adminDb = admin.firestore();
    const auth = { uid: "admin", token: { role: "ADMIN", email: "a@test.com" } };

    await adminDb.collection("coils").doc("BOB-TEST-3").set({
      initialWeight: 10000,
      currentWeight: 10000,
      masterWidth: 1200,
      status: "AVAILABLE",
    });

    // 1. Falta requestId
    await expect(registerCoilSplit.run({ data: { coilId: "BOB-TEST-3", newChildWidthMm: 300 }, auth } as any))
      .rejects.toMatchObject({ code: "invalid-argument" });

    // 2. Coil inexistente
    await expect(registerCoilSplit.run({ data: { coilId: "BOB-TEST-NOTFOUND", newChildWidthMm: 300, requestId: "req-3-2" }, auth } as any))
      .rejects.toMatchObject({ code: "not-found" });

    // 3. Ancho >= masterWidth
    await expect(registerCoilSplit.run({ data: { coilId: "BOB-TEST-3", newChildWidthMm: 1200, requestId: "req-3-3" }, auth } as any))
      .rejects.toMatchObject({ code: "invalid-argument" });

    // 4. Ancho <= 0
    await expect(registerCoilSplit.run({ data: { coilId: "BOB-TEST-3", newChildWidthMm: -100, requestId: "req-3-4" }, auth } as any))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });

  it('Test 4: precondición - status inválido o sin densityFactor', async () => {
    const adminDb = admin.firestore();
    const auth = { uid: "admin", token: { role: "ADMIN", email: "a@test.com" } };

    // 1. Status PROCESSED
    await adminDb.collection("coils").doc("BOB-TEST-4A").set({
      currentWeight: 1000,
      masterWidth: 1200,
      status: "PROCESSED",
    });
    await expect(registerCoilSplit.run({ data: { coilId: "BOB-TEST-4A", newChildWidthMm: 300, requestId: "req-4-1" }, auth } as any))
      .rejects.toMatchObject({ code: "invalid-argument" });

    // 2. Finish sin densityFactor
    await adminDb.collection("coils").doc("BOB-TEST-4B").set({
      currentWeight: 1000,
      masterWidth: 1200,
      status: "AVAILABLE",
      finish: "BAD_FINISH"
    });
    await adminDb.collection("coil_finishes").doc("BAD_FINISH").set({ active: true, label: "BAD_FINISH", densityFactor: null });

    await expect(registerCoilSplit.run({ data: { coilId: "BOB-TEST-4B", newChildWidthMm: 300, requestId: "req-4-2" }, auth } as any))
      .rejects.toMatchObject({ code: "failed-precondition" });

    // 3. currentWeight 0 o ausente
    await adminDb.collection("coils").doc("BOB-TEST-4C").set({
      currentWeight: 0,
      masterWidth: 1200,
      status: "AVAILABLE",
    });
    await expect(registerCoilSplit.run({ data: { coilId: "BOB-TEST-4C", newChildWidthMm: 300, requestId: "req-4-3" }, auth } as any))
      .rejects.toMatchObject({ code: "failed-precondition" });

    // 4. [COIL-TYPE-KEY] thickness inválido en la madre -> falla claro, NO crea la hija
    await adminDb.collection("coils").doc("BOB-TEST-4D").set({
      currentWeight: 1000,
      masterWidth: 1200,
      status: "AVAILABLE",
      finish: "GALV",
      thickness: 0,
    });
    await adminDb.collection("coil_finishes").doc("GALV").set({ active: true, label: "GALV", densityFactor: 0.00785 });
    await expect(registerCoilSplit.run({ data: { coilId: "BOB-TEST-4D", newChildWidthMm: 300, requestId: "req-4-4" }, auth } as any))
      .rejects.toMatchObject({ code: "invalid-argument" });

    const childrenSnap = await adminDb.collection("coils").where("parentCoilId", "==", "BOB-TEST-4D").get();
    expect(childrenSnap.size).toBe(0);
  });

  it('Test 5: idempotencia - mismo requestId 2x retorna mismo childId', async () => {
    const adminDb = admin.firestore();
    
    await adminDb.collection("coils").doc("BOB-TEST-5").set({
      initialWeight: 10000,
      currentWeight: 10000,
      masterWidth: 1200,
      pricePerKg: 3.5,
      status: "AVAILABLE",
      thickness: 0.45,
      finish: "GALV",
    });
    await adminDb.collection("coil_finishes").doc("GALV").set({ active: true, label: "GALV", densityFactor: 0.00785 });

    const request = {
      data: { coilId: "BOB-TEST-5", newChildWidthMm: 300, requestId: "req-idempotent-1" },
      auth: { uid: "admin", token: { role: "ADMIN", email: "a@test.com" } }
    };

    // Llamada 1
    const res1 = await registerCoilSplit.run(request as any);

    // Llamada 2 (mismo payload, mismo requestId)
    const res2 = await registerCoilSplit.run(request as any);

    expect(res1).toEqual(res2); // El resultado debe ser identico

    // Assert que solo hay 1 hija
    const childrenSnap = await adminDb.collection("coils").where("parentCoilId", "==", "BOB-TEST-5").get();
    expect(childrenSnap.size).toBe(1); // No debe haber 2 hijas

    // Assert que kardex generó exactamente 2 entradas (1 OUT padre, 1 IN hija)
    const kardexOutSnap = await adminDb.collection("kardex_movements")
      .where("sku", "==", "BOB-TEST-5")
      .where("type", "==", "OUT").get();
    expect(kardexOutSnap.size).toBe(1);

    const kardexInSnap = await adminDb.collection("kardex_movements")
      .where("sku", "==", res1.childId)
      .where("type", "==", "IN").get();
    expect(kardexInSnap.size).toBe(1);
    
    // Opcional: assert directo del peso final del padre
    const finalParent = await adminDb.collection("coils").doc("BOB-TEST-5").get();
    expect(finalParent.data()?.currentWeight).toBe(res1.newParentWeight);
  });
  it('Test 6: isClosed=true no bloquea el split', async () => {
    const adminDb = admin.firestore();
    await adminDb.collection("coils").doc("BOB-TEST-CLOSED").set({
      initialWeight: 10000,
      currentWeight: 10000,
      masterWidth: 1200,
      pricePerKg: 3.5,
      status: "AVAILABLE",
      isClosed: true,
      thickness: 0.45,
      finish: "GALV",
    });
    await adminDb.collection("coil_finishes").doc("GALV").set({ active: true, label: "GALV", densityFactor: 0.00785 });

    const request = {
      data: { coilId: "BOB-TEST-CLOSED", newChildWidthMm: 300, requestId: "req-closed-split" },
      auth: { uid: "admin", token: { role: "ADMIN", email: "a@test.com" } }
    };

    const res = await registerCoilSplit.run(request as any);
    expect(res.childId).toBeDefined();

    const parentSnap = await adminDb.collection("coils").doc("BOB-TEST-CLOSED").get();
    expect(parentSnap.data()?.masterWidth).toBe(900);
  });
});
