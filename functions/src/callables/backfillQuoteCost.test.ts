import { describe, it, expect, beforeEach, afterAll, beforeAll } from "vitest";
import * as admin from "firebase-admin";
import { backfillQuoteCost } from "./backfillQuoteCost";
import fft from "firebase-functions-test";

const testEnv = fft({ projectId: "demo-ayrsteel-test" });
if (!admin.apps.length) {
  admin.initializeApp({ projectId: "demo-ayrsteel-test" });
}
const wrapped = testEnv.wrap(backfillQuoteCost) as any;

describe("backfillQuoteCost", () => {
  const db = admin.firestore();

  beforeAll(async () => {
    // Emulator should be running via FIRESTORE_EMULATOR_HOST
  });

  beforeEach(async () => {
    const collections = await db.listCollections();
    for (const col of collections) {
      const docs = await col.get();
      const batch = db.batch();
      docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  });

  afterAll(() => {
    testEnv.cleanup();
  });

  // backfillQuoteCost es onCall v2 (`functions.https.onCall(async (request) => ...)`, un
  // solo argumento). `testEnv.wrap` de un v2 devuelve `(req) => cloudFunction.run(req)`,
  // así que hay que pasarle `{data, auth}` en UN objeto. La forma v1 `wrapped(data, context)`
  // dejaba `request.auth` undefined y hacía que los 4 tests murieran en el guard
  // "Only ADMIN can backfill quote costs". Mismo patrón que
  // `__tests__/annulSale.integration.test.ts`, que ya lo hacía bien.
  const adminAuth = { uid: "admin-uid", token: { role: "ADMIN" } };

  it("RED-A: no-op si ya sincronizada (costSyncedAt presente)", async () => {
    const quoteId = "COT-FFA1-1289";
    const saleId = "FFA1-1289";

    await db.collection("sales").doc(quoteId).set({
      relatedSaleId: saleId,
      items: [{ sku: "SKU1", quantity: 10, businessLine: "metallic-roofing" }]
    });

    await db.collection("sales").doc(saleId).set({
      costSyncedAt: admin.firestore.Timestamp.now(),
      items: [{ sku: "SKU1", quantity: 10, businessLine: "metallic-roofing", baseCost: 0 }],
      totalCost: 0
    });

    await db.collection("production_logs").doc("log1").set({
      source: { type: "QUOTE", id: quoteId },
      sku: "SKU1",
      piecesProduced: 10,
      stripCost: 100,
      status: "ACTIVE"
    });

    const res = await wrapped({ data: { quoteId }, auth: adminAuth });
    expect(res).toEqual({ skipped: true, reason: "already-synced" });

    // Validate sale was not modified
    const saleSnap = await db.collection("sales").doc(saleId).get();
    expect(saleSnap.data()?.totalCost).toBe(0);
  });

  it("RED-B: backfill real (venta baseCost 0 -> con baseCost y totalCost)", async () => {
    const quoteId = "COT-FFA1-1262";
    const saleId = "FFA1-1262";

    await db.collection("sales").doc(quoteId).set({
      relatedSaleId: saleId,
      items: [{ sku: "SKU2", quantity: 5, businessLine: "metallic-roofing" }]
    });

    await db.collection("sales").doc(saleId).set({
      items: [{ sku: "SKU2", quantity: 5, businessLine: "metallic-roofing", baseCost: 0, unitValue: 30, profit: 150, flags: ["sin costo"] }],
      totalCost: 0,
      totalProfit: 150,
      allFlags: ["sin costo", "other-flag"]
    });

    await db.collection("production_logs").doc("log2").set({
      source: { type: "QUOTE", id: quoteId },
      sku: "SKU2",
      piecesProduced: 5,
      stripCost: 50, // unit cost = 10
      status: "ACTIVE"
    });

    const res = await wrapped({ data: { quoteId }, auth: adminAuth });
    expect(res.skipped).toBe(false);
    expect(res.success).toBe(true);

    const saleSnap = await db.collection("sales").doc(saleId).get();
    const saleData = saleSnap.data()!;

    expect(saleData.costSyncedAt).toBeDefined();
    expect(saleData.totalCost).toBe(50); // 5 * 10
    expect(saleData.totalProfit).toBe(100); // 150 - 50
    expect(saleData.allFlags).not.toContain("sin costo");
    expect(saleData.allFlags).toContain("other-flag");
    expect(saleData.items[0].baseCost).toBe(10);
    expect(saleData.items[0].profit).toBe(100); // (30 - 10) * 5
    expect(saleData.items[0].costSource).toBe("PRODUCTION");
    expect(saleData.items[0].flags).not.toContain("sin costo");
  });

  it("RED-C: whitelist (rechaza si no está en whitelist)", async () => {
    const res = await wrapped({ data: { quoteId: "COT-NOT-IN-LIST" }, auth: adminAuth });
    expect(res).toEqual({ skipped: true, reason: "not-in-whitelist" });
  });

  it("RED-D: re-valida (cotización ya no cumple, logs insuficientes)", async () => {
    const quoteId = "COT-FFA1-1290";
    const saleId = "FFA1-1290";

    await db.collection("sales").doc(quoteId).set({
      relatedSaleId: saleId,
      items: [{ sku: "SKU3", quantity: 10, businessLine: "metallic-roofing" }]
    });

    await db.collection("sales").doc(saleId).set({
      items: [{ sku: "SKU3", quantity: 10, businessLine: "metallic-roofing", baseCost: 0 }],
      totalCost: 0
    });

    // 0 pieces produced -> insufficient
    await db.collection("production_logs").doc("log3").set({
      source: { type: "QUOTE", id: quoteId },
      sku: "SKU3",
      piecesProduced: 5, // Requires 10
      stripCost: 50,
      status: "ACTIVE"
    });

    const res = await wrapped({ data: { quoteId }, auth: adminAuth });
    expect(res).toEqual({ skipped: true, reason: "quote-not-fulfilled" });
    
    const saleSnap = await db.collection("sales").doc(saleId).get();
    expect(saleSnap.data()?.costSyncedAt).toBeUndefined();
  });
});
