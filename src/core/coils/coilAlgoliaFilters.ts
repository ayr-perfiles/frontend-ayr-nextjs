/**
 * Construcción del string de `filters` de Algolia para `coils_index`.
 *
 * Fuente única para las DOS ramas Algolia de coilService:
 * - `fetchInventory` (modo "inventory"): con statusFilter==="ALL" excluye VOIDED
 *   (`NOT status:VOIDED`) — la tabla en pantalla no muestra anuladas.
 * - `fetchCoilsForExport` (modo "export"): con "ALL" no agrega cláusula de status —
 *   el export muestra el inventario completo, la anulación se marca en la fila.
 *
 * `metadata.provider` se cita SIEMPRE (comillas dobles + escape de `\` y `"`):
 * los 13 providers reales de prod tienen espacios, y un valor sin comillas con
 * espacios es un error de sintaxis para Algolia. Citar incondicionalmente evita
 * la rama "¿necesita comillas?". status/finish/currency se interpolan crudos —
 * sus valores son identificadores sin espacios (anclado por tests).
 *
 * `lineFinishIds` (frente #10, scope por línea de negocio): los ids de los
 * finishes de la línea (`getFinishIdsForLine`). Se emite como UNA cláusula
 * parentizada `(finish:A OR finish:B ...)` en AND con las demás, DESPUÉS de la
 * de `finish` singular — si ambas vienen, se emiten las dos (redundante a
 * propósito, defensivo). `undefined` o `[]` ⇒ no se emite nada, string idéntico
 * al anterior. Algolia no tiene el límite de 30 disyunciones de Firestore.
 */

/** Cita un valor para el string de `filters` de Algolia: "..." con \ y " escapados. */
const quote = (value: string): string =>
  `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export interface CoilAlgoliaFilterParams {
  statusFilter: string;
  finishFilter?: string;
  currencyFilter?: string;
  providerFilter?: string;
  /** Ids de finishes de la línea de negocio (scope por línea). `[]` = sin cláusula. */
  lineFinishIds?: string[];
}

export type CoilAlgoliaFilterMode = "inventory" | "export";

export function buildCoilAlgoliaFilters(
  params: CoilAlgoliaFilterParams,
  mode: CoilAlgoliaFilterMode,
): string {
  const { statusFilter, finishFilter, currencyFilter, providerFilter, lineFinishIds } = params;
  const filters: string[] = [];

  if (statusFilter !== "ALL") filters.push(`status:${statusFilter}`);
  else if (mode === "inventory") filters.push(`NOT status:VOIDED`);

  if (finishFilter && finishFilter !== "ALL") {
    filters.push(`finish:${finishFilter}`);
  }

  if (lineFinishIds && lineFinishIds.length > 0) {
    filters.push(`(${lineFinishIds.map((id) => `finish:${id}`).join(" OR ")})`);
  }

  if (currencyFilter && currencyFilter !== "ALL") {
    filters.push(`metadata.currency:${currencyFilter}`);
  }

  if (providerFilter && providerFilter.trim() !== "") {
    filters.push(`metadata.provider:${quote(providerFilter.trim())}`);
  }

  return filters.join(" AND ");
}
