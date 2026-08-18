import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import {
  setupIntegrationTest,
  clearFirestore,
  cleanupIntegrationTest
} from './firestore-helpers';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';
import { fetchAllQuotations } from '@/core/sales/services/salesService';

vi.unmock("@/lib/firebase/clientApp");

describe("fetchAllQuotations (Frente #9-A: /admin/quotations)", () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest();
  });

  beforeEach(async () => {
    await clearFirestore();

    const baseDate = new Date("2026-08-01T12:00:00.000Z");

    // Percha importada vigente
    await setDoc(doc(db, "sales", "COT-INV-A"), {
      documentNumber: "INV-A",
      customerName: "CLIENTE A",
      status: "QUOTATION",
      relatedSaleId: "INV-A",
      metadata: { isQuotation: true },
      timestamp: baseDate,
      items: [{ sku: "COB030ROJO", quantity: 10, businessLine: "metallic-roofing" }],
    });

    // Percha importada cancelada (caso vivo confirmado en el PASO 0: cancelQuotation no distingue origen)
    await setDoc(doc(db, "sales", "COT-INV-B"), {
      documentNumber: "INV-B",
      customerName: "CLIENTE B",
      status: "CANCELLED",
      relatedSaleId: "INV-B",
      metadata: { isQuotation: true },
      timestamp: baseDate,
      items: [{ sku: "COB030ROJO", quantity: 5, businessLine: "metallic-roofing" }],
    });

    // Cotización nativa vigente
    await setDoc(doc(db, "sales", "C-000001"), {
      documentNumber: "",
      customerName: "CLIENTE C",
      status: "QUOTATION",
      timestamp: baseDate,
      items: [{ sku: "P25GALV", quantity: 20, businessLine: "drywall" }],
    });

    // Cotización nativa cancelada (caso C-000020 de prod)
    await setDoc(doc(db, "sales", "C-000002"), {
      documentNumber: "",
      customerName: "CLIENTE D",
      status: "CANCELLED",
      timestamp: baseDate,
      items: [{ sku: "P25GALV", quantity: 15, businessLine: "drywall" }],
    });

    // Venta real completada — NO debe aparecer
    await setDoc(doc(db, "sales", "INV-A"), {
      documentNumber: "INV-A",
      customerName: "CLIENTE A",
      status: "COMPLETED",
      relatedQuotationId: "COT-INV-A",
      timestamp: baseDate,
      items: [{ sku: "COB030ROJO", quantity: 10, businessLine: "metallic-roofing" }],
    });

    // Venta real anulada — NO debe aparecer
    await setDoc(doc(db, "sales", "V-000099"), {
      documentNumber: "V-000099",
      customerName: "CLIENTE E",
      status: "VOIDED",
      timestamp: baseDate,
      items: [{ sku: "P25GALV", quantity: 3, businessLine: "drywall" }],
    });
  });

  it("trae las 4 cotizaciones (2 importadas COT-* + 2 nativas C-* QUOTATION/CANCELLED), sin duplicar, sin ventas reales", async () => {
    const result = await fetchAllQuotations();
    const ids = result.map((s) => s.id).sort();
    expect(ids).toEqual(["C-000001", "C-000002", "COT-INV-A", "COT-INV-B"]);
  });

  it("no incluye la venta COMPLETED ni la VOIDED", async () => {
    const result = await fetchAllQuotations();
    const ids = result.map((s) => s.id);
    expect(ids).not.toContain("INV-A");
    expect(ids).not.toContain("V-000099");
  });

  it("una COT-* con status QUOTATION no aparece duplicada (matchea ambas queries, dedup por id)", async () => {
    const result = await fetchAllQuotations();
    const ids = result.map((s) => s.id);
    const occurrences = ids.filter((id) => id === "COT-INV-A").length;
    expect(occurrences).toBe(1);
  });
});
