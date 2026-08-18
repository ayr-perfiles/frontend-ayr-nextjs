import type { Sale, SaleItem } from "@/types";
import { isImportedQuotation } from "@/core/import/salesImportLogic";
import { buildQueueRow, QueueRowStatus } from "@/core/production/queueLogic";

export type QuotationOrigin = "IMPORTADA" | "NATIVA";

export function getQuotationOrigin(sale: Sale): QuotationOrigin {
  return isImportedQuotation(sale) ? "IMPORTADA" : "NATIVA";
}

export interface StatusLabelInfo {
  label: string;
  colorClass: string;
}

/** Estado CRUDO de la cotización (campo `status`) — eje independiente del estado de producción. */
const QUOTATION_STATE_LABELS: Record<string, StatusLabelInfo> = {
  QUOTATION: { label: "Vigente", colorClass: "bg-blue-50 text-blue-700 border-blue-200" },
  CANCELLED: { label: "Cancelada", colorClass: "bg-slate-100 text-slate-500 border-slate-200" },
};

export function getQuotationStateLabel(status: string | undefined): StatusLabelInfo {
  return (
    QUOTATION_STATE_LABELS[status ?? ""] ?? {
      label: status || "—",
      colorClass: "bg-slate-50 text-slate-400 border-slate-100",
    }
  );
}

export type QuotationProductionStatus = QueueRowStatus | "NO_APLICA";

/**
 * Estado de PRODUCCIÓN derivado (eje independiente del estado de la cotización — una cotización
 * Cancelada puede seguir teniendo producción PARCIAL/CUMPLIDA previa, se muestran ambos ejes).
 * "NO_APLICA": la cotización no tiene ítems metallic-roofing — buildQueueRow devolvería CUMPLIDA
 * por items.length===0 (correcto para la cola metallic, donde toda fila YA es metallic), pero
 * acá mostraría "Cumplida" en una cotización que nunca tuvo nada que producir. No se toca
 * buildQueueRow (reuso tal cual); se detecta el caso antes de llamarlo.
 */
const PRODUCTION_STATE_LABELS: Record<QuotationProductionStatus, StatusLabelInfo> = {
  PENDIENTE: { label: "Pendiente", colorClass: "bg-slate-100 text-slate-600 border-slate-200" },
  PARCIAL: { label: "Parcial", colorClass: "bg-amber-50 text-amber-700 border-amber-200" },
  CUMPLIDA: { label: "Cumplida", colorClass: "bg-green-50 text-green-700 border-green-200" },
  SOBRE_PRODUCIDA: { label: "Sobre-producida", colorClass: "bg-amber-100 text-amber-800 border-amber-300" },
  NO_APLICA: { label: "No aplica", colorClass: "bg-slate-50 text-slate-400 border-slate-100" },
};

export function getProductionStateLabel(status: QuotationProductionStatus): StatusLabelInfo {
  return PRODUCTION_STATE_LABELS[status];
}

export interface QuotationRow {
  id: string;
  documentNumber: string;
  customerName: string;
  timestamp: any;
  origin: QuotationOrigin;
  quotationStatus: string;
  linkedDocument: string | null;
  productionStatus: QuotationProductionStatus;
}

/** Fila de `/admin/quotations`. Reusa `buildQueueRow` (queueLogic.ts) tal cual para el eje de producción. */
export function buildQuotationRow(quote: Sale, fulfillmentLogs: any[]): QuotationRow {
  const hasMetallicItems = (quote.items ?? []).some(
    (item: SaleItem) => item.businessLine === "metallic-roofing",
  );

  const productionStatus: QuotationProductionStatus = hasMetallicItems
    ? buildQueueRow(quote, fulfillmentLogs).status
    : "NO_APLICA";

  const origin = getQuotationOrigin(quote);
  const linkedDocument =
    origin === "IMPORTADA"
      ? ((quote as any).relatedSaleId ?? null)
      : ((quote as any).convertedToId ?? null);

  return {
    id: quote.id || "",
    documentNumber: quote.documentNumber || "",
    customerName: quote.customerName || "",
    timestamp: quote.timestamp,
    origin,
    quotationStatus: quote.status,
    linkedDocument,
    productionStatus,
  };
}
