import { resolveSaleQuotationLink, type SaleQuotationLinkInput } from "./saleQuotationLink";

/** Copia server-side de src/core/sales/annulment/canAnnulSale.ts — ver nota de duplicación en saleQuotationLink.ts. */

export type AnnulBlockReason = "ALREADY_VOIDED" | "ACTIVE_PRODUCTION" | "SALE_NOT_FOUND" | "INVALID_STATUS";

export type CanAnnulResult =
  | { allowed: true }
  | { allowed: false; reason: AnnulBlockReason; context?: { quotationId?: string; activeLogIds?: string[] } };

export interface AnnulmentProductionLog {
  id: string;
  status: string;
  source?: { type: string; id: string };
}

export interface CanAnnulSaleInput {
  sale: SaleQuotationLinkInput | null;
  activeProductionLogs: AnnulmentProductionLog[];
}

export function canAnnulSale(input: CanAnnulSaleInput): CanAnnulResult {
  const { sale, activeProductionLogs } = input;

  if (!sale) {
    return { allowed: false, reason: "SALE_NOT_FOUND" };
  }

  if (sale.status === "VOIDED") {
    return { allowed: false, reason: "ALREADY_VOIDED" };
  }

  if (sale.status !== "COMPLETED" && sale.status !== "QUOTATION") {
    return { allowed: false, reason: "INVALID_STATUS" };
  }

  const link = resolveSaleQuotationLink(sale);

  if (link.mode === "linked") {
    const activeLogIds = activeProductionLogs
      .filter((log) => log.source?.id === link.quotationId && log.status === "ACTIVE")
      .map((log) => log.id);

    if (activeLogIds.length > 0) {
      return {
        allowed: false,
        reason: "ACTIVE_PRODUCTION",
        context: { quotationId: link.quotationId, activeLogIds },
      };
    }
  }

  return { allowed: true };
}
