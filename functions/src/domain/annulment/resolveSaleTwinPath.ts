import { resolveSaleQuotationLink, type SaleQuotationLinkInput } from "./saleQuotationLink";

/** Copia server-side de src/core/sales/annulment/resolveSaleTwinPath.ts — ver nota de duplicación en saleQuotationLink.ts. */

export type SaleTwinPath = "native" | "imported" | "orphan";

export function resolveSaleTwinPath(sale: SaleQuotationLinkInput): SaleTwinPath {
  const link = resolveSaleQuotationLink(sale);

  if (link.mode !== "linked") {
    return "orphan";
  }

  if (sale.relatedQuotationId?.trim()) {
    return "imported";
  }

  if (sale.originQuoteId?.trim()) {
    return "native";
  }

  return "orphan";
}
