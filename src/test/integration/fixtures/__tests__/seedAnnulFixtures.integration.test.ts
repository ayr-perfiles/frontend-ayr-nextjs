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

  it("primer run crea las 7 fixtures con los IDs esperados + counts correctos (13 sales + 3 production_logs)", async () => {
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

    // 13 sales: F1=2, F2=2, F3=2, F4=2, F5=2, F6=1, F7=2. 3 production_logs: F3, F4, F5.
    // (Corrección aritmética señalada en el reporte previo: el desglose original sumaba
    // 13, no 12 — el conteo real acá lo confirma.)
    expect(await countFixtureDocs(db, "sales")).toBe(13);
    expect(await countFixtureDocs(db, "production_logs")).toBe(3);
  });

  it("segundo run con clean:true (default) borra los fixtures previos y no acumula (sigue en 13+3)", async () => {
    await seedAnnulFixtures(db);
    await seedAnnulFixtures(db);

    expect(await countFixtureDocs(db, "sales")).toBe(13);
    expect(await countFixtureDocs(db, "production_logs")).toBe(3);
  });

  it("clean:false no borra fixtures previos ajenos (IDs propios se sobreescriben por ser deterministicos, no se duplican)", async () => {
    await seedAnnulFixtures(db); // baseline limpio: 13+3

    // Doc ajeno con el mismo flag, ID fuera del set de 16 IDs deterministicos del seeder.
    await db.collection("sales").doc("ANNUL-FIX-EXTRA-001").set({
      status: "COMPLETED",
      customerName: "EXTRA AJENO",
      metadata: { isAnnulFixture: true, fixtureId: "EXTRA" },
    });

    await seedAnnulFixtures(db, { clean: false });

    // El extra sobrevive (clean:false no borró nada); los 13 de siempre se sobreescriben
    // por tener el mismo ID, no se duplican -> total 14, no 30.
    expect(await countFixtureDocs(db, "sales")).toBe(14);
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

  it("F7: sale.costSyncedAt existe y totalCost difiere del de la quote original (D3, costo sincronizado)", async () => {
    const seeded = await seedAnnulFixtures(db);
    const quoteSnap = await db.collection("sales").doc(seeded.F7_native_with_synced_cost.quoteId).get();
    const saleSnap = await db.collection("sales").doc(seeded.F7_native_with_synced_cost.saleId).get();

    expect(saleSnap.data()?.costSyncedAt).toBeDefined();
    expect(saleSnap.data()?.totalCost).not.toBe(quoteSnap.data()?.totalCost);
  });
});
