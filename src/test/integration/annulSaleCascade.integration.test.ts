import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import {
  setupIntegrationTest,
  clearFirestore,
  cleanupIntegrationTest,
} from './firestore-helpers';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';
import { annulSale } from '@/core/sales/services/salesService';

vi.unmock("@/lib/firebase/clientApp");

describe("annulSale — bloqueo por producción viva de la percha vinculada (#9-B.2b, D1/D2)", () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest();
  });

  beforeEach(async () => {
    await clearFirestore();

    const baseDate = new Date("2026-08-18T12:00:00.000Z");

    // ── Escenario 1: IMPORTADA, log ACTIVE, CUMPLIDA (isFulfilled:true) ──────
    await setDoc(doc(db, "sales", "SALE-IMP-1"), {
      status: "COMPLETED",
      customerName: "CLIENTE IMP 1",
      relatedQuotationId: "COT-IMP-1",
      items: [],
      timestamp: baseDate,
    });
    await setDoc(doc(db, "sales", "COT-IMP-1"), {
      status: "QUOTATION",
      customerName: "CLIENTE IMP 1",
      relatedSaleId: "IMP-1",
      metadata: { isQuotation: true },
      isFulfilled: true,
      items: [{ sku: "SKU-A", quantity: 10, businessLine: "metallic-roofing" }],
      timestamp: baseDate,
    });
    await setDoc(doc(db, "production_logs", "LOG-IMP-1"), {
      source: { type: "QUOTE", id: "COT-IMP-1" },
      status: "ACTIVE",
      sku: "SKU-A",
      piecesProduced: 10,
      timestamp: baseDate,
    });

    // ── Escenario 2: NATIVA, log ACTIVE ───────────────────────────────────────
    await setDoc(doc(db, "sales", "V-NAT-1"), {
      status: "COMPLETED",
      customerName: "CLIENTE NAT 1",
      originQuoteId: "C-NAT-1",
      items: [],
      timestamp: baseDate,
    });
    await setDoc(doc(db, "sales", "C-NAT-1"), {
      status: "CONVERTED",
      customerName: "CLIENTE NAT 1",
      convertedToId: "V-NAT-1",
      items: [{ sku: "SKU-B", quantity: 20, businessLine: "metallic-roofing" }],
      timestamp: baseDate,
    });
    await setDoc(doc(db, "production_logs", "LOG-NAT-1"), {
      source: { type: "QUOTE", id: "C-NAT-1" },
      status: "ACTIVE",
      sku: "SKU-B",
      piecesProduced: 5,
      timestamp: baseDate,
    });

    // ── Escenario 3: IMPORTADA, log ACTIVE, PARCIAL (isFulfilled:false) ──────
    await setDoc(doc(db, "sales", "SALE-IMP-3"), {
      status: "COMPLETED",
      customerName: "CLIENTE IMP 3",
      relatedQuotationId: "COT-IMP-3",
      items: [],
      timestamp: baseDate,
    });
    await setDoc(doc(db, "sales", "COT-IMP-3"), {
      status: "QUOTATION",
      customerName: "CLIENTE IMP 3",
      relatedSaleId: "IMP-3",
      metadata: { isQuotation: true },
      isFulfilled: false,
      items: [{ sku: "SKU-C", quantity: 100, businessLine: "metallic-roofing" }],
      timestamp: baseDate,
    });
    await setDoc(doc(db, "production_logs", "LOG-IMP-3"), {
      source: { type: "QUOTE", id: "COT-IMP-3" },
      status: "ACTIVE",
      sku: "SKU-C",
      piecesProduced: 10, // parcial: 10 de 100 pedidos
      timestamp: baseDate,
    });

    // ── Escenario 4: NATIVA, SIN producción activa ────────────────────────────
    await setDoc(doc(db, "sales", "V-NAT-2"), {
      status: "COMPLETED",
      customerName: "CLIENTE NAT 2",
      originQuoteId: "C-NAT-2",
      items: [],
      timestamp: baseDate,
    });
    await setDoc(doc(db, "sales", "C-NAT-2"), {
      status: "CONVERTED",
      customerName: "CLIENTE NAT 2",
      convertedToId: "V-NAT-2",
      items: [{ sku: "SKU-D", quantity: 5, businessLine: "metallic-roofing" }],
      timestamp: baseDate,
    });
    // log VOIDED — no cuenta como producción activa
    await setDoc(doc(db, "production_logs", "LOG-NAT-2"), {
      source: { type: "QUOTE", id: "C-NAT-2" },
      status: "VOIDED",
      sku: "SKU-D",
      piecesProduced: 5,
      timestamp: baseDate,
    });

    // ── Escenario 5: IMPORTADA, SIN producción activa (regression guard) ─────
    await setDoc(doc(db, "sales", "SALE-IMP-2"), {
      status: "COMPLETED",
      customerName: "CLIENTE IMP 2",
      relatedQuotationId: "COT-IMP-2",
      items: [],
      timestamp: baseDate,
    });
    await setDoc(doc(db, "sales", "COT-IMP-2"), {
      status: "QUOTATION",
      customerName: "CLIENTE IMP 2",
      relatedSaleId: "IMP-2",
      metadata: { isQuotation: true },
      isFulfilled: false,
      items: [{ sku: "SKU-E", quantity: 8, businessLine: "metallic-roofing" }],
      timestamp: baseDate,
    });
    // sin production_logs para esta percha
  });

  it("1. IMPORTADA con log ACTIVE (CUMPLIDA) → THROW, venta NO se toca", async () => {
    await expect(
      annulSale({ saleId: "SALE-IMP-1", userEmail: "tester@ayr.com" }),
    ).rejects.toThrow("COT-IMP-1");

    const saleSnap = await getDoc(doc(db, "sales", "SALE-IMP-1"));
    expect(saleSnap.data()?.status).toBe("COMPLETED");
  });

  it("2. NATIVA con log ACTIVE → THROW, venta y cotización NO se tocan", async () => {
    await expect(
      annulSale({ saleId: "V-NAT-1", userEmail: "tester@ayr.com" }),
    ).rejects.toThrow("C-NAT-1");

    const saleSnap = await getDoc(doc(db, "sales", "V-NAT-1"));
    expect(saleSnap.data()?.status).toBe("COMPLETED");

    const quoteSnap = await getDoc(doc(db, "sales", "C-NAT-1"));
    expect(quoteSnap.data()?.status).toBe("CONVERTED");
    expect(quoteSnap.data()?.convertedToId).toBe("V-NAT-1");
  });

  it("3. IMPORTADA con log ACTIVE PARCIAL (isFulfilled:false) → THROW igual (no solo CUMPLIDA)", async () => {
    await expect(
      annulSale({ saleId: "SALE-IMP-3", userEmail: "tester@ayr.com" }),
    ).rejects.toThrow("COT-IMP-3");

    const saleSnap = await getDoc(doc(db, "sales", "SALE-IMP-3"));
    expect(saleSnap.data()?.status).toBe("COMPLETED");
  });

  it("4. NATIVA sin producción activa → annul OK, quote vuelve a QUOTATION y convertedToId se elimina", async () => {
    const result = await annulSale({ saleId: "V-NAT-2", userEmail: "tester@ayr.com" });
    expect(result).toEqual({ success: true });

    const saleSnap = await getDoc(doc(db, "sales", "V-NAT-2"));
    expect(saleSnap.data()?.status).toBe("VOIDED");

    const quoteSnap = await getDoc(doc(db, "sales", "C-NAT-2"));
    expect(quoteSnap.data()?.status).toBe("QUOTATION");
    expect(quoteSnap.data()?.annulledSaleRef).toBe("V-NAT-2");
    expect(quoteSnap.data()?.convertedToId).toBeUndefined();
  });

  it("5. IMPORTADA sin producción activa → annul OK, percha importada byte-intacta (regression guard)", async () => {
    const result = await annulSale({ saleId: "SALE-IMP-2", userEmail: "tester@ayr.com" });
    expect(result).toEqual({ success: true });

    const saleSnap = await getDoc(doc(db, "sales", "SALE-IMP-2"));
    expect(saleSnap.data()?.status).toBe("VOIDED");

    const quoteSnap = await getDoc(doc(db, "sales", "COT-IMP-2"));
    const quoteData = quoteSnap.data();
    expect(quoteData?.status).toBe("QUOTATION");
    expect(quoteData?.relatedSaleId).toBe("IMP-2");
    expect(quoteData?.annulledSaleRef).toBeUndefined();
    expect(quoteData?.convertedToId).toBeUndefined();
  });
});
