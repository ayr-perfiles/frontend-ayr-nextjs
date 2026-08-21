import { describe, it, expect, beforeEach, afterAll } from "vitest";
import * as admin from "firebase-admin";
import { annulSale } from "../sales";
import fft from "firebase-functions-test";
// Cross-boundary permitido: este es un .test.ts (excluido del build de functions/,
// mismo patrón que los parity tests de src/domain/annulment/__tests__/).
import { seedAnnulFixtures, type SeededFixtures } from "../../../../src/test/integration/fixtures/seedAnnulFixtures";

const testEnv = fft({ projectId: "demo-ayrsteel-test" });
if (!admin.apps.length) {
  admin.initializeApp({ projectId: "demo-ayrsteel-test" });
}
// annulSale es onCall v2 (firebase-functions/v2/https) — wrapV2 espera UN solo
// objeto {data, auth}, no el patrón (data, context) de v1 que usa backfillQuoteCost.test.ts
// (functions.https.onCall, v1). Confirmado leyendo node_modules/firebase-functions-test/lib/v2.js:
// `wrapV2` = `(req) => cloudFunction.run(req)`.
const wrapped = testEnv.wrap(annulSale) as (req: { data: unknown; auth?: unknown }) => Promise<any>;

const adminAuth = { uid: "admin-uid", token: { role: "ADMIN", email: "admin@fixture.com" } };
const operatorAuth = { uid: "operator-uid", token: { role: "OPERATOR", email: "operator@fixture.com" } };

function invokeAsAdmin(saleId: string) {
  return wrapped({ data: { saleId }, auth: adminAuth });
}

