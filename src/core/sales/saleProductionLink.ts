import type { Sale } from "@/types";

export type SaleQuotationLink =
  | { mode: "self"; quotationId: string }
  | { mode: "linked"; quotationId: string }
  | { mode: "none" };

/**
 * Input de lectura: `relatedQuotationId` (percha importada, COT-*) y `originQuoteId`
 * (cotización nativa convertida, C-*) NO están en el shape canónico de escritura de
 * `Sale` — son campos de lectura escritos por el importador / `approveQuotation`
 * respectivamente. Se extienden acá vía Pick, mismo patrón que `AluzincSaleRead`
 * (aluzincDetalleLogic.ts) — NO se agregan al `Sale` canónico.
 */
export type SaleQuotationLinkInput = Pick<Sale, "id" | "status"> & {
  relatedQuotationId?: string;
  originQuoteId?: string;
};

export function resolveSaleQuotationLink(sale: SaleQuotationLinkInput): SaleQuotationLink {
  if (sale.status === "QUOTATION") {
    return { mode: "self", quotationId: sale.id ?? "" };
  }

  const relatedQuotationId = sale.relatedQuotationId?.trim();
  if (relatedQuotationId) {
    return { mode: "linked", quotationId: relatedQuotationId };
  }

  const originQuoteId = sale.originQuoteId?.trim();
  if (originQuoteId) {
    return { mode: "linked", quotationId: originQuoteId };
  }

  return { mode: "none" };
}
