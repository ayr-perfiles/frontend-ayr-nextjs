import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import {
  setupIntegrationTest,
  clearFirestore,
  cleanupIntegrationTest
} from './firestore-helpers';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';
import { cancelQuotation } from '@/core/sales/services/salesService';

vi.unmock("@/lib/firebase/clientApp");

describe("cancelQuotation — guard contra perchas importadas (Frente #9-B.1)", () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest();
  });

  beforeEach(async () => {
    await clearFirestore();

    const baseDate = new Date("2026-08-18T12:00:00.000Z");

    // Percha importada — identificada por relatedSaleId
    await setDoc(doc(db, "sales", "COT-INV-A"), {
      documentNumber: "INV-A",
      customerName: "CLIENTE A",
      status: "QUOTATION",
      relatedSaleId: "INV-A",
      isFulfilled: true,
      timestamp: baseDate,
      items: [],
    });

    // Percha importada — identificada solo por metadata.isQuotation (sin relatedSaleId)
    await setDoc(doc(db, "sales", "COT-INV-B"), {
      documentNumber: "INV-B",
      customerName: "CLIENTE B",
      status: "QUOTATION",
      metadata: { isQuotation: true },
      isFulfilled: false,
      timestamp: baseDate,
      items: [],
    });

    // Cotización nativa — sin ninguno de los 2 marcadores
    await setDoc(doc(db, "sales", "C-000001"), {
      documentNumber: "",
      customerName: "CLIENTE C",
      status: "QUOTATION",
      timestamp: baseDate,
      items: [],
    });
  });

  it("1. RED->GREEN: cancelar una importada (relatedSaleId) tira el error de bloqueo, sin cambiar su status", async () => {
    await expect(cancelQuotation("COT-INV-A", "tester@ayr.com")).rejects.toThrow(
      "No se puede cancelar una cotización importada: proviene de una venta ya facturada. Para revertir, anule la venta.",
    );
    const snap = await getDoc(doc(db, "sales", "COT-INV-A"));
    expect(snap.data()?.status).toBe("QUOTATION");
  });

  it("2. RED->GREEN: cancelar una importada identificada solo por metadata.isQuotation también bloquea", async () => {
    await expect(cancelQuotation("COT-INV-B", "tester@ayr.com")).rejects.toThrow(
      "No se puede cancelar una cotización importada",
    );
    const snap = await getDoc(doc(db, "sales", "COT-INV-B"));
    expect(snap.data()?.status).toBe("QUOTATION");
  });

  it("3. Anti-regresión: cancelar una cotización NATIVA sigue funcionando igual que antes", async () => {
    const result = await cancelQuotation("C-000001", "tester@ayr.com");
    expect(result).toEqual({ success: true });
    const snap = await getDoc(doc(db, "sales", "C-000001"));
    expect(snap.data()?.status).toBe("CANCELLED");
    expect(snap.data()?.cancelledBy).toBe("tester@ayr.com");
  });
});
