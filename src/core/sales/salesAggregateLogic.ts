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
 * Mismo whitelist que `buildListStatusFilter`, en sintaxis de filtro Algolia — fuente
 * única entre la rama Firestore y la rama de búsqueda de texto de `fetchSales` (Frente
 * #9-B.1: sin esto, buscar texto con 'ALL' corría sin ningún filtro de status y volvía
 * a mostrar cotizaciones en `/admin/sales`). Paréntesis siempre presentes: Algolia evalúa
 * AND antes que OR, así que el grupo de status debe quedar aislado antes de combinarse
 * con otros filtros (ej. `sunat.estado`) vía AND.
 */
export function buildAlgoliaStatusFilter(statusFilter: string): string {
  return `(${buildListStatusFilter(statusFilter)
    .map((s) => `status:${s}`)
    .join(" OR ")})`;
}
