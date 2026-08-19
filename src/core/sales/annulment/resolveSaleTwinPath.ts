import { resolveSaleQuotationLink, type SaleQuotationLinkInput } from "../saleProductionLink";

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
