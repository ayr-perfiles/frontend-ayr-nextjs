/**
 * Copia server-side (dominio 100% puro, sin `firebase-admin`) del predicado
 * `hasActiveProduction` de `src/core/production/fulfillmentLogic.ts`.
 *
 * La duplicación es el patrón sancionado del repo (ver ADR "Dominio puro: copia
 * canónica en functions/src/domain/ + TEST DE PARIDAD vs copia cliente",
 * CLAUDE.md §10) — el import cross-boundary directo NO es viable:
 * functions/tsconfig.json tiene rootDir:"src", así que cualquier archivo fuera de
 * functions/src/ rompe `tsc` (TS6059) y, aunque compilara, firebase.json acota
 * `source:"functions"` para el deploy (el zip subido nunca incluiría ../../../src/).
 * Además el archivo cliente importa `@/types`, alias que no existe acá.
 *
 * Se porta SOLO `hasActiveProduction`: es lo único que el server necesita.
 * `quoteFulfillmentRows` y `bucketLogsBySourceId` (los otros 2 exports del archivo
 * cliente) no tienen consumidor server-side y NO se duplican.
 *
 * Mantener en sync a mano; `__tests__/fulfillmentLogic.parity.test.ts` es la única
 * red de seguridad.
 */

export function hasActiveProduction(logs: { status?: string }[]): boolean {
  return logs.some((log) => log.status === "ACTIVE");
}
