/**
 * TANDA 12 — custodio de `next.config.ts` · `distDir` parametrizable.
 *
 * Este archivo existe por UNA razón: el cambio de la Tanda 11 a `next.config.ts`
 * (`distDir: process.env.AYR_E2E_DIST_DIR || ".next"`) se declaró NO-OP para
 * cualquier build que no setee la variable, y esa declaración no tenía ningún
 * test que la falsificara. `next.config.ts` es el único archivo fuera de `e2e/`
 * que el harness tocó, y es un archivo que VIAJA A VERCEL — o sea que si el
 * no-op deja de ser cierto, el que se entera es producción.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ SE FALSIFICA EN LAS DOS DIRECCIONES
 * ─────────────────────────────────────────────────────────────────────────────
 * Un test que solo prueba el caso CON la variable no prueba nada sobre el no-op:
 * el caso que protege a Vercel es el de la AUSENCIA. Por eso el caso 1 (sin la
 * variable ⇒ `.next` exacto) es el que manda, y el caso 2 (con la variable ⇒ el
 * valor pasado) existe para que el caso 1 no pueda pasar por un `distDir`
 * hardcodeado que ignore la variable — sin él, borrar la parametrización entera
 * dejaría el caso 1 en verde.
 *
 * `vi.resetModules()` es obligatorio: `next.config.ts` lee `process.env` en el
 * cuerpo del módulo, o sea UNA sola vez al importarse. Sin el reset, el segundo
 * `import` devuelve el objeto cacheado de la primera evaluación y el test mide
 * el env de la primera corrida, no el que acaba de setear.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const VAR = "AYR_E2E_DIST_DIR";

/** Re-evalúa `next.config.ts` desde cero con el `process.env` actual. */
async function loadConfig() {
  vi.resetModules();
  const mod = await import("../../../next.config");
  return mod.default;
}

describe("next.config.ts — distDir parametrizable (custodio del no-op)", () => {
  let original: string | undefined;

  beforeEach(() => {
    original = process.env[VAR];
  });

  afterEach(() => {
    if (original === undefined) delete process.env[VAR];
    else process.env[VAR] = original;
  });

  it("SIN la env var: distDir es exactamente '.next' (el no-op que protege a Vercel)", async () => {
    delete process.env[VAR];
    const config = await loadConfig();
    expect(config.distDir).toBe(".next");
  });

  it("CON la env var: distDir es el valor pasado (la parametrización existe de verdad)", async () => {
    process.env[VAR] = ".next-e2e";
    const config = await loadConfig();
    expect(config.distDir).toBe(".next-e2e");
  });

  it("con la env var VACÍA: cae al default '.next', no a cadena vacía", async () => {
    // `||` y no `??` a propósito: un `AYR_E2E_DIST_DIR=""` heredado del entorno
    // no debe producir `distDir: ""`, que Next resolvería a la raíz del repo.
    process.env[VAR] = "";
    const config = await loadConfig();
    expect(config.distDir).toBe(".next");
  });

  it("el cambio es ADITIVO: los redirects siguen intactos y distDir es la única clave nueva", async () => {
    delete process.env[VAR];
    const config = await loadConfig();
    // Si alguien agrega comportamiento nuevo a este config, este assert lo caza.
    expect(Object.keys(config).sort()).toEqual(["distDir", "redirects"]);
    const redirects = await config.redirects!();
    expect(redirects).toHaveLength(12);
    expect(redirects[0]).toMatchObject({
      source: "/",
      destination: "/admin",
      permanent: false,
    });
  });
});
