import { describe, it, expect, beforeAll } from "vitest";
import * as admin from "firebase-admin";
import { seedAnnulFixtures } from "../seedAnnulFixtures";

const PROJECT_ID = "ayrsteel-test";

// Mismo patrón robusto que firestore-helpers.ts (app NOMBRADA por projectId, no la
// default) — evita la fragilidad documentada de `admin.firestore()` (default app),
// que solo funciona si otro archivo de la suite ya la inicializó antes (ver deuda
// productionConfirmation.integration.test.ts #10, HANDOFF.md).
function getAdminDb(): admin.firestore.Firestore {
  let adminApp: admin.app.App;
  try {
    adminApp = admin.app(PROJECT_ID);
  } catch {
    adminApp = admin.initializeApp({ projectId: PROJECT_ID }, PROJECT_ID);
  }
  return adminApp.firestore();
}

async function countFixtureDocs(db: admin.firestore.Firestore, collectionName: string): Promise<number> {
  const snap = await db.collection(collectionName).where("metadata.isAnnulFixture", "==", true).count().get();
  return snap.data().count;
}

describe("seedAnnulFixtures", () => {
  let db: admin.firestore.Firestore;

  beforeAll(() => {
    db = getAdminDb();
  });

  it("primer run crea las 9 fixtures con los IDs esperados + counts correctos (15 sales + 4 production_logs)", async () => {
    const seeded = await seedAnnulFixtures(db);

    expect(seeded.F1_native_happy).toEqual({ saleId: "ANNUL-FIX-C-001", quoteId: "ANNUL-FIX-Q-001" });
    expect(seeded.F2_imported_happy).toEqual({ saleId: "ANNUL-FIX-S-F2-001", perchaId: "ANNUL-FIX-COT-F2-001" });
    expect(seeded.F3_native_block).toEqual({
      saleId: "ANNUL-FIX-C-F3-001",
      quoteId: "ANNUL-FIX-Q-F3-001",
      logId: "ANNUL-FIX-LOG-F3-001",
    });
    expect(seeded.F4_imported_block).toEqual({
      saleId: "ANNUL-FIX-S-F4-001",
      perchaId: "ANNUL-FIX-COT-F4-001",
      logId: "ANNUL-FIX-LOG-F4-001",
    });
    expect(seeded.F5_native_ex_active).toEqual({
      saleId: "ANNUL-FIX-C-F5-001",
      quoteId: "ANNUL-FIX-Q-F5-001",
      logId: "ANNUL-FIX-LOG-F5-001",
    });
    expect(seeded.F6_orphan).toEqual({ saleId: "ANNUL-FIX-S-F6-001" });
    expect(seeded.F7_native_with_synced_cost).toEqual({
      saleId: "ANNUL-FIX-C-F7-001",
      quoteId: "ANNUL-FIX-Q-F7-001",
    });

    expect(seeded.F8_quotation_self_block).toEqual({
      quoteId: "ANNUL-FIX-Q-F8-001",
      logId: "ANNUL-FIX-LOG-F8-001",
    });
    expect(seeded.F9_quotation_self_no_prod).toEqual({
      quoteId: "ANNUL-FIX-Q-F9-001",
      stockSku: "COB030ROJO",
    });
    expect(seeded.stockBaseline).toEqual({
      sku: "COB030ROJO",
      quantity: 100,
      avgCost: 7.86,
      totalValue: 786,
    });

    // 15 sales: F1=2, F2=2, F3=2, F4=2, F5=2, F6=1, F7=2, F8=1, F9=1.
    // 4 production_logs: F3, F4, F5, F8.
    // El doc de stock lleva el mismo flag pero vive en metallic_roofing_stock,
    // otra coleccion — no entra en ninguno de estos dos conteos.
    expect(await countFixtureDocs(db, "sales")).toBe(15);
    expect(await countFixtureDocs(db, "production_logs")).toBe(4);
  });

  it("segundo run con clean:true (default) borra los fixtures previos y no acumula (sigue en 15+4)", async () => {
    await seedAnnulFixtures(db);
    await seedAnnulFixtures(db);

    expect(await countFixtureDocs(db, "sales")).toBe(15);
    expect(await countFixtureDocs(db, "production_logs")).toBe(4);
  });

  it("clean:false no borra fixtures previos ajenos (IDs propios se sobreescriben por ser deterministicos, no se duplican)", async () => {
    await seedAnnulFixtures(db); // baseline limpio: 15+4

    // Doc ajeno con el mismo flag, ID fuera del set de IDs deterministicos del seeder.
    await db.collection("sales").doc("ANNUL-FIX-EXTRA-001").set({
      status: "COMPLETED",
      customerName: "EXTRA AJENO",
      metadata: { isAnnulFixture: true, fixtureId: "EXTRA" },
    });

    await seedAnnulFixtures(db, { clean: false });

    // El extra sobrevive (clean:false no borró nada); los 15 de siempre se sobreescriben
    // por tener el mismo ID, no se duplican -> total 16, no 31.
    expect(await countFixtureDocs(db, "sales")).toBe(16);
    const extraSnap = await db.collection("sales").doc("ANNUL-FIX-EXTRA-001").get();
    expect(extraSnap.exists).toBe(true);
  });

  it("F1: quote.convertedToId apunta al sale id de F1", async () => {
    const seeded = await seedAnnulFixtures(db);
    const quoteSnap = await db.collection("sales").doc(seeded.F1_native_happy.quoteId).get();
    expect(quoteSnap.data()?.convertedToId).toBe(seeded.F1_native_happy.saleId);
  });

  it("F2: percha.relatedSaleId es el documentNumber (string), sale.relatedQuotationId es el doc-id de la percha", async () => {
    const seeded = await seedAnnulFixtures(db);
    const perchaSnap = await db.collection("sales").doc(seeded.F2_imported_happy.perchaId).get();
    const saleSnap = await db.collection("sales").doc(seeded.F2_imported_happy.saleId).get();

    expect(perchaSnap.data()?.relatedSaleId).toBe("F2-001");
    expect(saleSnap.data()?.relatedQuotationId).toBe(seeded.F2_imported_happy.perchaId);
  });

  it("F3: production_log.source.id apunta al quote id de F3, status ACTIVE", async () => {
    const seeded = await seedAnnulFixtures(db);
    const logSnap = await db.collection("production_logs").doc(seeded.F3_native_block.logId).get();

    expect(logSnap.data()?.status).toBe("ACTIVE");
    expect(logSnap.data()?.source?.id).toBe(seeded.F3_native_block.quoteId);
  });

  it("F5: production_log.status es VOIDED (no bloquea annulSale)", async () => {
    const seeded = await seedAnnulFixtures(db);
    const logSnap = await db.collection("production_logs").doc(seeded.F5_native_ex_active.logId).get();
    expect(logSnap.data()?.status).toBe("VOIDED");
  });

  it("F6: sale no tiene originQuoteId ni relatedQuotationId (orphan)", async () => {
    const seeded = await seedAnnulFixtures(db);
    const saleSnap = await db.collection("sales").doc(seeded.F6_orphan.saleId).get();

    expect(saleSnap.data()?.originQuoteId).toBeUndefined();
    expect(saleSnap.data()?.relatedQuotationId).toBeUndefined();
  });

  it("F8: cotizacion NATIVA en QUOTATION (mode self) con log ACTIVE sobre SI MISMA", async () => {
    const seeded = await seedAnnulFixtures(db);
    const quoteSnap = await db.collection("sales").doc(seeded.F8_quotation_self_block.quoteId).get();
    const logSnap = await db.collection("production_logs").doc(seeded.F8_quotation_self_block.logId).get();

    expect(quoteSnap.data()?.status).toBe("QUOTATION");
    // NATIVA: sin las 2 marcas de importada (isImportedQuotation las mira a ambas).
    expect(quoteSnap.data()?.relatedSaleId).toBeUndefined();
    expect(quoteSnap.data()?.metadata?.isQuotation).toBeUndefined();

    expect(logSnap.data()?.status).toBe("ACTIVE");
    // El log cuelga de la PROPIA cotizacion, no de una venta gemela.
    expect(logSnap.data()?.source?.id).toBe(seeded.F8_quotation_self_block.quoteId);
    expect(logSnap.data()?.source?.type).toBe("QUOTE");
  });

  it("F9: cotizacion NATIVA en QUOTATION sin ningun production_log", async () => {
    const seeded = await seedAnnulFixtures(db);
    const quoteSnap = await db.collection("sales").doc(seeded.F9_quotation_self_no_prod.quoteId).get();

    expect(quoteSnap.data()?.status).toBe("QUOTATION");
    expect(quoteSnap.data()?.relatedSaleId).toBeUndefined();

    const logs = await db
      .collection("production_logs")
      .where("source.id", "==", seeded.F9_quotation_self_no_prod.quoteId)
      .get();
    expect(logs.size).toBe(0);
  });

  it("stock baseline: el seeder deja metallic_roofing_stock en el numero declarado", async () => {
    const seeded = await seedAnnulFixtures(db);
    const stockSnap = await db.collection("metallic_roofing_stock").doc(seeded.stockBaseline.sku).get();

    expect(stockSnap.exists).toBe(true);
    expect(stockSnap.data()?.quantity).toBe(seeded.stockBaseline.quantity);
    expect(stockSnap.data()?.avgCost).toBe(seeded.stockBaseline.avgCost);
    expect(stockSnap.data()?.totalValue).toBe(seeded.stockBaseline.totalValue);
  });

  it("stock baseline: un seed posterior PISA el doc aunque un test lo haya movido", async () => {
    const seeded = await seedAnnulFixtures(db);
    const ref = db.collection("metallic_roofing_stock").doc(seeded.stockBaseline.sku);

    await ref.update({ quantity: 999 });
    expect((await ref.get()).data()?.quantity).toBe(999);

    await seedAnnulFixtures(db);
    expect((await ref.get()).data()?.quantity).toBe(seeded.stockBaseline.quantity);
  });

  it("F7: sale.costSyncedAt existe y totalCost difiere del de la quote original (D3, costo sincronizado)", async () => {
    const seeded = await seedAnnulFixtures(db);
    const quoteSnap = await db.collection("sales").doc(seeded.F7_native_with_synced_cost.quoteId).get();
    const saleSnap = await db.collection("sales").doc(seeded.F7_native_with_synced_cost.saleId).get();

    expect(saleSnap.data()?.costSyncedAt).toBeDefined();
    expect(saleSnap.data()?.totalCost).not.toBe(quoteSnap.data()?.totalCost);
  });
});
