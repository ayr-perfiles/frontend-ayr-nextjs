import { describe, it, expect } from "vitest";
import { resolveSaleTwinPath as resolveClient } from "../../../../../src/core/sales/annulment/resolveSaleTwinPath";
import { resolveSaleTwinPath as resolveBackend } from "../resolveSaleTwinPath";

describe("Parity Test: resolveSaleTwinPath (client vs functions)", () => {
  const cases = [
    { id: "V-1", status: "COMPLETED" },
    { id: "C-1", status: "QUOTATION" },
    { id: "V-2", status: "COMPLETED", originQuoteId: "C-NAT-1" },
    { id: "IMP-1", status: "COMPLETED", relatedQuotationId: "COT-IMP-1" },
    { id: "X-1", status: "COMPLETED", relatedQuotationId: "COT-X", originQuoteId: "C-Y" },
    { id: "X-2", status: "COMPLETED", originQuoteId: "   " },
    { id: "X-3", status: "COMPLETED", relatedQuotationId: "   ", originQuoteId: "C-NAT-2" },
    { id: "X-4", status: "VOIDED", relatedQuotationId: "COT-X-4" },
  ];

  for (const input of cases) {
    it(`paridad para ${JSON.stringify(input)}`, () => {
      expect(resolveBackend(input)).toBe(resolveClient(input));
    });
  }
});