describe("annulSale (callable)", () => {
  const db = admin.firestore();
  let seeded: SeededFixtures;

  beforeEach(async () => {
    seeded = await seedAnnulFixtures(db);
  });

  afterAll(() => {
    testEnv.cleanup();
  });

  it("F1 native happy: anula la venta, revierte la quote a QUOTATION y limpia convertedToId/approvedAt/costSyncedAt", async () => {
    const res = await invokeAsAdmin(seeded.F1_native_happy.saleId);
    expect(res).toEqual({ success: true });

    const saleSnap = await db.collection("sales").doc(seeded.F1_native_happy.saleId).get();
    expect(saleSnap.data()?.status).toBe("VOIDED");
    expect(saleSnap.data()?.voidedAt).toBeDefined();
    expect(saleSnap.data()?.voidedBy).toBe("admin@fixture.com");

    const quoteSnap = await db.collection("sales").doc(seeded.F1_native_happy.quoteId).get();
    const quoteData = quoteSnap.data()!;
    expect(quoteData.status).toBe("QUOTATION");
    expect(quoteData.convertedToId).toBeUndefined();
    expect(quoteData.approvedAt).toBeUndefined();
    expect(quoteData.costSyncedAt).toBeUndefined();
    expect(quoteData.annulledSaleRef).toMatchObject({
      saleId: seeded.F1_native_happy.saleId,
      annulledBy: "admin@fixture.com",
    });
  });

  it("F2 imported happy: anula la venta, percha NO cambia status/productionStatus/isFulfilled, recibe annulledSaleRefs", async () => {
    const res = await invokeAsAdmin(seeded.F2_imported_happy.saleId);
    expect(res).toEqual({ success: true });

    const saleSnap = await db.collection("sales").doc(seeded.F2_imported_happy.saleId).get();
    expect(saleSnap.data()?.status).toBe("VOIDED");

    const perchaSnap = await db.collection("sales").doc(seeded.F2_imported_happy.perchaId).get();
    const perchaData = perchaSnap.data()!;
    expect(perchaData.status).toBe("QUOTATION"); // sin cambio, ya era QUOTATION
    expect(perchaData.productionStatus).toBe("CONFIRMED"); // sin cambio
    expect(perchaData.isFulfilled).toBe(true); // sin cambio
    expect(Array.isArray(perchaData.annulledSaleRefs)).toBe(true);
    expect(perchaData.annulledSaleRefs).toHaveLength(1);
    expect(perchaData.annulledSaleRefs[0]).toMatchObject({ saleId: seeded.F2_imported_happy.saleId });
  });

  it("F3 native block: throw failed-precondition con 'produccion activa', venta y quote sin tocar", async () => {
    await expect(invokeAsAdmin(seeded.F3_native_block.saleId)).rejects.toMatchObject({
      code: "failed-precondition",
      message: expect.stringContaining("producción activa"),
    });

    const saleSnap = await db.collection("sales").doc(seeded.F3_native_block.saleId).get();
    expect(saleSnap.data()?.status).toBe("COMPLETED");
    const quoteSnap = await db.collection("sales").doc(seeded.F3_native_block.quoteId).get();
    expect(quoteSnap.data()?.status).toBe("CONVERTED");
  });

  it("F4 imported block: throw failed-precondition con 'produccion activa', venta y percha sin tocar", async () => {
    await expect(invokeAsAdmin(seeded.F4_imported_block.saleId)).rejects.toMatchObject({
      code: "failed-precondition",
      message: expect.stringContaining("producción activa"),
    });

    const saleSnap = await db.collection("sales").doc(seeded.F4_imported_block.saleId).get();
    expect(saleSnap.data()?.status).toBe("COMPLETED");
    const perchaSnap = await db.collection("sales").doc(seeded.F4_imported_block.perchaId).get();
    expect(perchaSnap.data()?.annulledSaleRefs).toBeUndefined();
  });

  it("F5 native ex-active: log VOIDED no bloquea, annul procede OK", async () => {
    const res = await invokeAsAdmin(seeded.F5_native_ex_active.saleId);
    expect(res).toEqual({ success: true });

    const saleSnap = await db.collection("sales").doc(seeded.F5_native_ex_active.saleId).get();
    expect(saleSnap.data()?.status).toBe("VOIDED");
  });

  it("F6 orphan: anula la venta, sin write a ninguna quote", async () => {
    const res = await invokeAsAdmin(seeded.F6_orphan.saleId);
    expect(res).toEqual({ success: true });

    const saleSnap = await db.collection("sales").doc(seeded.F6_orphan.saleId).get();
    expect(saleSnap.data()?.status).toBe("VOIDED");
  });

  it("F7 D3: sale.items[].baseCost sincronizado NO se restaura al original de la quote", async () => {
    const quoteBefore = await db.collection("sales").doc(seeded.F7_native_with_synced_cost.quoteId).get();
    const originalQuoteTotalCost = quoteBefore.data()?.totalCost;

    const res = await invokeAsAdmin(seeded.F7_native_with_synced_cost.saleId);
    expect(res).toEqual({ success: true });

    const saleSnap = await db.collection("sales").doc(seeded.F7_native_with_synced_cost.saleId).get();
    const saleData = saleSnap.data()!;
    expect(saleData.status).toBe("VOIDED");
    // El costo sincronizado (A1 write-back) NO se revierte — sigue distinto al de la quote original.
    expect(saleData.totalCost).not.toBe(originalQuoteTotalCost);
    expect(saleData.items[0].baseCost).toBe(6.4);

    const quoteAfter = await db.collection("sales").doc(seeded.F7_native_with_synced_cost.quoteId).get();
    expect(quoteAfter.data()?.status).toBe("QUOTATION");
  });

  it("Idempotencia: segunda invocación sobre la misma venta ya VOIDED -> failed-precondition 'ya ha sido anulada'", async () => {
    const first = await invokeAsAdmin(seeded.F1_native_happy.saleId);
    expect(first).toEqual({ success: true });

    await expect(invokeAsAdmin(seeded.F1_native_happy.saleId)).rejects.toMatchObject({
      code: "failed-precondition",
      message: expect.stringContaining("ya ha sido anulada"),
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Path `self` — un doc con status QUOTATION. `resolveSaleQuotationLink` lo
  // clasifica como mode:"self" ANTES de mirar relatedQuotationId/originQuoteId
  // (saleQuotationLink.ts:26-28), y tanto la query de logs (sales.ts:88) como el
  // bloqueo (canAnnulSale.ts:39) están gateados a mode==="linked" → no corren.
  // ══════════════════════════════════════════════════════════════════════════

  it("F8 self block: cotización QUOTATION con producción ACTIVE -> failed-precondition, sin tocar el doc", async () => {
    await expect(invokeAsAdmin(seeded.F8_quotation_self_block.quoteId)).rejects.toMatchObject({
      code: "failed-precondition",
      message: expect.stringContaining("producci"),
    });

    const quoteSnap = await db.collection("sales").doc(seeded.F8_quotation_self_block.quoteId).get();
    expect(quoteSnap.data()?.status).toBe("QUOTATION");
    expect(quoteSnap.data()?.voidedAt).toBeUndefined();
  });

  it("F8 self block: el error trae details con quotationId y activeLogIds (mismo shape que el bloqueo linked)", async () => {
    await expect(invokeAsAdmin(seeded.F8_quotation_self_block.quoteId)).rejects.toMatchObject({
      details: {
        quotationId: seeded.F8_quotation_self_block.quoteId,
        activeLogIds: [seeded.F8_quotation_self_block.logId],
      },
    });
  });

  it("F9 self sin producción: sigue anulándose OK (no-regresión — el bloqueo es por producción, no por status)", async () => {
    const res = await invokeAsAdmin(seeded.F9_quotation_self_no_prod.quoteId);
    expect(res).toEqual({ success: true });

    const quoteSnap = await db.collection("sales").doc(seeded.F9_quotation_self_no_prod.quoteId).get();
    expect(quoteSnap.data()?.status).toBe("VOIDED");
    expect(quoteSnap.data()?.voidedBy).toBe("admin@fixture.com");
  });

  // ══════════════════════════════════════════════════════════════════════════
  // STOCK FANTASMA — una cotización NUNCA descuenta stock al crearse
  // (createQuotation no llama a ninguna strategy; el importador atribuye el
  // descuento a la VENTA, no a la percha). Anularla NO debe devolver nada.
  // ══════════════════════════════════════════════════════════════════════════

  it("F9 stock fantasma: anular una QUOTATION NO incrementa metallic_roofing_stock", async () => {
    const stockRef = db.collection("metallic_roofing_stock").doc(seeded.F9_quotation_self_no_prod.stockSku);

    const before = await stockRef.get();
    expect(before.data()?.quantity).toBe(seeded.stockBaseline.quantity);

    const res = await invokeAsAdmin(seeded.F9_quotation_self_no_prod.quoteId);
    expect(res).toEqual({ success: true });

    const after = await stockRef.get();
    // La cotización lleva METALLIC_ITEM con quantity 10 — hoy el loop de items
    // (sales.ts:154-199, sin gate de status) hace writeSaleReversal y suma esos 10.
    expect(after.data()?.quantity).toBe(seeded.stockBaseline.quantity);
    expect(after.data()?.avgCost).toBe(seeded.stockBaseline.avgCost);
    expect(after.data()?.totalValue).toBe(seeded.stockBaseline.totalValue);
  });

  it("F9 stock fantasma: tampoco escribe un movimiento de stock", async () => {
    const movesCol = db.collection("metallic_roofing_stock_movements");
    const countBefore = (await movesCol.get()).size;

    await invokeAsAdmin(seeded.F9_quotation_self_no_prod.quoteId);

    const countAfter = (await movesCol.get()).size;
    expect(countAfter).toBe(countBefore);
  });

  it("F2 no-regresión de stock: anular una VENTA COMPLETED SÍ devuelve el stock, idéntico a antes", async () => {
    const stockRef = db.collection("metallic_roofing_stock").doc(seeded.stockBaseline.sku);
    const countBefore = (await db.collection("metallic_roofing_stock_movements").get()).size;

    const res = await invokeAsAdmin(seeded.F2_imported_happy.saleId);
    expect(res).toEqual({ success: true });

    const after = await stockRef.get();
    // METALLIC_ITEM.quantity === 10 → la venta devuelve 10 unidades al stock.
    expect(after.data()?.quantity).toBe(seeded.stockBaseline.quantity + 10);

    const countAfter = (await db.collection("metallic_roofing_stock_movements").get()).size;
    expect(countAfter).toBe(countBefore + 1);
  });

  it("Auth: sin auth -> unauthenticated", async () => {
    await expect(
      wrapped({ data: { saleId: seeded.F1_native_happy.saleId } }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("Auth: rol OPERATOR -> permission-denied", async () => {
    await expect(
      wrapped({ data: { saleId: seeded.F1_native_happy.saleId }, auth: operatorAuth }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});
