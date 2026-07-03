import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import * as admin from '../../../functions/node_modules/firebase-admin';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { clearFirestore } from './firestore-helpers';
import { reverseCoilSplit } from '../../../functions/src/callables/split';

describe('reverseCoilSplit (Integration)', () => {
  beforeAll(async () => {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: TEST_PROJECT_ID });
    }
  });

  beforeEach(async () => {
    await clearFirestore(TEST_PROJECT_ID);
  });

  const getAdminAuth = () => ({ token: { role: "ADMIN", email: "admin@test.com" }, uid: "admin_uid" });

  async function seedSplit(adminDb: admin.firestore.Firestore, opts: {
    motherId: string;
    motherWeight: number;
    motherInitialWeight: number;
    motherWidth: number;
    childId: string;
    childWeight: number;
    childWidth: number;
    pricePerKg?: number;
    motherStatus?: string;
    childStatus?: string;
  }) {
    const {
      motherId, motherWeight, motherInitialWeight, motherWidth,
      childId, childWeight, childWidth,
      pricePerKg = 3.5,
      motherStatus = "AVAILABLE",
      childStatus = "AVAILABLE",
    } = opts;

    await adminDb.collection("coils").doc(motherId).set({
      id: motherId,
      status: motherStatus,
      initialWeight: motherInitialWeight,
      currentWeight: motherWeight,
      masterWidth: motherWidth,
      thickness: 0.45,
      finish: "GALV",
      pricePerKg,
      registeredBy: "admin@test.com",
    });
    await adminDb.collection("coils").doc(childId).set({
      id: childId,
      status: childStatus,
      initialWeight: childWeight,
      currentWeight: childWeight,
      masterWidth: childWidth,
      thickness: 0.45,
      finish: "GALV",
      pricePerKg,
      parentCoilId: motherId,
      registeredBy: "admin@test.com",
    });
  }

  it('1. HAPPY: restaura madre, VOID hija, kardex IN+OUT, audit REVERSE_COIL_SPLIT', async () => {
    const adminDb = admin.firestore();
    // Madre original: 1000 kg, 1200 mm. Tras split hija (300 mm): madre→700 kg, 900 mm; hija→300 kg, 300 mm.
    await seedSplit(adminDb, {
      motherId: "BOB-M1", motherWeight: 700, motherInitialWeight: 1000, motherWidth: 900,
      childId: "BOB-C1", childWeight: 300, childWidth: 300, pricePerKg: 3.5,
    });

    const result = await reverseCoilSplit.run({ data: { childId: "BOB-C1" }, auth: getAdminAuth() } as any);

    expect(result.success).toBe(true);

    const mother = (await adminDb.collection("coils").doc("BOB-M1").get()).data()!;
    expect(mother.currentWeight).toBe(1000);    // 700 + 300
    expect(mother.masterWidth).toBe(1200);       // 900 + 300
    expect(mother.status).toBe("AVAILABLE");     // 1000 >= 1000 - 0.01

    const child = (await adminDb.collection("coils").doc("BOB-C1").get()).data()!;
    expect(child.status).toBe("VOIDED");
    expect(child.currentWeight).toBe(0);

    const kardexDocs = (await adminDb.collection("kardex_movements").get()).docs;
    expect(kardexDocs.length).toBe(2);

    const motherIn = kardexDocs.find(d => d.data().sku === "BOB-M1" && d.data().type === "IN");
    expect(motherIn).toBeDefined();
    expect(motherIn!.data()).toMatchObject({
      sku: "BOB-M1",
      type: "IN",
      quantity: 1,
      weightKg: 300,
      costPerKg: 3.5,
      balance: 1000,
      reference: "BOB-C1",
    });

    const childOut = kardexDocs.find(d => d.data().sku === "BOB-C1" && d.data().type === "OUT");
    expect(childOut).toBeDefined();
    expect(childOut!.data()).toMatchObject({
      sku: "BOB-C1",
      type: "OUT",
      quantity: 1,
      weightKg: 300,
      costPerKg: 3.5,
      balance: 0,
      reference: "BOB-M1",
    });

    const auditDocs = await adminDb.collection("audit_logs").where("action", "==", "REVERSE_COIL_SPLIT").get();
    expect(auditDocs.size).toBe(1);
    expect(auditDocs.docs[0].data().entityId).toBe("BOB-C1");
    expect(auditDocs.docs[0].data().userEmail).toBe("admin@test.com");
  });

  it('2. GUARD 4: hija ya VOIDED → failed-precondition (idempotente)', async () => {
    const adminDb = admin.firestore();
    await seedSplit(adminDb, {
      motherId: "BOB-M2", motherWeight: 700, motherInitialWeight: 1000, motherWidth: 900,
      childId: "BOB-C2", childWeight: 300, childWidth: 300, childStatus: "VOIDED",
    });

    await expect(
      reverseCoilSplit.run({ data: { childId: "BOB-C2" }, auth: getAdminAuth() } as any)
    ).rejects.toMatchObject({ code: "failed-precondition" });

    const mother = (await adminDb.collection("coils").doc("BOB-M2").get()).data()!;
    expect(mother.currentWeight).toBe(700); // sin cambio
  });

  it('3. GUARD 5: coil sin parentCoilId → invalid-argument', async () => {
    const adminDb = admin.firestore();
    await adminDb.collection("coils").doc("BOB-NOPARENT").set({
      id: "BOB-NOPARENT", status: "AVAILABLE", initialWeight: 1000, currentWeight: 1000, masterWidth: 1200, pricePerKg: 3.5,
    });

    await expect(
      reverseCoilSplit.run({ data: { childId: "BOB-NOPARENT" }, auth: getAdminAuth() } as any)
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it('4. GUARD 6: madre VOIDED → failed-precondition', async () => {
    const adminDb = admin.firestore();
    await seedSplit(adminDb, {
      motherId: "BOB-M4", motherWeight: 700, motherInitialWeight: 1000, motherWidth: 900,
      childId: "BOB-C4", childWeight: 300, childWidth: 300, motherStatus: "VOIDED",
    });

    await expect(
      reverseCoilSplit.run({ data: { childId: "BOB-C4" }, auth: getAdminAuth() } as any)
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it('5. GUARD 7a: producción activa desde la hija → failed-precondition', async () => {
    const adminDb = admin.firestore();
    await seedSplit(adminDb, {
      motherId: "BOB-M5", motherWeight: 700, motherInitialWeight: 1000, motherWidth: 900,
      childId: "BOB-C5", childWeight: 300, childWidth: 300,
    });
    await adminDb.collection("production_logs").doc("PROD-5").set({
      parentCoilIds: ["BOB-C5"], status: "ACTIVE",
    });

    await expect(
      reverseCoilSplit.run({ data: { childId: "BOB-C5" }, auth: getAdminAuth() } as any)
    ).rejects.toMatchObject({ code: "failed-precondition" });

    const mother = (await adminDb.collection("coils").doc("BOB-M5").get()).data()!;
    expect(mother.currentWeight).toBe(700); // sin cambio
  });

  it('6. GUARD 7b: split anidado activo desde la hija → failed-precondition', async () => {
    const adminDb = admin.firestore();
    await seedSplit(adminDb, {
      motherId: "BOB-M6", motherWeight: 700, motherInitialWeight: 1000, motherWidth: 900,
      childId: "BOB-C6", childWeight: 300, childWidth: 300,
    });
    // nieta: split anidado de la hija, no VOIDED
    await adminDb.collection("coils").doc("BOB-GC6").set({
      id: "BOB-GC6", parentCoilId: "BOB-C6", status: "AVAILABLE",
    });

    await expect(
      reverseCoilSplit.run({ data: { childId: "BOB-C6" }, auth: getAdminAuth() } as any)
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it('7. GUARD 7c: merma en la hija → failed-precondition', async () => {
    const adminDb = admin.firestore();
    await seedSplit(adminDb, {
      motherId: "BOB-M7", motherWeight: 700, motherInitialWeight: 1000, motherWidth: 900,
      childId: "BOB-C7", childWeight: 300, childWidth: 300,
    });
    await adminDb.collection("scrap_logs").doc("SCRAP-7").set({
      coilId: "BOB-C7", scrapWeightKg: 10,
    });

    await expect(
      reverseCoilSplit.run({ data: { childId: "BOB-C7" }, auth: getAdminAuth() } as any)
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it('8. GUARD 7d: hija con currentWeight < initialWeight → failed-precondition', async () => {
    const adminDb = admin.firestore();
    await adminDb.collection("coils").doc("BOB-M8").set({
      id: "BOB-M8", status: "AVAILABLE", initialWeight: 1000, currentWeight: 700, masterWidth: 900, pricePerKg: 3.5,
    });
    await adminDb.collection("coils").doc("BOB-C8").set({
      id: "BOB-C8", status: "AVAILABLE",
      initialWeight: 300, currentWeight: 200, // reducido: algo la consumió
      masterWidth: 300, pricePerKg: 3.5, parentCoilId: "BOB-M8",
    });

    await expect(
      reverseCoilSplit.run({ data: { childId: "BOB-C8" }, auth: getAdminAuth() } as any)
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it('9. MULTI-HIJA: reversar una hija → madre IN_PROGRESS, otra hija intacta', async () => {
    const adminDb = admin.firestore();
    // Madre original: 1000 kg, 1200 mm.
    // Tras dos splits: queda 600 kg, 700 mm.
    // Hija A: 300 mm, 250 kg (prístina).
    // Hija B: 200 mm, 150 kg (prístina, intacta).
    await adminDb.collection("coils").doc("BOB-M9").set({
      id: "BOB-M9", status: "AVAILABLE", initialWeight: 1000, currentWeight: 600,
      masterWidth: 700, thickness: 0.45, finish: "GALV", pricePerKg: 3.5,
    });
    await adminDb.collection("coils").doc("BOB-C9A").set({
      id: "BOB-C9A", status: "AVAILABLE", initialWeight: 250, currentWeight: 250,
      masterWidth: 300, pricePerKg: 3.5, parentCoilId: "BOB-M9",
    });
    await adminDb.collection("coils").doc("BOB-C9B").set({
      id: "BOB-C9B", status: "AVAILABLE", initialWeight: 150, currentWeight: 150,
      masterWidth: 200, pricePerKg: 3.5, parentCoilId: "BOB-M9",
    });

    await reverseCoilSplit.run({ data: { childId: "BOB-C9A" }, auth: getAdminAuth() } as any);

    const mother = (await adminDb.collection("coils").doc("BOB-M9").get()).data()!;
    expect(mother.currentWeight).toBe(850);        // 600 + 250
    expect(mother.masterWidth).toBe(1000);          // 700 + 300
    expect(mother.status).toBe("IN_PROGRESS");      // 850 < 1000 - 0.01

    const childA = (await adminDb.collection("coils").doc("BOB-C9A").get()).data()!;
    expect(childA.status).toBe("VOIDED");
    expect(childA.currentWeight).toBe(0);

    const childB = (await adminDb.collection("coils").doc("BOB-C9B").get()).data()!;
    expect(childB.status).toBe("AVAILABLE");
    expect(childB.currentWeight).toBe(150); // intacta
  });

  it('10. AUTH: caller SUPERVISOR → permission-denied, madre sin cambio', async () => {
    const adminDb = admin.firestore();
    await seedSplit(adminDb, {
      motherId: "BOB-M10", motherWeight: 700, motherInitialWeight: 1000, motherWidth: 900,
      childId: "BOB-C10", childWeight: 300, childWidth: 300,
    });

    await expect(
      reverseCoilSplit.run({
        data: { childId: "BOB-C10" },
        auth: { token: { role: "SUPERVISOR", email: "sup@test.com" }, uid: "sup" }
      } as any)
    ).rejects.toMatchObject({ code: "permission-denied" });

    const mother = (await adminDb.collection("coils").doc("BOB-M10").get()).data()!;
    expect(mother.currentWeight).toBe(700); // sin cambio
  });
});
