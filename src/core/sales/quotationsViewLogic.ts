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
  /**
   * El cliente ya aceptó esta cotización ([QUOTATION-APPROVE-UNREACHABLE], COLA #1).
   * Eje ADITIVO, independiente de `quotationStatus` — aceptar no es vender.
   */
  clientAccepted?: boolean;
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
    clientAccepted: (quote as any).clientAccepted === true,
  };
}

/**
 * ¿Esta cotización es editable? (E3-2, allowlist)
 *
 * Espeja EXACTAMENTE lo que el callable `editQuotation` acepta, para que el botón nunca
 * ofrezca algo que el backend va a rechazar:
 *   - D1: solo origen NATIVA (una percha importada es el espejo de una factura emitida).
 *   - solo estado `QUOTATION` (una CANCELLED/CONVERTED no se edita).
 *
 * Allowlist estricta y sensible a mayúsculas: cualquier otro origen o estado —incluido uno
 * nuevo que se agregue en el futuro— queda FUERA por defecto. Mismo criterio que
 * `canDuplicate` (salesDisplayLogic.ts).
 *
 * NO cubre el bloqueo por producción activa: eso no se puede saber desde la fila (haría
 * falta la query de `production_logs`). Lo aplica el callable y la UI lo muestra con el
 * modal de bloqueo.
 */
export function canEditQuotation(row: QuotationRow | null | undefined): boolean {
  if (!row) return false;
  return row.origin === "NATIVA" && row.quotationStatus === "QUOTATION";
}

/**
 * ¿Se puede marcar que el CLIENTE ACEPTÓ esta cotización? ([QUOTATION-APPROVE-UNREACHABLE],
 * COLA #1, U2.2).
 *
 * ⚠️ ACEPTAR NO ES VENDER: la acción que este gate habilita solo escribe
 * `clientAccepted` + `clientAcceptedAt`. No mueve stock ni cambia `status`.
 *
 * Espeja EXACTAMENTE lo que `markQuotationAccepted` (`salesService.ts`) acepta, para
 * que el botón nunca ofrezca algo que el escritor va a rechazar — mismo criterio que
 * `canEditQuotation` vs `editQuotation`:
 *   - solo origen NATIVA (una percha importada nace de una factura ya emitida: el
 *     cliente no "acepta" lo que ya compró);
 *   - solo estado `QUOTATION`;
 *   - solo si NO fue aceptada todavía (el escritor es idempotente y rechaza la
 *     segunda vez, para no pisar el timestamp original, que es el dato de auditoría).
 *
 * Allowlist estricta y sensible a mayúsculas: cualquier otro origen o estado —incluido
 * uno nuevo que se agregue en el futuro— queda FUERA por defecto.
 */
export function canAcceptQuotation(row: QuotationRow | null | undefined): boolean {
  if (!row) return false;
  return (
    row.origin === "NATIVA" &&
    row.quotationStatus === "QUOTATION" &&
    row.clientAccepted !== true
  );
}
