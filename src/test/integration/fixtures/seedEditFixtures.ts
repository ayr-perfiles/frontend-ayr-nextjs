import type { Firestore, WriteBatch } from "firebase-admin/firestore";

/**
 * Fixtures del callable `editQuotation` (sub-frente E2 del frente Editar).
 *
 * SEPARADO de `seedAnnulFixtures.ts` a propósito: aquel limpia por
 * `metadata.isAnnulFixture == true` y este por `metadata.isEditFixture == true`, así los
 * dos archivos de test pueden convivir en la misma corrida de `test:emu:functions`
 * (que corre `--no-file-parallelism`) sin borrarse los fixtures entre sí.
 *
 * ⚠️ `Timestamp.now()` de `firebase-admin/firestore` NO se usa acá — se usa `Date` nativo,
 * porque este módulo se importa cross-boundary desde tests de `functions/` (que tiene su
 * PROPIA copia de `firebase-admin` en su `node_modules`) y un `Timestamp` creado con una
 * copia del paquete no es `instanceof` el `Timestamp` que la otra espera al validar el
 * write ("dual package hazard"). Mismo criterio que `seedAnnulFixtures.ts`.
 */

export interface SeedEditFixturesOptions {
  /** default true: borra fixtures previos (metadata.isEditFixture==true) antes de seedear. */
  clean?: boolean;
}

export interface SeededEditFixtures {
  /** Cotización NATIVA en QUOTATION, sin producción: el caso editable. Trae TODOS los
   *  campos de ciclo de vida seteados, para poder assertear T2 (que no se pisan). */
  E1_native_editable: { quotationId: string };
  /** Cotización NATIVA en QUOTATION con production_log ACTIVE: bloqueada (D4/D10). */
  E2_native_blocked: { quotationId: string; logId: string };
  /** Percha IMPORTADA COT-* en QUOTATION: NO editable (D1). */
  E3_imported: { quotationId: string };
  /** Venta COMPLETED: NO editable (guard de status). */
  E4_completed: { saleId: string };
  /** SKUs sembrados en metallic_roofing_stock, para el recompute Q2(b). */
  stock: {
    skuWacPositive: string;
    wacPositive: number;
    skuWacZero: string;
    skuServices: string;
    skuCoil: string;
  };
  /** Valores del doc E1 que los tests usan como "antes" para comparar. */
  E1_before: {
    timestampMs: number;
    sellerId: string;
    paymentStatus: string;
    productionStatus: string;
    confirmedBy: string;
    isFulfilled: boolean;
  };
}

const P = "EDIT-FIX-";

const SKU_WAC_POS = P + "SKU-WAC-POS";
const SKU_WAC_ZERO = P + "SKU-WAC-ZERO";
const SKU_SERVICES = P + "SKU-SERVICIO";
const SKU_COIL = P + "SKU-BOBINA";
const WAC_POSITIVE = 9.5;

const E1_SELLER = "creador-original@ayr.pe";
const E1_PAYMENT_STATUS = "PAID";
const E1_PRODUCTION_STATUS = "CONFIRMED";
const E1_CONFIRMED_BY = "supervisor-original@ayr.pe";

/** Ítem base del doc "antes". Lo que el test manda en el request es OTRA cosa. */
const ITEM_BEFORE = {
  sku: SKU_WAC_POS,
  productName: "ITEM ORIGINAL",
  quantity: 1,
  unitPrice: 100,
  unitValue: 84.75,
  baseCost: 50,
  businessLine: "metallic-roofing",
  profit: 34.75,
  flags: [],
  unitWeight: 0,
  calculatedWeight: 0,
  unitOfMeasure: "UND",
  isCoil: false,
};

