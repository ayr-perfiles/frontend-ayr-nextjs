/**
 * seedCatalogMarzo.admin.ts — Siembra catálogos desde la facturación de marzo 2026.
 * Usa firebase-admin (Node). Escribe DIRECTO a Firestore (sku = id del doc).
 *
 * Cobertura: metallic-roofing (12) + roofing/UPVC (4) + trading (2) + services (1) = 19.
 * EXCLUIDOS por diseño: drywall (PRODUCT_CATALOG local), BOB* (coils), ANTI (anticipo).
 *
 * Idempotente: set({ merge: true }). Si el doc ya existe -> "actualizado"; si no -> "creado".
 * NO siembra avgCost real (0); el costo llega por compras/producción.
 *
 * Credencial: GOOGLE_APPLICATION_CREDENTIALS (ADC). El projectId se infiere de la credencial.
 *
 * Correr (raíz del repo):
 *   export GOOGLE_APPLICATION_CREDENTIALS=/ruta/serviceAccount.json
 *   npx tsx scripts/seedCatalogMarzo.admin.ts
 *   # opcional, dry-run (no escribe): SEED_DRY_RUN=1 npx tsx scripts/seedCatalogMarzo.admin.ts
 *
 * Dependencia: npm i -D firebase-admin tsx
 */

/* eslint-disable no-console */
import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ── Init admin (ADC) ──────────────────────────────────────────────────────────
if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const dbAdmin = getFirestore();
const DRY = process.env.SEED_DRY_RUN === "1";

// ── Tipos del seed (solo para tipar la data) ──────────────────────────────────
type Line = "metallic-roofing" | "roofing" | "trading" | "services";
interface SeedRow {
  sku: string;
  name: string;
  line: Line;
}

const COLLECTION: Record<Line, string> = {
  "metallic-roofing": "metallic_roofing_catalog",
  roofing: "roofing_catalog",
  trading: "trading_catalog",
  services: "services_catalog",
};

// ── Data verificada de marzo (deduplicada) ───────────────────────────────────
const ROWS: SeedRow[] = [
  // metallic-roofing
  { sku: "COB030ROJO", name: "COBERTURA DE ALUZINC 0.30MM ROJO", line: "metallic-roofing" },
  { sku: "COB030AZUL", name: "COBERTURA DE ALUZINC 0.30MM AZUL", line: "metallic-roofing" },
  { sku: "COB035ROJO", name: "COBERTURA DE ALUZINC 0.35MM ROJO", line: "metallic-roofing" },
  { sku: "COB040ROJO", name: "COBERTURA DE ALUZINC 0.40MM ROJO", line: "metallic-roofing" },
  { sku: "COB040AZUL", name: "COBERTURA DE ALUZINC 0.40MM AZUL", line: "metallic-roofing" },
  { sku: "COB040NATURAL", name: "COBERTURA DE ALUZINC 0.40MM NATURAL", line: "metallic-roofing" },
  { sku: "PL030RJ6MT", name: "COBERTURA DE ALUZINC RA-4 0.30 ROJO 6M", line: "metallic-roofing" },
  { sku: "PL030AZ6MT", name: "COBERTURA DE ALUZINC RA-4 0.30 AZUL 6M", line: "metallic-roofing" },
  { sku: "PL040RJ6MT", name: "COBERTURA DE ALUZINC RA-4 0.40 ROJO 6M", line: "metallic-roofing" },
  { sku: "PL040NT6MT", name: "COBERTURA DE ALUZINC RA-4 0.40 NATURAL 6M", line: "metallic-roofing" },
  { sku: "PL040X6MT", name: "COBERTURA DE ALUZINC AZUL RA-4 0.40 6M", line: "metallic-roofing" },
  { sku: "ACCES030ROJO", name: "ACCESORIO DE ALUZINC 0.30MM ROJO", line: "metallic-roofing" },
  // roofing / UPVC
  { sku: "UPVC6MT", name: "TC5 UPVC ROJO 1.5 MM X 1.075 X 6M", line: "roofing" },
  { sku: "UPVC6MTAZUL", name: "TC5 UPVC AZUL 1.5 MM X 1.075 X 6M", line: "roofing" },
  { sku: "UPVC36MT", name: "TC5 UPVC ROJO 1.5 MM X 1.075 X 3.6M", line: "roofing" },
  { sku: "UPVC36MTAZUL", name: "TC5 UPVC AZUL 1.5 MM X 1.075 X 3.6M", line: "roofing" },
  // trading
  { sku: "COBPOLI", name: "POLICARBONATO TIPO PV4 DE 6.00M", line: "trading" },
  { sku: "POLI600", name: "POLICARBONATO TIPO PV4 DE 6.00M", line: "trading" },
  // services
  { sku: "CONFORMADO", name: "SERVICIO DE CONFORMADO", line: "services" },
];

