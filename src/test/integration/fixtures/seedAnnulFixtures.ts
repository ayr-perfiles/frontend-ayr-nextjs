import type { Firestore, WriteBatch } from "firebase-admin/firestore";

export interface SeedAnnulFixturesOptions {
  /** default true: borra fixtures previos (metadata.isAnnulFixture==true) antes de seedear. */
  clean?: boolean;
}

export interface SeededFixtures {
  F1_native_happy: { saleId: string; quoteId: string };
  F2_imported_happy: { saleId: string; perchaId: string };
  F3_native_block: { saleId: string; quoteId: string; logId: string };
  F4_imported_block: { saleId: string; perchaId: string; logId: string };
  F5_native_ex_active: { saleId: string; quoteId: string; logId: string };
  F6_orphan: { saleId: string };
  F7_native_with_synced_cost: { saleId: string; quoteId: string };
  /** Cotización NATIVA en QUOTATION (mode `self`) CON producción ACTIVE sobre sí misma. */
  F8_quotation_self_block: { quoteId: string; logId: string };
  /** Cotización NATIVA en QUOTATION (mode `self`) SIN producción — nunca descontó stock. */
  F9_quotation_self_no_prod: { quoteId: string; stockSku: string };
  /** SKU + baseline del doc de stock que siembra el seeder (para asserts de stock). */
  stockBaseline: { sku: string; quantity: number; avgCost: number; totalValue: number };
}

const GENERIC_ITEM = {
  sku: "GENERIC",
  productName: "Fixture item",
  quantity: 1,
  unitPrice: 100,
  unitValue: 84.75,
  baseCost: 50,
  businessLine: "",
  profit: 34.75,
  flags: [],
  unitWeight: 0,
  calculatedWeight: 0,
  unitOfMeasure: "UND",
  isCoil: false,
};

const METALLIC_ITEM = {
  sku: "COB030ROJO",
  productName: "COBERTURA DE ALUZINC 0.30MM COLOR ROJO",
  quantity: 10,
  unitPrice: 11,
  unitValue: 9.32,
  baseCost: 7.86,
  businessLine: "metallic-roofing",
  profit: 14.6,
  flags: [],
  unitWeight: 0,
  calculatedWeight: 0,
  unitOfMeasure: "METRO LINEAL",
  isCoil: false,
};

/** Baseline del doc de stock que el seeder siembra, para poder assertear deltas exactos. */
const STOCK_SKU = METALLIC_ITEM.sku;
const STOCK_BASELINE_QTY = 100;
const STOCK_BASELINE_AVG_COST = 7.86;
const STOCK_BASELINE_TOTAL_VALUE = 786;

async function deleteWhereFixtureFlag(db: Firestore, collectionName: string): Promise<void> {
  const snap = await db.collection(collectionName).where("metadata.isAnnulFixture", "==", true).get();
  if (snap.empty) return;

  let batch: WriteBatch = db.batch();
  let opsInBatch = 0;

  for (const docSnap of snap.docs) {
    batch.delete(docSnap.ref);
    opsInBatch += 1;
    if (opsInBatch === 450) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
  }
}

