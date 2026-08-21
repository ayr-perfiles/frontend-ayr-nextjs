import { describe, it, expect, beforeEach, afterAll } from "vitest";
import * as admin from "firebase-admin";
import { editQuotation } from "../editQuotation";
import fft from "firebase-functions-test";
// Cross-boundary permitido: este es un .test.ts (excluido del build de functions/),
// mismo patrón que annulSale.integration.test.ts.
import { seedEditFixtures, type SeededEditFixtures } from "../../../../src/test/integration/fixtures/seedEditFixtures";

const testEnv = fft({ projectId: "demo-ayrsteel-test" });
if (!admin.apps.length) {
  admin.initializeApp({ projectId: "demo-ayrsteel-test" });
}
// onCall v2: wrapV2 espera UN solo objeto {data, auth}, no el (data, context) de v1.
const wrapped = testEnv.wrap(editQuotation) as (req: { data: unknown; auth?: unknown }) => Promise<any>;

const adminAuth = { uid: "admin-uid", token: { role: "ADMIN", email: "editor@fixture.com" } };
const supervisorAuth = { uid: "sup-uid", token: { role: "SUPERVISOR", email: "sup@fixture.com" } };
const operatorAuth = { uid: "op-uid", token: { role: "OPERATOR", email: "op@fixture.com" } };

