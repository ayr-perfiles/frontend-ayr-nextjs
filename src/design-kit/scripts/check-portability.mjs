#!/usr/bin/env node
/**
 * Verifica que el kit sea portable: sale con código 1 si algún archivo del kit
 * importa código de la app GSM, infraestructura o conceptos de negocio.
 *
 *   node design-kit/scripts/check-portability.mjs
 *
 * Sin dependencias: se puede copiar a la app destino tal cual.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const kitRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/** Carpetas del kit que deben ser 100% portables. */
const SOURCE_DIRS = ["components", "lib", "hooks", "strings", "config", "tokens"];
/** El catálogo es una app de demostración: se revisa aparte, sin la regla de Next. */
const PREVIEW_DIR = "preview";

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs"]);

/** Reglas aplicadas a cada línea. `preview` marca las que también rigen ahí. */
const RULES = [
  {
    id: "alias-app",
    preview: true,
    // Import con el alias `@/` de GSM (src/...).
    pattern: /\bfrom\s+["']@\/|\brequire\(\s*["']@\//,
    message: "importa código de la app GSM mediante el alias @/",
  },
  {
    id: "src-relative",
    preview: true,
    pattern: /\bfrom\s+["'][^"']*(\.\.\/)+src\//,
    message: "importa código de la app GSM por ruta relativa a src/",
  },
  {
    id: "next-import",
    preview: false,
    pattern: /\bfrom\s+["']next(\/|["'])/,
    message: "importa next/*, lo que rompe el uso en React puro",
  },
  {
    id: "supabase",
    preview: true,
    pattern: /@supabase\/|\bsupabase\b|SUPABASE_/i,
    message: "menciona Supabase (infraestructura)",
  },
  {
    id: "server-only",
    preview: true,
    pattern: /["']server-only["']|["']use server["']/,
    message: "usa server-only o Server Actions (infraestructura)",
  },
  {
    id: "business",
    preview: true,
    // Conceptos de negocio de GSM Inventory en identificadores o rutas de import.
    pattern:
      /\b(tenant|tenants|warehouse|warehouses|sku|purchaseOrder|salesOrder|purchase_order|sales_order|stockMovement|stock_movements|reorderPoint|reorder_point|kardex|rls)\b/i,
    message: "menciona un concepto de negocio de GSM Inventory",
  },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "screenshots") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (CODE_EXTENSIONS.has(entry.slice(entry.lastIndexOf(".")))) out.push(full);
  }
  return out;
}

function scan(files, { includePreviewOnlyRules }) {
  const problems = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const rule of RULES) {
        if (!includePreviewOnlyRules && !rule.preview) continue;
        if (rule.pattern.test(line)) {
          problems.push({
            file: relative(kitRoot, file).split(sep).join("/"),
            line: i + 1,
            rule: rule.id,
            message: rule.message,
            text: line.trim().slice(0, 120),
          });
        }
      }
    });
  }
  return problems;
}

const sourceFiles = SOURCE_DIRS.flatMap((dir) => walk(join(kitRoot, dir)));
const previewFiles = walk(join(kitRoot, PREVIEW_DIR));

const problems = [
  ...scan(sourceFiles, { includePreviewOnlyRules: true }),
  ...scan(previewFiles, { includePreviewOnlyRules: false }),
];

const scanned = sourceFiles.length + previewFiles.length;

if (problems.length > 0) {
  console.error(`\n✗ El kit no es portable: ${problems.length} problema(s).\n`);
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line}  [${p.rule}] ${p.message}`);
    console.error(`    ${p.text}`);
  }
  console.error("");
  process.exit(1);
}

console.log(
  `✓ Kit portable: ${scanned} archivos revisados, sin imports a la app GSM, ` +
    `a Supabase ni a conceptos de negocio (y sin next/* fuera del catálogo).`,
);