async function deleteWhereFixtureFlag(db: Firestore, collectionName: string): Promise<void> {
  const snap = await db.collection(collectionName).where("metadata.isEditFixture", "==", true).get();
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

export async function seedEditFixtures(
  db: Firestore,
  options: SeedEditFixturesOptions = {},
): Promise<SeededEditFixtures> {
  const clean = options.clean !== false;

  if (clean) {
    await deleteWhereFixtureFlag(db, "sales");
    await deleteWhereFixtureFlag(db, "production_logs");
    await deleteWhereFixtureFlag(db, "metallic_roofing_stock");
  }

  const now = new Date();
  // Fecha fija y vieja: si el callable pisara `timestamp`, el delta sería evidente.
  const originalTimestamp = new Date("2026-01-15T12:00:00.000Z");
  const batch = db.batch();
  const fixtureMeta = (fixtureId: string) => ({ isEditFixture: true, fixtureId });

  // ── E1: NATIVA en QUOTATION, editable, con TODO el ciclo de vida seteado ──
  const e1Id = P + "Q-EDITABLE";
  batch.set(db.collection("sales").doc(e1Id), {
    status: "QUOTATION",
    // Campos de ciclo de vida que el update selectivo NO debe tocar (T2):
    productionStatus: E1_PRODUCTION_STATUS,
    confirmedBy: E1_CONFIRMED_BY,
    confirmedForProductionAt: originalTimestamp,
    costSyncedAt: originalTimestamp,
    isFulfilled: false,
    // Campos que el builder emite pero el update preserva:
    sellerId: E1_SELLER,
    paymentStatus: E1_PAYMENT_STATUS,
    timestamp: originalTimestamp,
    // Contenido editable:
    customerName: "CLIENTE ORIGINAL",
    customerDocument: "20500000001",
    documentNumber: "",
    contactName: "CONTACTO ORIGINAL",
    contactPhone: "999000111",
    customerAddress: "DIRECCION ORIGINAL",
    items: [ITEM_BEFORE],
    businessLines: ["metallic-roofing"],
    skus: [SKU_WAC_POS],
    totalAmount: 100,
    totalCost: 50,
    totalProfit: 34.75,
    totalWeight: 0,
    allFlags: [],
    metadata: fixtureMeta("E1"),
  });

  // ── E2: NATIVA en QUOTATION con producción ACTIVE (bloqueada) ──
  const e2Id = P + "Q-BLOCKED";
  const e2LogId = P + "LOG-ACTIVE";
  batch.set(db.collection("sales").doc(e2Id), {
    status: "QUOTATION",
    productionStatus: "CONFIRMED",
    isFulfilled: false,
    customerName: "CLIENTE BLOQUEADO",
    customerDocument: "20500000002",
    documentNumber: "",
    items: [ITEM_BEFORE],
    businessLines: ["metallic-roofing"],
    skus: [SKU_WAC_POS],
    totalAmount: 100,
    totalCost: 50,
    totalProfit: 34.75,
    totalWeight: 0,
    allFlags: [],
    sellerId: E1_SELLER,
    paymentStatus: "PAID",
    timestamp: originalTimestamp,
    metadata: fixtureMeta("E2"),
  });
  batch.set(db.collection("production_logs").doc(e2LogId), {
    status: "ACTIVE",
    source: { type: "QUOTE", id: e2Id, label: e2Id },
    sku: SKU_WAC_POS,
    line: "metallic-roofing",
    mlProduced: 100,
    piecesProduced: 20,
    perCoilBreakdown: [],
    parentCoilIds: [],
    operatorId: "FIXTURE",
    timestamp: now,
    metadata: fixtureMeta("E2"),
  });

  // ── E3: percha IMPORTADA COT-* (las 2 señales de origen) ──
  const e3Id = "COT-" + P + "IMPORTADA";
  batch.set(db.collection("sales").doc(e3Id), {
    status: "QUOTATION",
    productionStatus: "CONFIRMED",
    isFulfilled: false,
    relatedSaleId: P + "IMPORTADA", // señal 1
    customerName: "CLIENTE IMPORTADO",
    customerDocument: "20500000003",
    documentNumber: P + "IMPORTADA",
    items: [ITEM_BEFORE],
    businessLines: ["metallic-roofing"],
    skus: [SKU_WAC_POS],
    totalAmount: 100,
    totalCost: 50,
    totalProfit: 34.75,
    totalWeight: 0,
    allFlags: [],
    sellerId: E1_SELLER,
    paymentStatus: "PAID",
    timestamp: originalTimestamp,
    metadata: {
      ...fixtureMeta("E3"),
      isQuotation: true, // señal 2
      isHistorical: true,
    },
  });

  // ── E4: venta COMPLETED (guard de status) ──
  const e4Id = P + "S-COMPLETED";
  batch.set(db.collection("sales").doc(e4Id), {
    status: "COMPLETED",
    customerName: "CLIENTE VENTA",
    customerDocument: "20500000004",
    documentNumber: "F001-1",
    items: [ITEM_BEFORE],
    businessLines: ["metallic-roofing"],
    skus: [SKU_WAC_POS],
    totalAmount: 100,
    totalCost: 50,
    totalProfit: 34.75,
    totalWeight: 0,
    allFlags: [],
    sellerId: E1_SELLER,
    paymentStatus: "PAID",
    timestamp: originalTimestamp,
    metadata: fixtureMeta("E4"),
  });

  // ── Stock para el recompute Q2(b) ──
  // `set` sin merge: cada seed deja el mismo baseline aunque un test lo haya movido.
  batch.set(db.collection("metallic_roofing_stock").doc(SKU_WAC_POS), {
    sku: SKU_WAC_POS,
    productName: "SKU CON WAC POSITIVO",
    quantity: 500,
    avgCost: WAC_POSITIVE,
    totalValue: 500 * WAC_POSITIVE,
    lastUpdate: now,
    metadata: fixtureMeta("STOCK"),
  });
  // avgCost 0 = el caso real de prod (7 de 18 SKUs de metallic estan en 0).
  batch.set(db.collection("metallic_roofing_stock").doc(SKU_WAC_ZERO), {
    sku: SKU_WAC_ZERO,
    productName: "SKU CON WAC CERO",
    quantity: 300,
    avgCost: 0,
    totalValue: 0,
    lastUpdate: now,
    metadata: fixtureMeta("STOCK"),
  });

  await batch.commit();

  return {
    E1_native_editable: { quotationId: e1Id },
    E2_native_blocked: { quotationId: e2Id, logId: e2LogId },
    E3_imported: { quotationId: e3Id },
    E4_completed: { saleId: e4Id },
    stock: {
      skuWacPositive: SKU_WAC_POS,
      wacPositive: WAC_POSITIVE,
      skuWacZero: SKU_WAC_ZERO,
      skuServices: SKU_SERVICES,
      skuCoil: SKU_COIL,
    },
    E1_before: {
      timestampMs: originalTimestamp.getTime(),
      sellerId: E1_SELLER,
      paymentStatus: E1_PAYMENT_STATUS,
      productionStatus: E1_PRODUCTION_STATUS,
      confirmedBy: E1_CONFIRMED_BY,
      isFulfilled: false,
    },
  };
}
