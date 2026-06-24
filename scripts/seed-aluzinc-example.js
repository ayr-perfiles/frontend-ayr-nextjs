/**
 * scripts/seed-aluzinc-example.js
 *
 * Siembra datos mínimos para probar el flujo completo Aluzinc:
 *   coil_finishes → coils (BOB-A/B/C) → producción → venta → merma → reportes.
 *
 * ⚠️  SOLO EMULADOR — abortará si FIRESTORE_EMULATOR_HOST no está definido.
 *
 * Uso:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx scripts/seed-aluzinc-example.js
 *
 * Qué siembra (idempotente: borra y recrea):
 *   - coil_finishes:           ALUZINC (densityFactor 0.008)
 *   - metallic_roofing_catalog: ALU-047-ROJO, ALU-035-NAT
 *   - metallic_roofing_stock:   ambos SKUs en 0
 *   - coils:                   BOB-A, BOB-B, BOB-C
 */

import admin from "firebase-admin";

// ─── Guard HARD: abortar si no es emulador ─────────────────────────────────────

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(
    "\n❌  ABORT: FIRESTORE_EMULATOR_HOST no está definido.\n" +
    "    Este script SOLO debe ejecutarse contra el emulador local.\n" +
    "    Ejemplo:\n" +
    "      FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx scripts/seed-aluzinc-example.js\n",
  );
  process.exit(1);
}

const PROJECT_ID = "demo-ayrsteel";
admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ─── Datos de seed ────────────────────────────────────────────────────────────

const COIL_FINISH = {
  id: "ALUZINC",
  label: "ALUZINC",
  active: true,
  lines: ["metallic-roofing"],
  densityFactor: 0.008,
};

const CATALOG_PRODUCTS = [
  {
    sku: "ALU-047-ROJO",
    displayName: "Cobertura Aluzinc 0.47mm ROJO",
    family: "COBERTURA",
    finish: "ALUZINC",
    color: "ROJO",
    thickness: 0.47,
    width: 1.0,
    length: null,
    unit: "METRO",
    active: true,
    avgCost: 0,
    widthMm: 1200,
    densityFactor: 0.008,
    metaSource: "manual",
  },
  {
    sku: "ALU-035-NAT",
    displayName: "Cobertura Aluzinc 0.35mm NATURAL",
    family: "COBERTURA",
    finish: "ALUZINC",
    color: "",
    thickness: 0.35,
    width: 1.0,
    length: null,
    unit: "METRO",
    active: true,
    avgCost: 0,
    widthMm: 1200,
    densityFactor: 0.008,
    metaSource: "manual",
  },
];

