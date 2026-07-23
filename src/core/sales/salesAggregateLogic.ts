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
 * Función pura que construye las restricciones para la lista (tabla) manteniendo
 * la paginación e historial intactos (en 'ALL' muestra COMPLETED + QUOTATION + CONVERTED).
 */
export function buildListStatusFilter(statusFilter: string): SaleStatus[] {
  if (statusFilter === "ALL") {
    return ["COMPLETED", "QUOTATION", "CONVERTED"];
  }
  return [statusFilter as SaleStatus];
}
