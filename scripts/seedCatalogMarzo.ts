/**
 * seedCatalogMarzo.ts — Siembra los catálogos desde la facturación de marzo 2026.
 *
 * Cobertura: metallic-roofing (13) + roofing/UPVC (4) + trading (2) + services (1).
 * EXCLUIDOS por decisión:
 *   - drywall  -> se gestiona vía PRODUCT_CATALOG local (trae ancho/peso reales).
 *   - BOB*      -> materia prima, va a `coils` (no a catálogo de línea).
 *   - ANTI      -> anticipo contable, no es producto.
 *
 * Idempotente: si el SKU ya existe -> updateProduct; si no -> createProduct.
 * avgCost NO se siembra (llega por compras/producción).
 *
 * Cómo correr (en la raíz del repo):
 *   npx tsx scripts/seedCatalogMarzo.ts
 *
 * ⚠️ VERIFICAR ANTES DE CORRER:
 *   - Que los paths de import de cada catalogService coincidan con tu repo.
 *   - Que cada service exporte: createProduct, updateProduct, getProduct.
 *   - El shape de roofing (RoofingProductInput) lo inferí del AddProductModal de
 *     roofing; confírmalo contra modules/roofing/schemas/catalog.ts. Si difiere,
 *     ajusta SOLO la función buildRoofing().
 */

/* eslint-disable no-console */

// ── Imports de servicios por línea (CONFIRMAR PATHS) ─────────────────────────
import * as metallicSvc from "@/modules/metallic-roofing/services/catalogService";
import * as roofingSvc from "@/modules/roofing/services/catalogService";
import * as tradingSvc from "@/modules/trading/services/catalogService";
import * as servicesSvc from "@/modules/services/services/catalogService";

// ── Tipos locales del seed (solo para tipar la data, no son de dominio) ──────
type Line = "metallic-roofing" | "roofing" | "trading" | "services";

interface SeedRow {
  sku: string;
  name: string; // nombre tal cual en la factura (referencia)
  line: Line;
}

// ── Data verificada de marzo (deduplicada) ───────────────────────────────────
const ROWS: SeedRow[] = [
  // metallic-roofing — coberturas, planchas, accesorios aluzinc
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

  // roofing — UPVC / termoacústicos TC5
  { sku: "UPVC6MT", name: "TC5 UPVC ROJO 1.5 MM X 1.075 X 6M", line: "roofing" },
  { sku: "UPVC6MTAZUL", name: "TC5 UPVC AZUL 1.5 MM X 1.075 X 6M", line: "roofing" },
  { sku: "UPVC36MT", name: "TC5 UPVC ROJO 1.5 MM X 1.075 X 3.6M", line: "roofing" },
  { sku: "UPVC36MTAZUL", name: "TC5 UPVC AZUL 1.5 MM X 1.075 X 3.6M", line: "roofing" },

  // trading — reventa (policarbonato)
  { sku: "COBPOLI", name: "POLICARBONATO TIPO PV4 DE 6.00M", line: "trading" },
  { sku: "POLI600", name: "POLICARBONATO TIPO PV4 DE 6.00M", line: "trading" },

  // services — conformado
  { sku: "CONFORMADO", name: "SERVICIO DE CONFORMADO", line: "services" },
];

// ── Parsers de atributos desde sku/name ──────────────────────────────────────
function parseThickness(sku: string): number {
  // COB030 / PL040 / ACCES030 -> 0.30 / 0.40 / 0.30
  const m = sku.match(/(?:COB|PL|ACCES)(\d{3})/);
  if (m) return parseInt(m[1], 10) / 100;
  return 0.3; // fallback razonable
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

// ── Builders por línea (mapean SeedRow -> input del service) ──────────────────
function buildMetallic(r: SeedRow) {
  const family = r.sku.startsWith("PL")
    ? "PLANCHA"
    : r.sku.startsWith("ACCES")
      ? "ACCESORIO"
      : "COBERTURA";
  const unit = family === "COBERTURA" ? "METRO" : "PIEZA"; // COB se factura por METRO LINEAL
  const length = family === "PLANCHA" ? parseLengthMt(r.sku) : undefined;
  return {
    sku: r.sku,
    displayName: r.name,
    family,
    finish: "ALUZINC",
    color: parseColor(r.sku, r.name),
    thickness: parseThickness(r.sku),
    unit,
    active: true,
    ...(length ? { length } : {}),
  };
}

function buildRoofing(r: SeedRow) {
  // ⚠️ Confirmar contra modules/roofing/schemas/catalog.ts
  const color = r.sku.includes("AZUL") ? "AZUL" : "ROJO";
  const length = r.sku.includes("36MT") ? 3.6 : 6;
  return {
    sku: r.sku,
    displayName: r.name,
    material: "UPVC" as const,
    color,
    thickness: 1.5,
    width: 1.075,
    length,
    unit: "PIEZA" as const,
  };
}

function buildTrading(r: SeedRow) {
  const unit = r.sku === "COBPOLI" ? "METRO" : "PIEZA";
  return {
    sku: r.sku,
    displayName: r.name,
    category: "POLICARBONATO",
    spec: "PV4 6.00M",
    unit,
    active: true,
  };
}

function buildServices(r: SeedRow) {
  return {
    sku: r.sku,
    displayName: r.name,
    description: "Servicio de conformado por tonelada",
    unit: "TONELADA" as const,
    active: true,
  };
}

// ── Despachador idempotente ───────────────────────────────────────────────────
type SvcLike = {
  getProduct: (sku: string) => Promise<unknown | null>;
  createProduct: (input: unknown) => Promise<unknown>;
  updateProduct: (sku: string, updates: unknown) => Promise<unknown>;
};

const SVC: Record<Line, SvcLike> = {
  "metallic-roofing": metallicSvc as unknown as SvcLike,
  roofing: roofingSvc as unknown as SvcLike,
  trading: tradingSvc as unknown as SvcLike,
  services: servicesSvc as unknown as SvcLike,
};

function buildInput(r: SeedRow): unknown {
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

async function run() {
  const summary: Record<string, { created: number; updated: number; failed: number }> = {};
  for (const r of ROWS) {
    summary[r.line] ??= { created: 0, updated: 0, failed: 0 };
    const svc = SVC[r.line];
    const input = buildInput(r);
    try {
      const existing = await svc.getProduct(r.sku).catch(() => null);
      if (existing) {
        await svc.updateProduct(r.sku, input);
        summary[r.line].updated++;
        console.log(`↻ [${r.line}] ${r.sku} actualizado`);
      } else {
        await svc.createProduct(input);
        summary[r.line].created++;
        console.log(`✓ [${r.line}] ${r.sku} creado`);
      }
    } catch (err) {
      summary[r.line].failed++;
      console.error(`✗ [${r.line}] ${r.sku}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log("\n── Resumen ──");
  for (const [line, s] of Object.entries(summary)) {
    console.log(`${line}: ${s.created} creados, ${s.updated} actualizados, ${s.failed} fallidos`);
  }
  console.log("\nExcluidos (por diseño): drywall (PRODUCT_CATALOG), BOB* (coils), ANTI (anticipo).");
}

run().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
