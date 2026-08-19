import { Sale, SaleStatus } from "@/types";

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

/**
 * Gating del botón "Duplicar Operación" (#9-B.2a). Allowlist a propósito (NO denylist):
 * un status nuevo/desconocido queda oculto por defecto en vez de aparecer sin querer.
 */
const DUPLICATABLE_STATUSES: SaleStatus[] = ["COMPLETED", "QUOTATION"];

export function canDuplicate(status: SaleStatus | undefined): boolean {
  return !!status && DUPLICATABLE_STATUSES.includes(status);
}

export type DuplicateIntent = "SALE" | "QUOTE";

/**
 * Deriva el intent sugerido al duplicar según el status del origen (#9-B.2a-2).
 * COMPLETED->SALE (era venta), QUOTATION->QUOTE (era cotización). Fuera de la
 * allowlist de canDuplicate -> null (sin sugerencia, nunca debería llegar acá).
 */
export function duplicateIntentFromStatus(status: string | undefined): DuplicateIntent | null {
  if (status === "COMPLETED") return "SALE";
  if (status === "QUOTATION") return "QUOTE";
  return null;
}

/**
 * Whitelist estricta del query param `?as=`. Nunca uppercase-coerce: solo
 * los literales exactos "SALE"/"QUOTE" cuentan, cualquier otra cosa -> null.
 */
export function parseDuplicateIntent(raw: string | null | undefined): DuplicateIntent | null {
  if (raw === "SALE" || raw === "QUOTE") return raw;
  return null;
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
