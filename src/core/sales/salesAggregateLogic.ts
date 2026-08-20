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
 * Filtro CLIENT-SIDE de cotizaciones fuera de los resultados de búsqueda por texto de
 * `/admin/sales` (Frente #9-B.1-E). `status` NO es un atributo facetable del índice
 * Algolia `sales_index`, así que no se puede filtrar en la query — cualquier filtro
 * Algolia sobre `status` hace fallar la búsqueda entera (Algolia responde error →
 * `algoliaClient.ts` cae a `hits:[]` → 0 resultados para todo). Por eso se filtra el array de
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
