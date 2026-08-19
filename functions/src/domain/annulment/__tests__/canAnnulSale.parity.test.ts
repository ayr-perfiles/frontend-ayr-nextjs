import { describe, it, expect } from "vitest";
import { canAnnulSale as canAnnulClient } from "../../../../../src/core/sales/annulment/canAnnulSale";
import { canAnnulSale as canAnnulBackend } from "../canAnnulSale";

describe("Parity Test: canAnnulSale (client vs functions)", () => {
  const cases: Array<{ name: string; input: Parameters<typeof canAnnulBackend>[0] }> = [
    { name: "sale null", input: { sale: null, activeProductionLogs: [] } },
    { name: "VOIDED", input: { sale: { id: "V-1", status: "VOIDED" }, activeProductionLogs: [] } },
    { name: "CANCELLED", input: { sale: { id: "C-1", status: "CANCELLED" }, activeProductionLogs: [] } },
    {
      name: "COMPLETED sin link",
      input: { sale: { id: "V-2", status: "COMPLETED" }, activeProductionLogs: [] },
    },
    {
      name: "COMPLETED + originQuoteId + log ACTIVE match",
      input: {
        sale: { id: "V-4", status: "COMPLETED", originQuoteId: "C-NAT-2" },
        activeProductionLogs: [{ id: "LOG-2", status: "ACTIVE", source: { type: "QUOTE", id: "C-NAT-2" } }],
      },
    },
    {
      name: "COMPLETED + relatedQuotationId + log CUMPLIDA (no ACTIVE)",
      input: {
        sale: { id: "IMP-2", status: "COMPLETED", relatedQuotationId: "COT-IMP-2" },
        activeProductionLogs: [{ id: "LOG-4", status: "VOIDED", source: { type: "QUOTE", id: "COT-IMP-2" } }],
      },
    },
    {
      name: "ambos relatedQuotationId y originQuoteId -> precedencia relatedQuotationId",
      input: {
        sale: { id: "X-1", status: "COMPLETED", relatedQuotationId: "COT-X", originQuoteId: "C-Y" },
        activeProductionLogs: [
          { id: "LOG-5", status: "ACTIVE", source: { type: "QUOTE", id: "COT-X" } },
          { id: "LOG-6", status: "ACTIVE", source: { type: "QUOTE", id: "C-Y" } },
        ],
      },
    },
  ];

  for (const { name, input } of cases) {
    it(`paridad: ${name}`, () => {
      expect(canAnnulBackend(input)).toEqual(canAnnulClient(input as any));
    });
  }
});
