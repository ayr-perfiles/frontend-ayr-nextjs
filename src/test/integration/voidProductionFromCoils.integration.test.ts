import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import * as admin from '../../../functions/node_modules/firebase-admin';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { clearFirestore } from './firestore-helpers';
import { voidProductionFromCoils } from '../../../functions/src/callables/production';

describe('voidProductionFromCoils — Anulación de Aluzinc (Integration)', () => {
  beforeAll(async () => {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: TEST_PROJECT_ID });
    }
  });

  beforeEach(async () => {
    await clearFirestore(TEST_PROJECT_ID);
  });

  const getAdminAuth = () => ({ token: { role: "ADMIN", email: "admin@test.com" }, uid: "admin_uid" });

  interface CoilSeed {
    id: string;
    initialWeight: number;
    currentWeight: number;
    pricePerKg: number;
  }

  interface BreakdownSeed {
    coilId: string;
    mlFromCoil: number;
    weightConsumedKg: number;
    costPEN: number;
  }

  async function seedScenario(adminDb: admin.firestore.Firestore, opts: {
    logId: string;
    sku: string;
    coils: CoilSeed[];
    breakdown: BreakdownSeed[];
    piecesProduced: number;
    stockQuantity: number;
    stockTotalValue: number;
    logStatus?: string;
    logLine?: string;
    logTimestampMs?: number;
    perCoilBreakdownOverride?: any;
  }) {
    const {
      logId, sku, coils, breakdown, piecesProduced, stockQuantity, stockTotalValue,
      logStatus = "ACTIVE",
      logLine = "metallic-roofing",
      logTimestampMs = Date.now(),
      perCoilBreakdownOverride,
    } = opts;

    for (const c of coils) {
      await adminDb.collection("coils").doc(c.id).set({
        id: c.id,
        status: "IN_PROGRESS",
        initialWeight: c.initialWeight,
        currentWeight: c.currentWeight,
        masterWidth: 1200,
        thickness: 0.45,
        finish: "ALUZINC",
        pricePerKg: c.pricePerKg,
      });
    }

    const costoTotal = breakdown.reduce((acc, b) => acc + b.costPEN, 0);
    const costPerPiece = piecesProduced > 0 ? costoTotal / piecesProduced : 0;

    await adminDb.collection("production_logs").doc(logId).set({
      sku,
      line: logLine,
      parentCoilIds: coils.map((c) => c.id),
      parentCoilId: coils[0]?.id,
      piecesProduced,
      costPerPiece,
      perCoilBreakdown: perCoilBreakdownOverride !== undefined ? perCoilBreakdownOverride : breakdown,
      status: logStatus,
      timestamp: admin.firestore.Timestamp.fromMillis(logTimestampMs),
    });

    const avgCost = stockQuantity > 0 ? stockTotalValue / stockQuantity : 0;
    await adminDb.collection("metallic_roofing_stock").doc(sku).set({
      sku,
      quantity: stockQuantity,
      totalValue: stockTotalValue,
      avgCost,
    });
  }

  it('1. HAPPY COBERTURA_ML multi-bobina: restaura peso, kardex IN a costo congelado, stock, SALIDA, audit', async () => {
    const adminDb = admin.firestore();
    await seedScenario(adminDb, {
      logId: "PROD-1",
      sku: "COB-ALU-1",
      coils: [
        { id: "BOB-A", initialWeight: 1000, currentWeight: 700, pricePerKg: 5.0 }, // pricePerKg actual DISTINTO del congelado
        { id: "BOB-B", initialWeight: 800, currentWeight: 600, pricePerKg: 5.0 },
      ],
      breakdown: [
        { coilId: "BOB-A", mlFromCoil: 300, weightConsumedKg: 300, costPEN: 1050 }, // 3.5/kg congelado
        { coilId: "BOB-B", mlFromCoil: 200, weightConsumedKg: 200, costPEN: 840 },  // 4.2/kg congelado
      ],
      piecesProduced: 500,
      stockQuantity: 500,
      stockTotalValue: 1890,
    });

    const result = await voidProductionFromCoils.run({ data: { logId: "PROD-1" }, auth: getAdminAuth() } as any);
    expect(result.success).toBe(true);

    const log = (await adminDb.collection("production_logs").doc("PROD-1").get()).data()!;
    expect(log.status).toBe("VOIDED");
    expect(log.voidedBy).toBe("admin@test.com");

    const coilA = (await adminDb.collection("coils").doc("BOB-A").get()).data()!;
    expect(coilA.currentWeight).toBe(1000);
    expect(coilA.status).toBe("AVAILABLE");

    const coilB = (await adminDb.collection("coils").doc("BOB-B").get()).data()!;
    expect(coilB.currentWeight).toBe(800);
    expect(coilB.status).toBe("AVAILABLE");

    const kardexDocs = (await adminDb.collection("kardex_movements").get()).docs;
    expect(kardexDocs.length).toBe(2);

    const kardexA = kardexDocs.find((d) => d.data().sku === "BOB-A")!;
    expect(kardexA.data()).toMatchObject({
      type: "IN",
      weightKg: 300,
      costPerKg: 3.5, // congelado (1050/300), NO pricePerKg actual (5.0)
      balance: 1000,
      reference: "PROD-1",
    });

    const kardexB = kardexDocs.find((d) => d.data().sku === "BOB-B")!;
    expect(kardexB.data()).toMatchObject({
      type: "IN",
      weightKg: 200,
      costPerKg: 4.2, // congelado (840/200)
      balance: 800,
      reference: "PROD-1",
    });

    const stock = (await adminDb.collection("metallic_roofing_stock").doc("COB-ALU-1").get()).data()!;
    expect(stock.quantity).toBe(0);
    expect(stock.totalValue).toBe(0);
    expect(stock.avgCost).toBe(0);

    const movements = (await adminDb.collection("metallic_roofing_stock_movements").get()).docs;
    expect(movements.length).toBe(1);
    expect(movements[0].data()).toMatchObject({
      sku: "COB-ALU-1",
      type: "SALIDA",
      quantity: 500,
    });

    const auditDocs = (await adminDb.collection("audit_logs").get()).docs;
    const audit = auditDocs.find((d) => d.data().action === "VOID_PRODUCTION_FROM_COILS");
    expect(audit).toBeDefined();
    expect(audit!.data().entityId).toBe("PROD-1");
  });

  it('2. HAPPY PLANCHA_UND: 1 bobina, restaura peso y stock UND (mismo camino de código, sin branching por productKind)', async () => {
    const adminDb = admin.firestore();
    await seedScenario(adminDb, {
      logId: "PROD-2",
      sku: "PL-ALU-6MT",
      coils: [{ id: "BOB-C", initialWeight: 1200, currentWeight: 1000, pricePerKg: 4.0 }],
      breakdown: [{ coilId: "BOB-C", mlFromCoil: 600, weightConsumedKg: 200, costPEN: 700 }],
      piecesProduced: 100, // UND
      stockQuantity: 100,
      stockTotalValue: 700,
    });

    const result = await voidProductionFromCoils.run({ data: { logId: "PROD-2" }, auth: getAdminAuth() } as any);
    expect(result.success).toBe(true);

    const coil = (await adminDb.collection("coils").doc("BOB-C").get()).data()!;
    expect(coil.currentWeight).toBe(1200);
    expect(coil.status).toBe("AVAILABLE");

    const stock = (await adminDb.collection("metallic_roofing_stock").doc("PL-ALU-6MT").get()).data()!;
    expect(stock.quantity).toBe(0);
    expect(stock.totalValue).toBe(0);

    const movements = (await adminDb.collection("metallic_roofing_stock_movements").get()).docs;
    expect(movements[0].data().quantity).toBe(100);
  });

  it('3. IDEMPOTENCIA: log ya VOIDED → failed-precondition, sin cambios', async () => {
    const adminDb = admin.firestore();
    await seedScenario(adminDb, {
      logId: "PROD-3",
      sku: "COB-ALU-3",
      coils: [{ id: "BOB-D", initialWeight: 1000, currentWeight: 700, pricePerKg: 3.5 }],
      breakdown: [{ coilId: "BOB-D", mlFromCoil: 300, weightConsumedKg: 300, costPEN: 1050 }],
      piecesProduced: 300,
      stockQuantity: 300,
      stockTotalValue: 1050,
      logStatus: "VOIDED",
    });

    await expect(
      voidProductionFromCoils.run({ data: { logId: "PROD-3" }, auth: getAdminAuth() } as any)
    ).rejects.toMatchObject({ code: "failed-precondition" });

    const coil = (await adminDb.collection("coils").doc("BOB-D").get()).data()!;
    expect(coil.currentWeight).toBe(700); // sin cambio
  });

  it('4. line != metallic-roofing → invalid-argument', async () => {
    const adminDb = admin.firestore();
    await seedScenario(adminDb, {
      logId: "PROD-4",
      sku: "SKU-DW-4",
      coils: [{ id: "BOB-E", initialWeight: 1000, currentWeight: 700, pricePerKg: 3.5 }],
      breakdown: [{ coilId: "BOB-E", mlFromCoil: 300, weightConsumedKg: 300, costPEN: 1050 }],
      piecesProduced: 300,
      stockQuantity: 300,
      stockTotalValue: 1050,
      logLine: "drywall",
    });

    await expect(
      voidProductionFromCoils.run({ data: { logId: "PROD-4" }, auth: getAdminAuth() } as any)
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it('5. perCoilBreakdown vacío → failed-precondition', async () => {
    const adminDb = admin.firestore();
    await seedScenario(adminDb, {
      logId: "PROD-5",
      sku: "COB-ALU-5",
      coils: [{ id: "BOB-F", initialWeight: 1000, currentWeight: 700, pricePerKg: 3.5 }],
      breakdown: [{ coilId: "BOB-F", mlFromCoil: 300, weightConsumedKg: 300, costPEN: 1050 }],
      piecesProduced: 300,
      stockQuantity: 300,
      stockTotalValue: 1050,
      perCoilBreakdownOverride: [],
    });

    await expect(
      voidProductionFromCoils.run({ data: { logId: "PROD-5" }, auth: getAdminAuth() } as any)
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it('6. GUARD POSTERIOR: venta COMPLETED del PT posterior a la producción → failed-precondition, sin cambios', async () => {
    const adminDb = admin.firestore();
    const logTimestampMs = Date.now();

    await seedScenario(adminDb, {
      logId: "PROD-6",
      sku: "COB-ALU-6",
      coils: [{ id: "BOB-G", initialWeight: 1000, currentWeight: 700, pricePerKg: 3.5 }],
      breakdown: [{ coilId: "BOB-G", mlFromCoil: 300, weightConsumedKg: 300, costPEN: 1050 }],
      piecesProduced: 300,
      stockQuantity: 300,
      stockTotalValue: 1050,
      logTimestampMs,
    });

    // Venta posterior (timestamp > log.timestamp) que consumió el PT
    await adminDb.collection("sales").doc("SALE-1").set({
      customerName: "Cliente Test",
      items: [{ sku: "COB-ALU-6", quantity: 100, unitPrice: 10, unitValue: 8, baseCost: 3.5, unitWeight: 1 }],
      skus: ["COB-ALU-6"],
      businessLines: ["metallic-roofing"],
      totalAmount: 1000,
      totalCost: 350,
      status: "COMPLETED",
      sellerId: "seller1",
      timestamp: admin.firestore.Timestamp.fromMillis(logTimestampMs + 60_000),
    });

    await expect(
      voidProductionFromCoils.run({ data: { logId: "PROD-6" }, auth: getAdminAuth() } as any)
    ).rejects.toMatchObject({ code: "failed-precondition" });

    const coil = (await adminDb.collection("coils").doc("BOB-G").get()).data()!;
    expect(coil.currentWeight).toBe(700); // sin cambio

    const log = (await adminDb.collection("production_logs").doc("PROD-6").get()).data()!;
    expect(log.status).toBe("ACTIVE"); // sin cambio
  });

  it('7. AUTH: caller SUPERVISOR → permission-denied, sin cambios', async () => {
    const adminDb = admin.firestore();
    await seedScenario(adminDb, {
      logId: "PROD-7",
      sku: "COB-ALU-7",
      coils: [{ id: "BOB-H", initialWeight: 1000, currentWeight: 700, pricePerKg: 3.5 }],
      breakdown: [{ coilId: "BOB-H", mlFromCoil: 300, weightConsumedKg: 300, costPEN: 1050 }],
      piecesProduced: 300,
      stockQuantity: 300,
      stockTotalValue: 1050,
    });

    await expect(
      voidProductionFromCoils.run({
        data: { logId: "PROD-7" },
        auth: { token: { role: "SUPERVISOR", email: "sup@test.com" }, uid: "sup" },
      } as any)
    ).rejects.toMatchObject({ code: "permission-denied" });

    const coil = (await adminDb.collection("coils").doc("BOB-H").get()).data()!;
    expect(coil.currentWeight).toBe(700); // sin cambio
  });
});
