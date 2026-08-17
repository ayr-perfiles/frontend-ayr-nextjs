import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as admin from '../../../functions/node_modules/firebase-admin';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { clearFirestore } from './firestore-helpers';
import { voidCoil, updateCoil, cancelCoilPlan } from '../../../functions/src/callables/coilManagement';

describe('Coil Management Module (Integration)', () => {
  beforeAll(async () => {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: TEST_PROJECT_ID });
    }
  });

  beforeEach(async () => {
    await clearFirestore(TEST_PROJECT_ID);
  });

  describe('voidCoil', () => {
    it('feliz - anular bobina AVAILABLE', async () => {
      const adminDb = admin.firestore();
      await adminDb.collection("coils").doc("BOB-VOID-1").set({
        initialWeight: 1000,
        currentWeight: 1000,
        status: "AVAILABLE",
      });

      const request = {
        data: { coilId: "BOB-VOID-1" },
        auth: { token: { role: "ADMIN", email: "admin@test.com" } }
      };

      await voidCoil.run(request as any);

      const coilSnap = await adminDb.collection("coils").doc("BOB-VOID-1").get();
      expect(coilSnap.data()?.status).toBe("VOIDED");
      expect(coilSnap.data()?.voidedBy).toBe("admin@test.com");
      expect(coilSnap.data()?.voidedAt).toBeDefined();

      const auditSnap = await adminDb.collection("audit_logs").where("action", "==", "VOID_COIL").get();
      expect(auditSnap.size).toBe(1);
    });

    it('rechaza si rol es OPERATOR', async () => {
      const request = {
        data: { coilId: "BOB-VOID-1" },
        auth: { token: { role: "OPERATOR", email: "op@test.com" } }
      };
      await expect(voidCoil.run(request as any)).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rechaza si bobina no existe', async () => {
      const request = {
        data: { coilId: "BOB-NOT-FOUND" },
        auth: { token: { role: "ADMIN", email: "admin@test.com" } }
      };
      await expect(voidCoil.run(request as any)).rejects.toMatchObject({ code: 'not-found' });
    });

    it('rechaza si status no es AVAILABLE', async () => {
      const adminDb = admin.firestore();
      await adminDb.collection("coils").doc("BOB-VOID-2").set({
        status: "IN_PROGRESS",
      });
      const request = {
        data: { coilId: "BOB-VOID-2" },
        auth: { token: { role: "ADMIN", email: "admin@test.com" } }
      };
      await expect(voidCoil.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });
    });

    it('rechaza anular bobina hija de split (parentCoilId presente)', async () => {
      const adminDb = admin.firestore();
      await adminDb.collection("coils").doc("BOB-CHILD-1").set({
        initialWeight: 2500,
        currentWeight: 2500,
        status: "AVAILABLE",
        parentCoilId: "BOB-MADRE-1",
      });
      const request = {
        data: { coilId: "BOB-CHILD-1" },
        auth: { token: { role: "ADMIN", email: "admin@test.com" } },
      };
      await expect(voidCoil.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });
    });

    it('rechaza anular bobina madre con hijos vivos', async () => {
      const adminDb = admin.firestore();
      await adminDb.collection("coils").doc("BOB-MADRE-2").set({
        initialWeight: 5000,
        currentWeight: 2500,
        status: "AVAILABLE",
      });
      await adminDb.collection("coils").doc("BOB-HIJO-VIVO").set({
        initialWeight: 2500,
        currentWeight: 2500,
        status: "AVAILABLE",
        parentCoilId: "BOB-MADRE-2",
      });
      const request = {
        data: { coilId: "BOB-MADRE-2" },
        auth: { token: { role: "ADMIN", email: "admin@test.com" } },
      };
      await expect(voidCoil.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });
    });

    it('permite anular madre cuando todos sus hijos son VOIDED', async () => {
      const adminDb = admin.firestore();
      await adminDb.collection("coils").doc("BOB-MADRE-3").set({
        initialWeight: 5000,
        currentWeight: 5000,
        status: "AVAILABLE",
      });
      await adminDb.collection("coils").doc("BOB-HIJO-VOIDED").set({
        initialWeight: 2500,
        currentWeight: 2500,
        status: "VOIDED",
        parentCoilId: "BOB-MADRE-3",
      });
      const request = {
        data: { coilId: "BOB-MADRE-3" },
        auth: { token: { role: "ADMIN", email: "admin@test.com" } },
      };
      await voidCoil.run(request as any);
      const coilSnap = await adminDb.collection("coils").doc("BOB-MADRE-3").get();
      expect(coilSnap.data()?.status).toBe("VOIDED");
    });
  });

  describe('updateCoil', () => {
    it('feliz - edita bobina y deriva currentWeight, ignora status', async () => {
      const adminDb = admin.firestore();
      await adminDb.collection("coils").doc("BOB-UPD-1").set({
        initialWeight: 1000,
        currentWeight: 1000,
        status: "AVAILABLE",
        masterWidth: 1200,
        thickness: 0.45,
        finish: "GALV",
        pricePerKg: 3.5,
      });

      const request = {
        data: {
          coilId: "BOB-UPD-1",
          updates: {
            initialWeight: 1500, // Debe sobreescribir currentWeight
            currentWeight: 5000, // INTENTO DE MANDAR DISTINTO -> debe ser ignorado
            status: "PROCESSED", // INTENTO DE MANDAR STATUS -> ignorado
            masterWidth: 900,
            thickness: 0.5,
            finish: "PREP",
            pricePerKg: 4.0,
            invoiceDate: "2026-06-28",
            providerName: "Aceros SA"
          }
        },
        auth: { token: { role: "ADMIN", email: "admin@test.com" } }
      };

      await updateCoil.run(request as any);

      const coilSnap = await adminDb.collection("coils").doc("BOB-UPD-1").get();
      const coil = coilSnap.data()!;
      expect(coil.initialWeight).toBe(1500);
      expect(coil.currentWeight).toBe(1500); // Derivado de initialWeight!
      expect(coil.status).toBe("AVAILABLE"); // Inmutable
      expect(coil.masterWidth).toBe(900);
      expect(coil.thickness).toBe(0.5);
      expect(coil.finish).toBe("PREP");
      expect(coil.pricePerKg).toBe(4.0);
      expect(coil.metadata?.providerName).toBe("Aceros SA");
      expect(coil.metadata?.invoiceDate).toBeDefined(); // Se debe haber parseado

      const auditSnap = await adminDb.collection("audit_logs").where("action", "==", "EDIT_COIL").get();
      expect(auditSnap.size).toBe(1);
    });

    it('rechaza si rol es OPERATOR', async () => {
      const request = {
        data: { coilId: "BOB-UPD-1", updates: {} },
        auth: { token: { role: "OPERATOR", email: "op@test.com" } }
      };
      await expect(updateCoil.run(request as any)).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rechaza si status no es AVAILABLE', async () => {
      const adminDb = admin.firestore();
      await adminDb.collection("coils").doc("BOB-UPD-2").set({
        status: "PROCESSED",
      });
      const request = {
        data: { coilId: "BOB-UPD-2", updates: { initialWeight: 100 } },
        auth: { token: { role: "ADMIN", email: "admin@test.com" } }
      };
      await expect(updateCoil.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });
    });

    it('editar USD->PEN normaliza metadata.currency/exchangeRate y limpia originalCurrencyValue', async () => {
      const adminDb = admin.firestore();
      await adminDb.collection("coils").doc("BOB-UPD-CUR-1").set({
        initialWeight: 1000,
        currentWeight: 1000,
        status: "AVAILABLE",
        masterWidth: 1200,
        thickness: 0.45,
        finish: "GALV",
        pricePerKg: 7.0,
        metadata: { currency: "USD", exchangeRate: 3.5, originalCurrencyValue: 4000 },
      });

      const request = {
        data: {
          coilId: "BOB-UPD-CUR-1",
          updates: {
            initialWeight: 1000,
            masterWidth: 1200,
            thickness: 0.45,
            finish: "GALV",
            pricePerKg: 7.0,
            currency: "PEN",
          },
        },
        auth: { token: { role: "ADMIN", email: "admin@test.com" } },
      };

      await updateCoil.run(request as any);

      const coilSnap = await adminDb.collection("coils").doc("BOB-UPD-CUR-1").get();
      const coil = coilSnap.data()!;
      expect(coil.metadata?.currency).toBe("PEN");
      expect(coil.metadata?.exchangeRate).toBe(1);
      expect(coil.metadata?.originalCurrencyValue).toBeUndefined();
    });

    it('editar dejando USD con TC 3.5 persiste currency/exchangeRate/originalCurrencyValue', async () => {
      const adminDb = admin.firestore();
      await adminDb.collection("coils").doc("BOB-UPD-CUR-2").set({
        initialWeight: 2000,
        currentWeight: 2000,
        status: "AVAILABLE",
        masterWidth: 1200,
        thickness: 0.45,
        finish: "GALV",
        pricePerKg: 7.0,
        metadata: { currency: "USD", exchangeRate: 3.5, originalCurrencyValue: 4000 },
      });

      const request = {
        data: {
          coilId: "BOB-UPD-CUR-2",
          updates: {
            initialWeight: 2000,
            masterWidth: 1200,
            thickness: 0.45,
            finish: "GALV",
            pricePerKg: 7.0,
            currency: "USD",
            exchangeRate: 3.5,
            originalCurrencyValue: 4000,
          },
        },
        auth: { token: { role: "ADMIN", email: "admin@test.com" } },
      };

      await updateCoil.run(request as any);

      const coilSnap = await adminDb.collection("coils").doc("BOB-UPD-CUR-2").get();
      const coil = coilSnap.data()!;
      expect(coil.metadata?.currency).toBe("USD");
      expect(coil.metadata?.exchangeRate).toBe(3.5);
      expect(coil.metadata?.originalCurrencyValue).toBe(4000);
    });

    it('pricePerKg persiste tal cual lo manda el cliente, sin recombinar con exchangeRate', async () => {
      const adminDb = admin.firestore();
      await adminDb.collection("coils").doc("BOB-UPD-CUR-3").set({
        initialWeight: 2000,
        currentWeight: 2000,
        status: "AVAILABLE",
        masterWidth: 1200,
        thickness: 0.45,
        finish: "GALV",
        pricePerKg: 3.5,
        metadata: { currency: "PEN", exchangeRate: 1 },
      });

      const request = {
        data: {
          coilId: "BOB-UPD-CUR-3",
          updates: {
            initialWeight: 2000,
            masterWidth: 1200,
            thickness: 0.45,
            finish: "GALV",
            pricePerKg: 7.0, // ya convertido a PEN por el cliente
            currency: "USD",
            exchangeRate: 3.5,
            originalCurrencyValue: 4000,
          },
        },
        auth: { token: { role: "ADMIN", email: "admin@test.com" } },
      };

      await updateCoil.run(request as any);

      const coilSnap = await adminDb.collection("coils").doc("BOB-UPD-CUR-3").get();
      expect(coilSnap.data()?.pricePerKg).toBe(7.0);
    });

    it('rechaza USD sin exchangeRate valido (invalid-argument)', async () => {
      const adminDb = admin.firestore();
      await adminDb.collection("coils").doc("BOB-UPD-CUR-4").set({
        initialWeight: 1000,
        currentWeight: 1000,
        status: "AVAILABLE",
        masterWidth: 1200,
        thickness: 0.45,
        finish: "GALV",
        pricePerKg: 7.0,
      });

      const request = {
        data: {
          coilId: "BOB-UPD-CUR-4",
          updates: {
            initialWeight: 1000,
            masterWidth: 1200,
            thickness: 0.45,
            finish: "GALV",
            pricePerKg: 7.0,
            currency: "USD",
            exchangeRate: 1,
          },
        },
        auth: { token: { role: "ADMIN", email: "admin@test.com" } },
      };

      await expect(updateCoil.run(request as any)).rejects.toMatchObject({ code: 'invalid-argument' });
    });
  });

  describe('cancelCoilPlan', () => {
    it('feliz - permite cancelar plan de bobina IN_PROGRESS (plannedStrips vacio o sin cortes)', async () => {
      const adminDb = admin.firestore();
      await adminDb.collection("coils").doc("BOB-CANC-1").set({
        status: "IN_PROGRESS",
        plannedStrips: [
          { initialCount: 10, pendingCount: 10 } // ningun corte ejecutado
        ]
      });

      const request = {
        data: { coilId: "BOB-CANC-1" },
        auth: { token: { role: "ADMIN", email: "admin@test.com" } }
      };

      await cancelCoilPlan.run(request as any);

      const coilSnap = await adminDb.collection("coils").doc("BOB-CANC-1").get();
      expect(coilSnap.data()?.status).toBe("AVAILABLE");
      expect(coilSnap.data()?.plannedStrips).toEqual([]);

      const auditSnap = await adminDb.collection("audit_logs").where("action", "==", "CANCEL_CUTTING_PLAN").get();
      expect(auditSnap.size).toBe(1);
    });

    it('rechaza cancelar si ya hay strips cortados', async () => {
      const adminDb = admin.firestore();
      await adminDb.collection("coils").doc("BOB-CANC-2").set({
        status: "IN_PROGRESS",
        plannedStrips: [
          { initialCount: 10, pendingCount: 5 } // 5 cortados
        ]
      });

      const request = {
        data: { coilId: "BOB-CANC-2" },
        auth: { token: { role: "ADMIN", email: "admin@test.com" } }
      };

      await expect(cancelCoilPlan.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });
    });

    it('rechaza si rol es OPERATOR', async () => {
      const request = {
        data: { coilId: "BOB-CANC-1" },
        auth: { token: { role: "OPERATOR", email: "op@test.com" } }
      };
      await expect(cancelCoilPlan.run(request as any)).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rechaza si status no es IN_PROGRESS', async () => {
      const adminDb = admin.firestore();
      await adminDb.collection("coils").doc("BOB-CANC-3").set({
        status: "AVAILABLE",
      });
      const request = {
        data: { coilId: "BOB-CANC-3" },
        auth: { token: { role: "ADMIN", email: "admin@test.com" } }
      };
      await expect(cancelCoilPlan.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });
    });
  });
});