// pricePerKg ya en PEN (AddCoilForm convierte USD→PEN antes de guardar)
const COILS = [
  {
    id: "BOB-A",
    initialWeight: 1000,
    currentWeight: 1000,
    masterWidth: 1200,
    thickness: 0.47,
    finish: "ALUZINC",
    pricePerKg: 3.0,
    currency: "PEN",
    exchangeRate: 1,
    status: "AVAILABLE",
    providerName: "PROVEEDOR TEST",
    invoiceNumber: "F001-0001",
  },
  {
    id: "BOB-B",
    initialWeight: 600,
    currentWeight: 600,
    masterWidth: 1200,
    thickness: 0.35,
    finish: "ALUZINC",
    pricePerKg: 3.2,
    currency: "PEN",
    exchangeRate: 1,
    status: "AVAILABLE",
    providerName: "PROVEEDOR TEST",
    invoiceNumber: "F001-0002",
  },
  {
    id: "BOB-C",
    initialWeight: 500,
    currentWeight: 500,
    masterWidth: 1200,
    thickness: 0.47,
    finish: "ALUZINC",
    // 6.20 USD × TC 3.80 = 23.56 PEN/kg
    pricePerKg: 23.56,
    currency: "USD",
    exchangeRate: 3.8,
    status: "AVAILABLE",
    providerName: "PROVEEDOR IMPORTADO TEST",
    invoiceNumber: "F001-0003",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function deleteCollection(colName) {
  const snap = await db.collection(colName).get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

async function deleteDoc(colName, id) {
  await db.collection(colName).doc(id).delete();
}

// ─── Seed principal ───────────────────────────────────────────────────────────

async function run() {
  console.log("\n🌱  Seed Aluzinc — emulador:", process.env.FIRESTORE_EMULATOR_HOST, "\n");

  // 1. Limpiar datos previos
  console.log("🗑   Limpiando colecciones...");

  const deletedFinishes = await deleteCollection("coil_finishes");
  const deletedCatalog = await deleteCollection("metallic_roofing_catalog");
  const deletedStock = await deleteCollection("metallic_roofing_stock");
  for (const coil of COILS) await deleteDoc("coils", coil.id);

  console.log(
    `    coil_finishes: ${deletedFinishes} docs eliminados\n` +
    `    metallic_roofing_catalog: ${deletedCatalog} docs eliminados\n` +
    `    metallic_roofing_stock: ${deletedStock} docs eliminados\n` +
    `    coils BOB-A/B/C: eliminados\n`,
  );

  // 2. Sembrar coil_finishes
  await db.collection("coil_finishes").doc(COIL_FINISH.id).set({
    ...COIL_FINISH,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log("✅  coil_finishes: ALUZINC (densityFactor=0.008)");

  // 3. Sembrar catálogo + stock en 0
  for (const p of CATALOG_PRODUCTS) {
    const { sku, ...data } = p;
    await db.collection("metallic_roofing_catalog").doc(sku).set({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await db.collection("metallic_roofing_stock").doc(sku).set({
      sku,
      quantity: 0,
      avgCost: 0,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  console.log("✅  metallic_roofing_catalog: ALU-047-ROJO, ALU-035-NAT");
  console.log("✅  metallic_roofing_stock:   ambos SKUs en 0\n");

  // 4. Sembrar bobinas
  for (const coil of COILS) {
    const { id, ...data } = coil;
    await db.collection("coils").doc(id).set({
      ...data,
      id,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  console.log("✅  coils: BOB-A (1000 kg @ S/3.00), BOB-B (600 kg @ S/3.20), BOB-C (500 kg @ $6.20/TC3.80 = S/23.56)\n");

  // ─── Guía de validación ──────────────────────────────────────────────────────

  printValidationGuide();
}

function printValidationGuide() {
  // Fórmula: weightKg = ml × thicknessMm × masterWidth × densityFactor
  // densityFactor del FINISH (0.008 para todo aluzinc), NO del producto del catálogo

  const dF = 0.008; // densityFactor del finish ALUZINC (natural y prepintado)

  // Escenario A: 100 ML de BOB-A → ALU-047-ROJO
  const wA = +(100 * 0.47 * 1200 * dF).toFixed(4);
  const costA = +(wA * 3.0).toFixed(4);
  const cuA = +(costA / 100).toFixed(6);
  const bobAPost = +(1000 - wA).toFixed(4);

  // Escenario B: 50 ML de BOB-B → ALU-035-NAT
  const wB = +(50 * 0.35 * 1200 * dF).toFixed(4);
  const costB = +(wB * 3.2).toFixed(4);
  const cuB = +(costB / 50).toFixed(6);
  const bobBPost = +(600 - wB).toFixed(4);

  // Escenario C: Merma 50 kg BOB-C
  const scrapKg = 50;
  const scrapCost = +(scrapKg * 23.56).toFixed(2);
  const bobCPost = +(500 - scrapKg).toFixed(4);

  // Escenario D: Venta 5 ML ALU-047-ROJO @ S/20 (con IGV)
  const priceD = 20;
  const uvD = +(priceD / 1.18).toFixed(6);
  const ventaD = +(5 * uvD).toFixed(2);
  const costoD = +(5 * cuA).toFixed(2);

  // Escenario E: Venta 10 ML ALU-035-NAT @ S/15 (con IGV)
  const priceE = 15;
  const uvE = +(priceE / 1.18).toFixed(6);
  const ventaE = +(10 * uvE).toFixed(2);
  const costoE = +(10 * cuB).toFixed(2);

  const totalVenta = +(ventaD + ventaE).toFixed(2);
  const totalCosto = +(costoD + costoE).toFixed(2);
  const totalMerma = scrapCost;
  const totalGanancia = +(totalVenta - totalCosto - totalMerma).toFixed(2);

  console.log("═".repeat(62));
  console.log("  GUÍA DE VALIDACIÓN — Flujo Aluzinc completo");
  console.log("═".repeat(62));
  console.log(`
┌─ ESCENARIO A: Producción 100 ML BOB-A → ALU-047-ROJO
│   Fórmula: 100 × 0.47mm × 1200mm × 0.008
│   Peso consumido : ${wA} kg
│   Costo PEN      : S/ ${costA}
│   Costo unitario : S/ ${cuA}/ML  ← se congela en stock
│   BOB-A post     : ${bobAPost} kg
│
├─ ESCENARIO B: Producción 50 ML BOB-B → ALU-035-NAT
│   Fórmula: 50 × 0.35mm × 1200mm × 0.008
│   Peso consumido : ${wB} kg
│   Costo PEN      : S/ ${costB}
│   Costo unitario : S/ ${cuB}/ML  ← se congela en stock
│   BOB-B post     : ${bobBPost} kg
│
├─ ESCENARIO C: Registrar Merma 50 kg en BOB-C
│   pricePerKg BOB-C : S/ 23.56  ($6.20 × TC 3.80)
│   scrapCostPEN     : S/ ${scrapCost}  ← aparece en reporte Resumen como mermaSoles
│   BOB-C post       : ${bobCPost} kg
│
├─ ESCENARIO D: Vender 5 ML ALU-047-ROJO @ S/ ${priceD} c/IGV
│   unitValue   : S/ ${uvD.toFixed(4)}/ML
│   ventaSoles  : S/ ${ventaD}
│   baseCost    : S/ ${cuA}/ML  (congelado al carrito)
│   costoSoles  : S/ ${costoD}
│
├─ ESCENARIO E: Vender 10 ML ALU-035-NAT @ S/ ${priceE} c/IGV
│   unitValue   : S/ ${uvE.toFixed(4)}/ML
│   ventaSoles  : S/ ${ventaE}
│   baseCost    : S/ ${cuB}/ML  (congelado al carrito)
│   costoSoles  : S/ ${costoE}
│
└─ REPORTE RESUMEN (todo el periodo — aluzinc-resumen)
    ventaSoles   : S/ ${totalVenta}
    costoSoles   : S/ ${totalCosto}
    mermaSoles   : S/ ${totalMerma}
    ──────────────────────────────
    gananciaSoles: S/ ${totalGanancia}  (venta − costo − merma)`);
  console.log("\n" + "═".repeat(62));
  console.log(`
  FLUJO EN LA APP (apuntando a emulador):
  1. /admin/coils → Registrar bobina NO necesario (ya sembradas)
  2. /admin/lines/metallic-roofing/production
       → BOB-A · 100 ML · SKU: ALU-047-ROJO → Registrar
       → BOB-B · 50 ML  · SKU: ALU-035-NAT  → Registrar
  3. /admin/coils → Registrar Merma en BOB-C (50 kg)
  4. /admin/sales → Nueva venta:
       Tab Aluzinc: 5 ML ALU-047-ROJO @ S/ 20
                    10 ML ALU-035-NAT @ S/ 15
  5. /admin/reports → Ejecutivo → Aluzinc Resumen
       Verificar totales contra la guía arriba
`);
}

run().catch((err) => {
  console.error("\n❌  Error en seed:", err.message || err);
  process.exit(1);
});