export async function seedAnnulFixtures(
  db: Firestore,
  options: SeedAnnulFixturesOptions = {},
): Promise<SeededFixtures> {
  const clean = options.clean !== false;

  if (clean) {
    await deleteWhereFixtureFlag(db, "sales");
    await deleteWhereFixtureFlag(db, "production_logs");
  }

  // Date nativo, no Timestamp.now(): este módulo se importa cross-boundary desde
  // functions/ (que tiene su PROPIA copia de firebase-admin en su node_modules) —
  // un Timestamp creado con la copia de la raíz no es `instanceof` el Timestamp
  // que la copia de functions/ espera al validar el write ("dual package hazard").
  // Date es una clase global, sin ese problema; el Admin SDK la autoconvierte igual.
  const now = new Date();
  const batch = db.batch();

  const fixtureMeta = (fixtureId: string) => ({ isAnnulFixture: true, fixtureId });

  // ── F1: native happy path (sin producción, annulSale debe poder revertir) ──
  const f1QuoteId = "ANNUL-FIX-Q-001";
  const f1SaleId = "ANNUL-FIX-C-001";
  batch.set(db.collection("sales").doc(f1QuoteId), {
    status: "CONVERTED",
    convertedToId: f1SaleId,
    customerName: "FIXTURE F1 CUSTOMER",
    documentNumber: "Q-001-F1",
    items: [GENERIC_ITEM],
    totalAmount: 100,
    totalCost: 50,
    sellerId: "FIXTURE",
    paymentStatus: "PAID",
    timestamp: now,
    metadata: fixtureMeta("F1"),
  });
  batch.set(db.collection("sales").doc(f1SaleId), {
    status: "COMPLETED",
    originQuoteId: f1QuoteId,
    approvedAt: now,
    customerName: "FIXTURE F1 CUSTOMER",
    documentNumber: "C-001-F1",
    items: [GENERIC_ITEM],
    totalAmount: 100,
    totalCost: 50,
    sellerId: "FIXTURE",
    paymentStatus: "PAID",
    timestamp: now,
    metadata: fixtureMeta("F1"),
  });

  // ── F2: imported happy path (percha COT-* sin producción activa) ──
  const f2PerchaId = "ANNUL-FIX-COT-F2-001";
  const f2SaleId = "ANNUL-FIX-S-F2-001";
  batch.set(db.collection("sales").doc(f2PerchaId), {
    status: "QUOTATION",
    productionStatus: "CONFIRMED",
    isFulfilled: true,
    relatedSaleId: "F2-001",
    customerName: "FIXTURE F2 CUSTOMER",
    documentNumber: "F2-001",
    items: [METALLIC_ITEM],
    businessLines: ["metallic-roofing"],
    skus: ["COB030ROJO"],
    totalAmount: 110,
    totalCost: 78.6,
    sellerId: "FIXTURE",
    paymentStatus: "PAID",
    timestamp: now,
    metadata: {
      ...fixtureMeta("F2"),
      isQuotation: true,
      isHistorical: true,
      documentType: "BOLETA",
      currency: "PEN",
      exchangeRate: 1,
    },
  });
  batch.set(db.collection("sales").doc(f2SaleId), {
    status: "COMPLETED",
    relatedQuotationId: f2PerchaId,
    customerName: "FIXTURE F2 CUSTOMER",
    documentNumber: "F2-001",
    items: [METALLIC_ITEM],
    businessLines: ["metallic-roofing"],
    skus: ["COB030ROJO"],
    totalAmount: 110,
    totalCost: 78.6,
    sellerId: "FIXTURE",
    paymentStatus: "PAID",
    timestamp: now,
    metadata: {
      ...fixtureMeta("F2"),
      isHistorical: true,
      documentType: "BOLETA",
      currency: "PEN",
      exchangeRate: 1,
    },
  });

  // ── F3: native block (producción ACTIVE sobre la quote vinculada) ──
  const f3QuoteId = "ANNUL-FIX-Q-F3-001";
  const f3SaleId = "ANNUL-FIX-C-F3-001";
  const f3LogId = "ANNUL-FIX-LOG-F3-001";
  batch.set(db.collection("sales").doc(f3QuoteId), {
    status: "CONVERTED",
    convertedToId: f3SaleId,
    customerName: "FIXTURE F3 CUSTOMER",
    documentNumber: "Q-F3-001",
    items: [METALLIC_ITEM],
    businessLines: ["metallic-roofing"],
    totalAmount: 110,
    totalCost: 78.6,
    sellerId: "FIXTURE",
    paymentStatus: "PAID",
    timestamp: now,
    metadata: fixtureMeta("F3"),
  });
  batch.set(db.collection("sales").doc(f3SaleId), {
    status: "COMPLETED",
    originQuoteId: f3QuoteId,
    approvedAt: now,
    customerName: "FIXTURE F3 CUSTOMER",
    documentNumber: "C-F3-001",
    items: [METALLIC_ITEM],
    businessLines: ["metallic-roofing"],
    totalAmount: 110,
    totalCost: 78.6,
    sellerId: "FIXTURE",
    paymentStatus: "PAID",
    timestamp: now,
    metadata: fixtureMeta("F3"),
  });
  batch.set(db.collection("production_logs").doc(f3LogId), {
    status: "ACTIVE",
    source: { type: "QUOTE", id: f3QuoteId, label: f3QuoteId },
    sku: "COB030ROJO",
    line: "metallic-roofing",
    mlProduced: 100,
    piecesProduced: 20,
    perCoilBreakdown: [],
    parentCoilIds: [],
    operatorId: "FIXTURE",
    timestamp: now,
    metadata: fixtureMeta("F3"),
  });

  // ── F4: imported block (producción ACTIVE sobre la percha vinculada) ──
  const f4PerchaId = "ANNUL-FIX-COT-F4-001";
  const f4SaleId = "ANNUL-FIX-S-F4-001";
  const f4LogId = "ANNUL-FIX-LOG-F4-001";
  batch.set(db.collection("sales").doc(f4PerchaId), {
    status: "QUOTATION",
    productionStatus: "CONFIRMED",
    isFulfilled: false,
    relatedSaleId: "F4-001",
    customerName: "FIXTURE F4 CUSTOMER",
    documentNumber: "F4-001",
    items: [METALLIC_ITEM],
    businessLines: ["metallic-roofing"],
    skus: ["COB030ROJO"],
    totalAmount: 110,
    totalCost: 78.6,
    sellerId: "FIXTURE",
    paymentStatus: "PAID",
    timestamp: now,
    metadata: {
      ...fixtureMeta("F4"),
      isQuotation: true,
      isHistorical: true,
      documentType: "BOLETA",
      currency: "PEN",
      exchangeRate: 1,
    },
  });
  batch.set(db.collection("sales").doc(f4SaleId), {
    status: "COMPLETED",
    relatedQuotationId: f4PerchaId,
    customerName: "FIXTURE F4 CUSTOMER",
    documentNumber: "F4-001",
    items: [METALLIC_ITEM],
    businessLines: ["metallic-roofing"],
    skus: ["COB030ROJO"],
    totalAmount: 110,
    totalCost: 78.6,
    sellerId: "FIXTURE",
    paymentStatus: "PAID",
    timestamp: now,
    metadata: {
      ...fixtureMeta("F4"),
      isHistorical: true,
      documentType: "BOLETA",
      currency: "PEN",
      exchangeRate: 1,
    },
  });
  batch.set(db.collection("production_logs").doc(f4LogId), {
    status: "ACTIVE",
    source: { type: "QUOTE", id: f4PerchaId, label: f4PerchaId },
    sku: "COB030ROJO",
    line: "metallic-roofing",
    mlProduced: 100,
    piecesProduced: 20,
    perCoilBreakdown: [],
    parentCoilIds: [],
    operatorId: "FIXTURE",
    timestamp: now,
    metadata: fixtureMeta("F4"),
  });

  // ── F5: native ex-active (producción VOIDED, no bloquea) ──
  const f5QuoteId = "ANNUL-FIX-Q-F5-001";
  const f5SaleId = "ANNUL-FIX-C-F5-001";
  const f5LogId = "ANNUL-FIX-LOG-F5-001";
  batch.set(db.collection("sales").doc(f5QuoteId), {
    status: "CONVERTED",
    convertedToId: f5SaleId,
    customerName: "FIXTURE F5 CUSTOMER",
    documentNumber: "Q-F5-001",
    items: [METALLIC_ITEM],
    businessLines: ["metallic-roofing"],
    totalAmount: 110,
    totalCost: 78.6,
    sellerId: "FIXTURE",
    paymentStatus: "PAID",
    timestamp: now,
    metadata: fixtureMeta("F5"),
  });
  batch.set(db.collection("sales").doc(f5SaleId), {
    status: "COMPLETED",
    originQuoteId: f5QuoteId,
    approvedAt: now,
    customerName: "FIXTURE F5 CUSTOMER",
    documentNumber: "C-F5-001",
    items: [METALLIC_ITEM],
    businessLines: ["metallic-roofing"],
    totalAmount: 110,
    totalCost: 78.6,
    sellerId: "FIXTURE",
    paymentStatus: "PAID",
    timestamp: now,
    metadata: fixtureMeta("F5"),
  });
  batch.set(db.collection("production_logs").doc(f5LogId), {
    status: "VOIDED",
    source: { type: "QUOTE", id: f5QuoteId, label: f5QuoteId },
    sku: "COB030ROJO",
    line: "metallic-roofing",
    mlProduced: 100,
    piecesProduced: 20,
    perCoilBreakdown: [],
    parentCoilIds: [],
    operatorId: "FIXTURE",
    timestamp: now,
    metadata: fixtureMeta("F5"),
  });

  // ── F6: orphan (venta sin link a ninguna cotización) ──
  const f6SaleId = "ANNUL-FIX-S-F6-001";
  batch.set(db.collection("sales").doc(f6SaleId), {
    status: "COMPLETED",
    customerName: "FIXTURE F6 CUSTOMER",
    documentNumber: "F6-001",
    items: [GENERIC_ITEM],
    totalAmount: 100,
    totalCost: 50,
    sellerId: "FIXTURE",
    paymentStatus: "PAID",
    timestamp: now,
    metadata: fixtureMeta("F6"),
  });

  // ── F7: native con costo sincronizado (A1 write-back, D3) ──
  const f7QuoteId = "ANNUL-FIX-Q-F7-001";
  const f7SaleId = "ANNUL-FIX-C-F7-001";
  batch.set(db.collection("sales").doc(f7QuoteId), {
    status: "CONVERTED",
    convertedToId: f7SaleId,
    isFulfilled: true,
    customerName: "FIXTURE F7 CUSTOMER",
    documentNumber: "Q-F7-001",
    items: [METALLIC_ITEM],
    businessLines: ["metallic-roofing"],
    totalAmount: 110,
    totalCost: 78.6,
    sellerId: "FIXTURE",
    paymentStatus: "PAID",
    timestamp: now,
    metadata: fixtureMeta("F7"),
  });
  batch.set(db.collection("sales").doc(f7SaleId), {
    status: "COMPLETED",
    originQuoteId: f7QuoteId,
    approvedAt: now,
    costSyncedAt: now,
    customerName: "FIXTURE F7 CUSTOMER",
    documentNumber: "C-F7-001",
    // baseCost/totalCost distintos del original (78.6) — simula el write-back de A1
    // (applyCostCascade pisa el costo con el real de producción, quoteFulfillment.ts).
    items: [{ ...METALLIC_ITEM, baseCost: 6.4, profit: 26 }],
    businessLines: ["metallic-roofing"],
    totalAmount: 110,
    totalCost: 64,
    sellerId: "FIXTURE",
    paymentStatus: "PAID",
    timestamp: now,
    metadata: fixtureMeta("F7"),
  });

  // ── F8: cotización NATIVA en QUOTATION (mode `self`) CON producción ACTIVE ──
  // El log cuelga de la PROPIA cotización (source.id == su doc.id), que es como
  // `produceFromCoils` graba la producción contra una cotización.
  const f8QuoteId = "ANNUL-FIX-Q-F8-001";
  const f8LogId = "ANNUL-FIX-LOG-F8-001";
  batch.set(db.collection("sales").doc(f8QuoteId), {
    status: "QUOTATION",
    productionStatus: "CONFIRMED",
    isFulfilled: false,
    // NATIVA: sin relatedSaleId y sin metadata.isQuotation.
    customerName: "FIXTURE F8 CUSTOMER",
    documentNumber: "",
    items: [METALLIC_ITEM],
    businessLines: ["metallic-roofing"],
    skus: ["COB030ROJO"],
    totalAmount: 110,
    totalCost: 78.6,
    sellerId: "FIXTURE",
    paymentStatus: "PAID",
    timestamp: now,
    metadata: fixtureMeta("F8"),
  });
  batch.set(db.collection("production_logs").doc(f8LogId), {
    status: "ACTIVE",
    source: { type: "QUOTE", id: f8QuoteId, label: f8QuoteId },
    sku: "COB030ROJO",
    line: "metallic-roofing",
    mlProduced: 100,
    piecesProduced: 20,
    perCoilBreakdown: [],
    parentCoilIds: [],
    operatorId: "FIXTURE",
    timestamp: now,
    metadata: fixtureMeta("F8"),
  });

  // ── F9: cotización NATIVA en QUOTATION (mode `self`) SIN producción ──
  // Una cotización NUNCA descuenta stock al crearse (createQuotation no llama a
  // ninguna strategy) — así que anularla no debe devolver nada al stock.
  const f9QuoteId = "ANNUL-FIX-Q-F9-001";
  batch.set(db.collection("sales").doc(f9QuoteId), {
    status: "QUOTATION",
    productionStatus: "PENDING",
    isFulfilled: false,
    customerName: "FIXTURE F9 CUSTOMER",
    documentNumber: "",
    items: [METALLIC_ITEM],
    businessLines: ["metallic-roofing"],
    skus: ["COB030ROJO"],
    totalAmount: 110,
    totalCost: 78.6,
    sellerId: "FIXTURE",
    paymentStatus: "PAID",
    timestamp: now,
    metadata: fixtureMeta("F9"),
  });

  // ── Stock baseline ──
  // `set` sin merge: pisa el doc entero en cada seed, así cada test arranca del
  // mismo número aunque un test anterior lo haya movido.
  batch.set(db.collection("metallic_roofing_stock").doc(STOCK_SKU), {
    sku: STOCK_SKU,
    productName: METALLIC_ITEM.productName,
    quantity: STOCK_BASELINE_QTY,
    avgCost: STOCK_BASELINE_AVG_COST,
    totalValue: STOCK_BASELINE_TOTAL_VALUE,
    lastUpdate: now,
    metadata: fixtureMeta("STOCK"),
  });

  await batch.commit();

  return {
    F1_native_happy: { saleId: f1SaleId, quoteId: f1QuoteId },
    F2_imported_happy: { saleId: f2SaleId, perchaId: f2PerchaId },
    F3_native_block: { saleId: f3SaleId, quoteId: f3QuoteId, logId: f3LogId },
    F4_imported_block: { saleId: f4SaleId, perchaId: f4PerchaId, logId: f4LogId },
    F5_native_ex_active: { saleId: f5SaleId, quoteId: f5QuoteId, logId: f5LogId },
    F6_orphan: { saleId: f6SaleId },
    F7_native_with_synced_cost: { saleId: f7SaleId, quoteId: f7QuoteId },
    F8_quotation_self_block: { quoteId: f8QuoteId, logId: f8LogId },
    F9_quotation_self_no_prod: { quoteId: f9QuoteId, stockSku: STOCK_SKU },
    stockBaseline: {
      sku: STOCK_SKU,
      quantity: STOCK_BASELINE_QTY,
      avgCost: STOCK_BASELINE_AVG_COST,
      totalValue: STOCK_BASELINE_TOTAL_VALUE,
    },
  };
}