describe("editQuotation (callable)", () => {
  const db = admin.firestore();
  let seeded: SeededEditFixtures;

  /** Ítem "nuevo" que manda el form: baseCost del cliente deliberadamente distinto del WAC. */
  const itemNuevo = (sku: string, overrides: Record<string, unknown> = {}) => ({
    sku,
    productName: "ITEM EDITADO",
    quantity: 4,
    unitPrice: 118,
    unitValue: 100,
    baseCost: 20, // el cliente manda 20; el WAC positivo es 9.5
    businessLine: "metallic-roofing",
    unitWeight: 2,
    isCoil: false,
    ...overrides,
  });

  function editAsAdmin(quotationId: string, data: Record<string, unknown> = {}) {
    return wrapped({
      data: {
        quotationId,
        items: [itemNuevo(seeded.stock.skuWacPositive)],
        customerName: "CLIENTE EDITADO",
        ...data,
      },
      auth: adminAuth,
    });
  }

  beforeEach(async () => {
    seeded = await seedEditFixtures(db);
  });

  afterAll(() => {
    testEnv.cleanup();
  });

  // ───────────────────────────── HAPPY PATH ─────────────────────────────

  it("E1 happy: edita la cotización nativa — items nuevos y totales recalculados por el builder", async () => {
    const res = await editAsAdmin(seeded.E1_native_editable.quotationId);
    expect(res).toMatchObject({ success: true });

    const snap = await db.collection("sales").doc(seeded.E1_native_editable.quotationId).get();
    const d = snap.data()!;

    expect(d.items).toHaveLength(1);
    expect(d.items[0].sku).toBe(seeded.stock.skuWacPositive);
    expect(d.items[0].productName).toBe("ITEM EDITADO");
    expect(d.items[0].quantity).toBe(4);
    expect(d.customerName).toBe("CLIENTE EDITADO");

    // Totales por la fórmula del builder (Q5): totalAmount = unitPrice*qty = 118*4
    expect(d.totalAmount).toBeCloseTo(472, 6);
    // baseCost recomputado al WAC (9.5) -> totalCost = 9.5*4
    expect(d.totalCost).toBeCloseTo(38, 6);
    // profit por ítem sobre unitValue: (100 - 9.5) * 4
    expect(d.totalProfit).toBeCloseTo(362, 6);
    // totalWeight = calculatedWeight = unitWeight*qty = 2*4
    expect(d.totalWeight).toBeCloseTo(8, 6);

    // Derivados
    expect(d.skus).toEqual([seeded.stock.skuWacPositive]);
    expect(d.businessLines).toEqual(["metallic-roofing"]);
  });

  it("E1 happy: timestamp PRESERVADO y updatedAt/updatedBy nuevos", async () => {
    await editAsAdmin(seeded.E1_native_editable.quotationId);

    const d = (await db.collection("sales").doc(seeded.E1_native_editable.quotationId).get()).data()!;
    expect(d.timestamp.toMillis()).toBe(seeded.E1_before.timestampMs);
    expect(d.updatedAt).toBeDefined();
    expect(d.updatedBy).toBe("editor@fixture.com");
  });

  // ───────────────────────── T2: nada de ciclo de vida se pisa ─────────────────────────

  it("T2: productionStatus / confirmedBy / confirmedForProductionAt / costSyncedAt / isFulfilled INTACTOS", async () => {
    await editAsAdmin(seeded.E1_native_editable.quotationId);

    const d = (await db.collection("sales").doc(seeded.E1_native_editable.quotationId).get()).data()!;
    expect(d.productionStatus).toBe(seeded.E1_before.productionStatus); // NO vuelve a PENDING
    expect(d.confirmedBy).toBe(seeded.E1_before.confirmedBy);
    expect(d.confirmedForProductionAt).toBeDefined();
    expect(d.costSyncedAt).toBeDefined();
    expect(d.isFulfilled).toBe(seeded.E1_before.isFulfilled);
  });

  it("T2: status / sellerId / paymentStatus PRESERVADOS (el builder los emitiría distintos)", async () => {
    await editAsAdmin(seeded.E1_native_editable.quotationId);

    const d = (await db.collection("sales").doc(seeded.E1_native_editable.quotationId).get()).data()!;
    expect(d.status).toBe("QUOTATION");                            // D13: in-place
    expect(d.sellerId).toBe(seeded.E1_before.sellerId);            // el creador, no el editor
    expect(d.paymentStatus).toBe(seeded.E1_before.paymentStatus);
  });

  // ───────────────────────── T1: totales del cliente ignorados ─────────────────────────

  it("T1: si el request trae totales, el callable los IGNORA (gana el builder)", async () => {
    await editAsAdmin(seeded.E1_native_editable.quotationId, {
      totalAmount: 999999,
      totalCost: 888888,
      totalProfit: 777777,
      totalWeight: 666666,
    });

    const d = (await db.collection("sales").doc(seeded.E1_native_editable.quotationId).get()).data()!;
    expect(d.totalAmount).toBeCloseTo(472, 6);
    expect(d.totalCost).toBeCloseTo(38, 6);
    expect(d.totalProfit).toBeCloseTo(362, 6);
    expect(d.totalWeight).toBeCloseTo(8, 6);
  });

  // ───────────────────────── Q2(b): recompute de baseCost ─────────────────────────

  it("Q2(b): SKU con WAC > 0 -> baseCost recomputado al WAC, ignorando el del cliente", async () => {
    await editAsAdmin(seeded.E1_native_editable.quotationId);

    const d = (await db.collection("sales").doc(seeded.E1_native_editable.quotationId).get()).data()!;
    expect(d.items[0].baseCost).toBeCloseTo(seeded.stock.wacPositive, 6); // 9.5, no 20
  });

  it("Q2(b): SKU con WAC == 0 -> PRESERVA el baseCost del ítem (no lo pone en 0)", async () => {
    await editAsAdmin(seeded.E1_native_editable.quotationId, {
      items: [itemNuevo(seeded.stock.skuWacZero, { baseCost: 17 })],
    });

    const d = (await db.collection("sales").doc(seeded.E1_native_editable.quotationId).get()).data()!;
    expect(d.items[0].baseCost).toBeCloseTo(17, 6);
    // Y por lo tanto NO lleva la flag 'sin costo'
    expect(d.items[0].flags).not.toContain("sin costo");
  });

  it("Q2(b) H1: ítem isCoil -> NUNCA se recomputa, preserva su baseCost (pricePerKg)", async () => {
    await editAsAdmin(seeded.E1_native_editable.quotationId, {
      items: [
        itemNuevo(seeded.stock.skuCoil, { baseCost: 3.7, isCoil: true, businessLine: "drywall", quantity: 1000 }),
      ],
    });

    const d = (await db.collection("sales").doc(seeded.E1_native_editable.quotationId).get()).data()!;
    expect(d.items[0].baseCost).toBeCloseTo(3.7, 6);
  });

  it("Q2(b) H2: businessLine no reconocida -> preserva, NO lanza", async () => {
    const res = await editAsAdmin(seeded.E1_native_editable.quotationId, {
      items: [itemNuevo("SKU-SIN-LINEA", { baseCost: 11, businessLine: "" })],
    });
    expect(res).toMatchObject({ success: true });

    const d = (await db.collection("sales").doc(seeded.E1_native_editable.quotationId).get()).data()!;
    expect(d.items[0].baseCost).toBeCloseTo(11, 6);
  });

  it("Q2(b): ítem de services -> WAC siempre 0, preserva baseCost y NO lleva flag 'sin costo'", async () => {
    await editAsAdmin(seeded.E1_native_editable.quotationId, {
      items: [itemNuevo(seeded.stock.skuServices, { baseCost: 0, businessLine: "services" })],
    });

    const d = (await db.collection("sales").doc(seeded.E1_native_editable.quotationId).get()).data()!;
    expect(d.items[0].baseCost).toBe(0);
    expect(d.items[0].flags).not.toContain("sin costo");
  });

  // ───────────────────────────── GUARDS ─────────────────────────────

  it("Guard producción (D4/D10): nativa con log ACTIVE -> failed-precondition, doc SIN cambios", async () => {
    await expect(editAsAdmin(seeded.E2_native_blocked.quotationId)).rejects.toMatchObject({
      code: "failed-precondition",
      message: expect.stringContaining("producci"),
      details: {
        quotationId: seeded.E2_native_blocked.quotationId,
        activeLogIds: [seeded.E2_native_blocked.logId],
      },
    });

    const d = (await db.collection("sales").doc(seeded.E2_native_blocked.quotationId).get()).data()!;
    expect(d.customerName).toBe("CLIENTE BLOQUEADO");
    expect(d.items[0].productName).toBe("ITEM ORIGINAL");
    expect(d.updatedAt).toBeUndefined();
  });

  it("Guard origen (D1): percha IMPORTADA COT-* -> failed-precondition, doc SIN cambios", async () => {
    await expect(editAsAdmin(seeded.E3_imported.quotationId)).rejects.toMatchObject({
      code: "failed-precondition",
      message: expect.stringContaining("importada"),
    });

    const d = (await db.collection("sales").doc(seeded.E3_imported.quotationId).get()).data()!;
    expect(d.customerName).toBe("CLIENTE IMPORTADO");
    expect(d.updatedAt).toBeUndefined();
  });

  it("Guard status: doc COMPLETED -> failed-precondition", async () => {
    await expect(editAsAdmin(seeded.E4_completed.saleId)).rejects.toMatchObject({
      code: "failed-precondition",
    });

    const d = (await db.collection("sales").doc(seeded.E4_completed.saleId).get()).data()!;
    expect(d.status).toBe("COMPLETED");
    expect(d.updatedAt).toBeUndefined();
  });

  it("Guard not-found: quotationId inexistente", async () => {
    await expect(editAsAdmin("EDIT-FIX-NO-EXISTE")).rejects.toMatchObject({ code: "not-found" });
  });

  it("Guard rol: SUPERVISOR -> permission-denied (D-Q6: ADMIN-only, distinto de annulSale)", async () => {
    await expect(
      wrapped({
        data: { quotationId: seeded.E1_native_editable.quotationId, items: [itemNuevo(seeded.stock.skuWacPositive)] },
        auth: supervisorAuth,
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("Guard rol: OPERATOR -> permission-denied", async () => {
    await expect(
      wrapped({
        data: { quotationId: seeded.E1_native_editable.quotationId, items: [itemNuevo(seeded.stock.skuWacPositive)] },
        auth: operatorAuth,
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("Guard auth: sin auth -> unauthenticated", async () => {
    await expect(
      wrapped({ data: { quotationId: seeded.E1_native_editable.quotationId, items: [itemNuevo(seeded.stock.skuWacPositive)] } }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("Guard input: quotationId vacío -> invalid-argument", async () => {
    await expect(
      wrapped({ data: { quotationId: "  ", items: [itemNuevo(seeded.stock.skuWacPositive)] }, auth: adminAuth }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("Guard input: items vacío -> invalid-argument", async () => {
    await expect(
      wrapped({ data: { quotationId: seeded.E1_native_editable.quotationId, items: [] }, auth: adminAuth }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  // ───────────────────────────── D13: sin efectos de stock ─────────────────────────────

  it("D13: editar NO mueve el stock ni escribe movimientos", async () => {
    const stockRef = db.collection("metallic_roofing_stock").doc(seeded.stock.skuWacPositive);
    const qtyBefore = (await stockRef.get()).data()!.quantity;
    const movsBefore = (await db.collection("metallic_roofing_stock_movements").get()).size;

    await editAsAdmin(seeded.E1_native_editable.quotationId);

    expect((await stockRef.get()).data()!.quantity).toBe(qtyBefore);
    expect((await db.collection("metallic_roofing_stock_movements").get()).size).toBe(movsBefore);
  });

  it("Audit: se escribe un audit_log EDIT_QUOTATION", async () => {
    await editAsAdmin(seeded.E1_native_editable.quotationId);

    const logs = await db
      .collection("audit_logs")
      .where("action", "==", "EDIT_QUOTATION")
      .where("entityId", "==", seeded.E1_native_editable.quotationId)
      .get();
    expect(logs.size).toBeGreaterThanOrEqual(1);
    expect(logs.docs[0].data().userEmail).toBe("editor@fixture.com");
  });
});
