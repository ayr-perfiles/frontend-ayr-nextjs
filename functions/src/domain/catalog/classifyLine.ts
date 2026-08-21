/**
 * Copia server-side (dominio 100% puro, sin dependencias) de `classifyLine` y del tipo
 * `BusinessLineTarget` de `src/core/import/catalogImport.ts`.
 *
 * La duplicación es el patrón sancionado del repo (ADR "Dominio puro: copia canónica en
 * functions/src/domain/ + TEST DE PARIDAD vs copia cliente", CLAUDE.md §10). Acá hay
 * **4** bloqueos al import cross-boundary, no 3:
 *   1. `functions/tsconfig.json` tiene `rootDir:"src"` e `include:["src"]` -> cualquier
 *      archivo fuera de functions/src/ rompe `tsc` con TS6059.
 *   2. `firebase.json` acota `source:"functions"` para el codebase default -> el zip que
 *      sube al deploy nunca incluiría ../../src/.
 *   3. `functions/tsconfig.json` no declara `paths`, así que el alias `@/` no resuelve.
 *   4. `src/core/import/catalogImport.ts:1` hace `import { read, utils } from 'xlsx'` a
 *      nivel de módulo -> aunque los 3 anteriores se resolvieran, importar `classifyLine`
 *      desde ahí arrastraría el paquete `xlsx` ENTERO al bundle de functions (y `xlsx` ni
 *      siquiera está en functions/package.json).
 *
 * Se porta SOLO `classifyLine` + su tipo de retorno. El resto de `catalogImport`
 * (`parseCatalogExport`, `parseNumValue`, normalización de unidades, …) no lo usa el
 * builder y NO se duplica.
 *
 * ⚠️ EL ORDEN DE LAS REGLAS ES EL COMPORTAMIENTO. `COBPOLI*` tiene que evaluarse ANTES
 * que `COB*`, si no un policarbonato caería en metallic-roofing. No reordenar.
 *
 * Mantener en sync a mano; `__tests__/classifyLine.parity.test.ts` es la única red.
 */

export type BusinessLineTarget =
  | "drywall"
  | "metallic-roofing"
  | "roofing"
  | "trading"
  | "services"
  | "coil"
  | "skip"
  | "unclassified";

export function classifyLine(sku: string, name: string): BusinessLineTarget {
  const s = sku.toUpperCase();
  const n = name.toUpperCase();

  // 1. Antis / Anticipos -> skip
  if (s.startsWith("ANTI") || n.includes("ANTICIPO")) return "skip";

  // 2. Policarbonato (COBPOLI / POLI) — ANTES que la regla COB* de abajo.
  if (s.startsWith("COBPOLI") || n.includes("POLICARBONATO")) return "trading";

  // 3. Bobinas -> coil (not written to catalog)
  if (s.startsWith("BOB")) return "coil";

  // 4. Drywall (P...GALV, R...GALV, OMEGA, ESQ)
  if (
    (s.startsWith("P") && s.includes("GALV")) ||
    (s.startsWith("R") && s.includes("GALV")) ||
    s.startsWith("OMEGA") ||
    s.startsWith("ESQ")
  ) {
    return "drywall";
  }

  // 5. Metallic Roofing (COB, PL, ACCES)
  if (s.startsWith("COB") || s.startsWith("PL") || s.startsWith("ACCES")) {
    return "metallic-roofing";
  }

  // 6. Roofing / UPVC (UPVC, TC5)
  if (s.startsWith("UPVC") || n.includes("TC5")) return "roofing";

  // 7. Trading (POLI, TUBO, AUTOP)
  if (s.startsWith("POLI") || s.startsWith("TUBO") || s.startsWith("AUTOP")) {
    return "trading";
  }

  // 8. Services (CONFORM, SERV)
  if (s.startsWith("CONFORM") || s.startsWith("SERV")) return "services";

  // None match
  return "unclassified";
}
