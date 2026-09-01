/**
 * TANDA 11 — [E2E-HARNESS] · el mensaje de aborto del guard de percha,
 * OBTENIDO DEL FUENTE. Aplica `B16`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ NO SE IMPORTA LA CLASE, QUE ERA EL PLAN ORIGINAL
 * ─────────────────────────────────────────────────────────────────────────────
 * `import { PerchaOverwriteBlockedError } from "../src/core/import/..."` arrastra
 * `clientApp.ts` al proceso de Playwright, que es Node y no tiene las
 * `NEXT_PUBLIC_*` del browser: medido, revienta con
 * `FirebaseError: Firebase: Error (auth/invalid-api-key)` en `clientApp.ts:31`
 * y Playwright reporta "No tests found". Misma familia que el incidente de
 * v6.11 (código de test arrastrando módulos de app al bundle equivocado).
 *
 * Leerlo del fuente es además MÁS fuerte que importarlo: no depende de que el
 * módulo sea importable en Node, y sigue sin transcribir el literal ni una vez
 * — que es todo lo que `B16` pide. El literal tiene 5 caracteres NO-ASCII y el
 * enunciado de esta tanda ya lo transcribió mal una vez (`Resolve` por
 * `Resolvé`), así que la única forma segura es no escribirlo nunca a mano.
 *
 * El parseo se ancla en SÍMBOLOS DE CÓDIGO (`reason`, `CANCELLED`), nunca en
 * palabras del mensaje: anclarse al texto sería transcribirlo por la ventana.
 */
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(
  process.cwd(),
  "src",
  "core",
  "import",
  "runSaleImportTransaction.ts",
);

/** Los dos template literals del constructor, en orden: CANCELLED, luego la otra rama. */
function extraerLiterales(): [string, string] {
  const src = fs.readFileSync(SRC, "utf8");
  const BT = String.fromCharCode(96);

  // Ancla: el ternario que discrimina la razón. Símbolos de código, no texto.
  const i = src.indexOf('reason === "CANCELLED"');
  if (i < 0) {
    throw new Error(
      `[E2E-HARNESS] no se encontró el ternario 'reason === "CANCELLED"' en ${SRC}. ` +
        "El guard cambió de forma: revisá el harness antes de confiar en sus asserts.",
    );
  }

  const literales: string[] = [];
  let cursor = i;
  while (literales.length < 2) {
    const a = src.indexOf(BT, cursor);
    if (a < 0) break;
    const b = src.indexOf(BT, a + 1);
    if (b < 0) break;
    literales.push(src.slice(a + 1, b));
    cursor = b + 1;
  }
  if (literales.length !== 2) {
    throw new Error(
      `[E2E-HARNESS] se esperaban 2 template literals tras el ternario en ${SRC}, ` +
        `se encontraron ${literales.length}.`,
    );
  }
  return [literales[0], literales[1]];
}

export type PerchaBlockReason = "CANCELLED" | "ACTIVE_PRODUCTION";

/**
 * El mensaje EXACTO que el importador muestra para una percha bloqueada.
 * Sustituye el único placeholder del template (`${quoteId}`) por el id real.
 */
export function mensajeDeAborto(quoteId: string, reason: PerchaBlockReason): string {
  const [cancelled, activa] = extraerLiterales();
  const tpl = reason === "CANCELLED" ? cancelled : activa;
  const out = tpl.replace(/\$\{quoteId\}/g, quoteId);
  if (out === tpl) {
    throw new Error(
      `[E2E-HARNESS] el literal de ${reason} no contenía el placeholder \${quoteId}. ` +
        "El mensaje cambió de forma: el assert dejaría de probar lo que dice probar.",
    );
  }
  return out;
}
