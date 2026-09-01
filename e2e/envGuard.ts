/**
 * TANDA 11 — [E2E-HARNESS] · TRIPWIRE DE ENTORNO. Regla `B22` (CLAUDE.md §11).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTE ARCHIVO EXISTE, Y POR QUÉ ES UNA REGLA CON NÚMERO PROPIO
 * ─────────────────────────────────────────────────────────────────────────────
 * Los tripwires vigentes de esta casa cubren `git`, `firebase use` y `deploy`.
 * NINGUNO cubre una URL. Y `ayr.mareliac.pe` sirve la app apuntada a
 * `ayrsteel-2026` (PROD): un harness que se enganche a esa URL escribe en
 * producción sin violar un solo tripwire existente.
 *
 * `B12` (v6.79.0) obliga a DECLARAR contra qué entorno corrió un E2E. Esto es
 * otra cosa: obliga a ABORTAR antes de tocar nada. Declarar es un deber de
 * reporte; abortar es un deber de ejecución. Esa diferencia es el número.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LAS TRES GUARDAS, Y POR QUÉ HACEN FALTA LAS TRES
 * ─────────────────────────────────────────────────────────────────────────────
 * (a) el HOST de `baseURL` es `localhost`.
 *     Es el host, NO un puerto fijo: fijar el puerto no impide apuntar a un
 *     dominio remoto, y un puerto distinto en localhost sigue siendo local.
 *
 * (b) el `projectId` que la app cargó EN RUNTIME es `ayrsteel-test`.
 *     Se mide grepeando el chunk JS realmente SERVIDO por el dev server (Next
 *     inlinea `NEXT_PUBLIC_*` en el bundle), nunca leyendo `.env.local` — que
 *     además, medido en esta tanda, contiene DOS bloques de config, uno
 *     comentado apuntando a `ayrsteel-2026`: un comentario mal movido y el
 *     dev server sirve PROD con el archivo "correcto" en disco.
 *
 * (c) el BACKEND EFECTIVO es la nube de ese proyecto.
 *     (b) NO distingue emulador de nube: el bundle dice `ayrsteel-test` en los
 *     dos casos, así que (b) da `true` igual. Solo el tráfico real lo separa —
 *     `database=projects%2Fayrsteel-test%2F` contra la nube, con CERO requests
 *     a `ayrsteel-2026` y CERO al host del emulador.
 *
 * Las 3 son PURAS a propósito: una guarda que no se puede falsificar en rojo es
 * una declaración, no un guard (K3.3).
 */

export type GuardResult = { ok: true } | { ok: false; reason: string };

/** Proyecto de PRUEBAS. El único contra el que este harness puede correr. */
export const EXPECTED_PROJECT = "ayrsteel-test";
/** Proyecto de PRODUCCIÓN. Su sola aparición es motivo de aborto. */
export const FORBIDDEN_PROJECT = "ayrsteel-2026";
/** Hosts del emulador de Firestore. Ver guarda (c). */
export const EMULATOR_HOSTS = ["127.0.0.1:8080", "localhost:8080", "[::1]:8080"];

/**
 * (a) El host de la URL base tiene que ser `localhost`.
 * Un `baseURL` inválido también aborta: no se adivina la intención.
 */
export function guardLocalHost(baseURL: string | undefined): GuardResult {
  if (!baseURL) return { ok: false, reason: "baseURL AUSENTE" };
  let host: string;
  try {
    host = new URL(baseURL).hostname;
  } catch {
    return { ok: false, reason: `baseURL no parseable: ${baseURL}` };
  }
  if (host !== "localhost") {
    return {
      ok: false,
      reason: `host medido = "${host}" (baseURL: ${baseURL}). Solo se permite "localhost".`,
    };
  }
  return { ok: true };
}

/**
 * (b) El projectId inlineado en el bundle SERVIDO es el de test.
 * Exige presencia POSITIVA del esperado Y ausencia total del prohibido: sin la
 * primera mitad, un bundle que no mencione ningún proyecto pasaría.
 */
export function guardProjectIdInBundle(bundleText: string): GuardResult {
  const test = bundleText.split(EXPECTED_PROJECT).length - 1;
  const prod = bundleText.split(FORBIDDEN_PROJECT).length - 1;
  if (prod > 0) {
    return {
      ok: false,
      reason: `el bundle servido menciona ${FORBIDDEN_PROJECT} ${prod} vez/veces (y ${EXPECTED_PROJECT} ${test}). Ese proyecto es PRODUCCIÓN.`,
    };
  }
  if (test === 0) {
    return {
      ok: false,
      reason: `el bundle servido NO menciona ${EXPECTED_PROJECT} (0 hits). No se puede afirmar el proyecto en runtime.`,
    };
  }
  return { ok: true };
}

/**
 * (c) El tráfico real fue a la nube del proyecto de test.
 * Tres condiciones, en orden de gravedad: nada a PROD, nada al emulador, y al
 * menos un request POSITIVO al backend esperado.
 */
export function guardBackendFromRequests(urls: string[]): GuardResult {
  const prod = urls.filter((u) => u.includes(FORBIDDEN_PROJECT));
  if (prod.length > 0) {
    return {
      ok: false,
      reason: `${prod.length} request(s) a ${FORBIDDEN_PROJECT} (PRODUCCIÓN). Primero: ${prod[0].slice(0, 160)}`,
    };
  }

  const emu = urls.filter((u) => EMULATOR_HOSTS.some((h) => u.includes(h)));
  if (emu.length > 0) {
    return {
      ok: false,
      reason: `${emu.length} request(s) al EMULADOR (${EMULATOR_HOSTS.join(", ")}). El harness corre contra la NUBE. Primero: ${emu[0].slice(0, 160)}`,
    };
  }

  // Firestore emite el proyecto encodeado (`projects%2F<id>%2F`) y, según el
  // canal, también sin encodear. Se aceptan las dos formas.
  const encoded = `projects%2F${EXPECTED_PROJECT}%2F`;
  const plain = `projects/${EXPECTED_PROJECT}/`;
  const hits = urls.filter((u) => u.includes(encoded) || u.includes(plain));
  if (hits.length === 0) {
    return {
      ok: false,
      reason: `CERO requests al backend de ${EXPECTED_PROJECT} (se buscó "${encoded}" y "${plain}" en ${urls.length} requests). Sin evidencia POSITIVA no se afirma el backend.`,
    };
  }

  return { ok: true };
}

/** Corre las 3 en orden y devuelve la primera que falle. */
export function runAllGuards(input: {
  baseURL: string | undefined;
  bundleText: string;
  requestUrls: string[];
}): GuardResult {
  const a = guardLocalHost(input.baseURL);
  if (!a.ok) return { ok: false, reason: `[B22-a HOST] ${a.reason}` };
  const b = guardProjectIdInBundle(input.bundleText);
  if (!b.ok) return { ok: false, reason: `[B22-b PROJECT] ${b.reason}` };
  const c = guardBackendFromRequests(input.requestUrls);
  if (!c.ok) return { ok: false, reason: `[B22-c BACKEND] ${c.reason}` };
  return { ok: true };
}
