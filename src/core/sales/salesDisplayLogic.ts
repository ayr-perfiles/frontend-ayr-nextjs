import { Sale } from "@/types";

export interface SaleStatusBadgeInfo {
  label: string;
  colorClass: string;
}

/**
 * Mapeo completo de `status` a etiqueta+color, mismo vocabulario que `SalesTable.tsx`
 * (columna Estado). Reemplaza el ternario binario `COMPLETED?"Venta Cerrada":"Cotización"`
 * de `SalesHistoryTable.tsx`, que pintaba VOIDED/CANCELLED/CONVERTED como "Cotización".
 */
const SALE_STATUS_BADGES: Record<string, SaleStatusBadgeInfo> = {
  COMPLETED: { label: "Venta Cerrada", colorClass: "bg-green-50 text-green-700 border-green-200" },
  QUOTATION: { label: "Cotización", colorClass: "bg-orange-50 text-orange-700 border-orange-200" },
  CONVERTED: { label: "Convertida", colorClass: "bg-blue-50 text-blue-600 border-blue-200" },
  CANCELLED: { label: "Cancelada", colorClass: "bg-slate-100 text-slate-500 border-slate-200" },
  VOIDED: { label: "Anulada", colorClass: "bg-red-50 text-red-600 border-red-200" },
};

export function getSaleStatusBadge(status: string | undefined): SaleStatusBadgeInfo {
  return (
    SALE_STATUS_BADGES[status ?? ""] ?? {
      label: status || "—",
      colorClass: "bg-slate-50 text-slate-400 border-slate-100",
    }
  );
}

export interface ResolvedSaleDocument {
  rucDni: string;
  comprobante: string | null;
}

export function resolveCustomerDoc(sale: Partial<Sale>): ResolvedSaleDocument {
  const isDigitsOnly = (str?: string) => /^\d+$/.test(str || "");
  const fallbackToDoc = !sale.customerDocument && isDigitsOnly(sale.documentNumber);
  
  const rucDni = sale.customerDocument || (fallbackToDoc ? sale.documentNumber : "---");
  const comprobante = (!fallbackToDoc && sale.documentNumber) ? sale.documentNumber : null;

  return {
    rucDni: rucDni as string,
    comprobante,
  };
}
