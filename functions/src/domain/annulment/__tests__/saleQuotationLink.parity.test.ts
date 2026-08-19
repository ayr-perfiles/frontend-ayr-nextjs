import { describe, it, expect } from "vitest";
import { resolveSaleQuotationLink as resolveClient } from "../../../../../src/core/sales/saleProductionLink";
import { resolveSaleQuotationLink as resolveBackend } from "../saleQuotationLink";

describe("Parity Test: resolveSaleQuotationLink (client vs functions)", () => {
  const cases = [
    { id: "C-000020", status: "QUOTATION" },
    { id: "BBV1-238", status: "COMPLETED", relatedQuotationId: "COT-BBV1-238" },
    { id: "BBV1-253", status: "COMPLETED" },
    { id: "X-1", status: "COMPLETED", relatedQuotationId: "" },
    { id: "X-2", status: "COMPLETED", relatedQuotationId: "   " },
    { id: "X-3", status: "VOIDED", relatedQuotationId: "COT-X-3" },
    { id: "V-000045", status: "COMPLETED", originQuoteId: "C-000123" },
    { id: "X-4", status: "COMPLETED", relatedQuotationId: "COT-X", originQuoteId: "C-Y" },
    { id: "X-5", status: "COMPLETED", originQuoteId: "   " },
  ];

  for (const input of cases) {
    it(`paridad para ${JSON.stringify(input)}`, () => {
      expect(resolveBackend(input)).toEqual(resolveClient(input));
    });
  }
});
