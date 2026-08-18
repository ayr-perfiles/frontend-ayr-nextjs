import { SaleStatus } from "@/types";

export interface AggregateStatusFilterResult {
  statuses: SaleStatus[];
  label: "Vendido" | "Cotizado";
}

/**
 * Función pura que determina qué estados de venta deben incluirse en los cálculos
 * de agregados (totales de venta, utilidad, peso y conteo) según el filtro de la UI.
 */
export function buildAggregateStatusFilter(statusFilter: string): AggregateStatusFilterResult {
  if (statusFilter === "ALL" || statusFilter === "COMPLETED") {
    return {
      statuses: ["COMPLETED"],
      label: "Vendido",
    };
  }

  if (statusFilter === "QUOTATION" || statusFilter === "CONVERTED") {
    return {
      statuses: [statusFilter as SaleStatus],
      label: "Cotizado",
    };
  }

  return {
    statuses: [],
    label: "Vendido",
  };
}

/**
 * Función pura que construye las restricciones para la lista (tabla) de `/admin/sales`.
 * 'ALL' = whitelist de estados de VENTA REAL (COMPLETED, VOIDED) — las cotizaciones
 * (QUOTATION/CONVERTED/CANCELLED, incl. perchas COT-*) viven en `/admin/quotations`,
 * fuera de esta vista. Whitelist en vez de blacklist por prefijo de id: compone con
 * orderBy(timestamp) + paginación por cursor sin exigir índice nuevo (Frente #9-A).
 */
export function buildListStatusFilter(statusFilter: string): SaleStatus[] {
  if (statusFilter === "ALL") {
    return ["COMPLETED", "VOIDED"];
  }
  return [statusFilter as SaleStatus];
}

/**
 * ⚠️ NO USAR todavía (Frente #9-B.1-E, revertido en prod): `status` no está declarado
 * como atributo facetable en el índice Algolia `sales_index`. Usar este filtro ahí hace
 * que CUALQUIER búsqueda de texto en `/admin/sales` falle (Algolia responde error →
 * `algoliaClient.ts` cae a `hits:[]` → 0 resultados para todo, no solo para cotizaciones).
 * Queda escrita y testeada para cuando `status` sea facetable (config en el dashboard de
 * Algolia + reindexar) — ver DEUDA en HANDOFF.md. Mismo whitelist que `buildListStatusFilter`,
 * en sintaxis de filtro Algolia. Paréntesis siempre presentes: Algolia evalúa AND antes
 * que OR, el grupo de status debe quedar aislado antes de combinarse con otros filtros
 * (ej. `sunat.estado`) vía AND.
 */
export function buildAlgoliaStatusFilter(statusFilter: string): string {
  return `(${buildListStatusFilter(statusFilter)
    .map((s) => `status:${s}`)
    .join(" OR ")})`;
}

/**
 * Filtro CLIENT-SIDE de cotizaciones fuera de los resultados de búsqueda por texto de
 * `/admin/sales` (Frente #9-B.1-E). Como `status` no es facetable en Algolia (ver
 * `buildAlgoliaStatusFilter`), no se puede filtrar en la query — se filtra el array de
 * docs YA TRAÍDOS de Firestore (docs completos y auténticos, no el hit crudo de Algolia).
 * Mismo whitelist que `buildListStatusFilter('ALL')` — cubre perchas importadas
 * (`status==='QUOTATION'`) Y cotizaciones nativas por igual, sin depender de
 * `isImportedQuotation` (que solo detecta importadas, dejaría pasar una nativa). Un doc
 * sin `status` queda excluido: una venta real siempre tiene status, uno sin status no
 * debe colarse.
 */
export function filterSalesExcludingQuotations<T extends { status?: string }>(docs: T[]): T[] {
  const allowed = new Set(buildListStatusFilter("ALL"));
  return docs.filter((d) => d.status != null && allowed.has(d.status as SaleStatus));
}