// ── Parsers ───────────────────────────────────────────────────────────────────
function parseThickness(sku: string): number {
  const m = sku.match(/(?:COB|PL|ACCES)(\d{3})/);
  return m ? parseInt(m[1], 10) / 100 : 0.3;
}
function parseColor(sku: string, name: string): string | undefined {
  const hay = (sku + " " + name).toUpperCase();
  if (hay.includes("NATURAL") || /\bNT\b/.test(sku)) return "NATURAL";
  if (hay.includes("AZUL") || /\bAZ\b/.test(sku) || sku.endsWith("X6MT")) return "AZUL";
  if (hay.includes("ROJO") || /\bRJ\b/.test(sku)) return "ROJO";
  return undefined;
}
function parseLengthMt(sku: string): number | undefined {
  if (sku.includes("36MT")) return 3.6;
  if (sku.includes("6MT")) return 6;
  return undefined;
}

// ── Builders por colección (shape directo del doc, sin avgCost real) ──────────
type Doc = Record<string, unknown>;

function buildMetallic(r: SeedRow): Doc {
  const family = r.sku.startsWith("PL")
    ? "PLANCHA"
    : r.sku.startsWith("ACCES")
      ? "ACCESORIO"
      : "COBERTURA";
  const unit = family === "COBERTURA" ? "METRO" : "PIEZA";
  const color = parseColor(r.sku, r.name);
  const length = family === "PLANCHA" ? parseLengthMt(r.sku) : undefined;
  return {
    sku: r.sku,
    displayName: r.name,
    family,
    finish: "ALUZINC",
    ...(color ? { color } : {}),
    thickness: parseThickness(r.sku),
    ...(length ? { length } : {}),
    unit,
    active: true,
    avgCost: 0,
  };
}

function buildRoofing(r: SeedRow): Doc {
  // Shape inferido (aprobado): material/color/thickness/width/length/unit
  const color = r.sku.includes("AZUL") ? "AZUL" : "ROJO";
  const length = r.sku.includes("36MT") ? 3.6 : 6;
  return {
    sku: r.sku,
    displayName: r.name,
    material: "UPVC",
    color,
    thickness: 1.5,
    width: 1.075,
    length,
    unit: "PIEZA",
    active: true,
    avgCost: 0,
  };
}

function buildTrading(r: SeedRow): Doc {
  return {
    sku: r.sku,
    displayName: r.name,
    category: "POLICARBONATO",
    spec: "PV4 6.00M",
    unit: r.sku === "COBPOLI" ? "METRO" : "PIEZA",
    active: true,
    avgCost: 0,
  };
}

function buildServices(r: SeedRow): Doc {
  return {
    sku: r.sku,
    displayName: r.name,
    description: "Servicio de conformado por tonelada",
    unit: "TONELADA",
    active: true,
  };
}

function buildDoc(r: SeedRow): Doc {
  switch (r.line) {
    case "metallic-roofing":
      return buildMetallic(r);
    case "roofing":
      return buildRoofing(r);
    case "trading":
      return buildTrading(r);
    case "services":
      return buildServices(r);
  }
}

// ── Run ────────────────────────────────────────────────────────────────────────
async function run() {
  const summary: Record<string, { created: number; updated: number; failed: number }> = {};
  for (const r of ROWS) {
    summary[r.line] ??= { created: 0, updated: 0, failed: 0 };
    const col = COLLECTION[r.line];
    const ref = dbAdmin.collection(col).doc(r.sku);
    const base = buildDoc(r);
    try {
      const snap = await ref.get();
      const exists = snap.exists;
      const payload: Doc = {
        ...base,
        updatedAt: FieldValue.serverTimestamp(),
        ...(exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      };
      if (DRY) {
        console.log(`· [DRY] ${col}/${r.sku} ${exists ? "→update" : "→create"}`, base);
      } else {
        await ref.set(payload, { merge: true });
      }
      if (exists) summary[r.line].updated++;
      else summary[r.line].created++;
      if (!DRY) console.log(`${exists ? "↻" : "✓"} ${col}/${r.sku}`);
    } catch (err) {
      summary[r.line].failed++;
      console.error(`✗ ${col}/${r.sku}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\n── Resumen ${DRY ? "(DRY RUN, no se escribió)" : ""} ──`);
  for (const [line, s] of Object.entries(summary)) {
    console.log(`${line}: ${s.created} creados, ${s.updated} actualizados, ${s.failed} fallidos`);
  }
  console.log("Excluidos por diseño: drywall (PRODUCT_CATALOG), BOB* (coils), ANTI (anticipo).");
}

run().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
