import { describe, it, expect } from "vitest";
import { canAnnulSale } from "../canAnnulSale";

describe("canAnnulSale", () => {
  it("sale null -> SALE_NOT_FOUND", () => {
    const result = canAnnulSale({ sale: null, activeProductionLogs: [] });
    expect(result).toEqual({ allowed: false, reason: "SALE_NOT_FOUND" });
  });

  it("sale VOIDED -> ALREADY_VOIDED", () => {
    const result = canAnnulSale({
      sale: { id: "V-1", status: "VOIDED" },
      activeProductionLogs: [],
    });
    expect(result).toEqual({ allowed: false, reason: "ALREADY_VOIDED" });
  });

  it("sale CANCELLED -> INVALID_STATUS", () => {
    const result = canAnnulSale({
      sale: { id: "C-1", status: "CANCELLED" },
      activeProductionLogs: [],
    });
    expect(result).toEqual({ allowed: false, reason: "INVALID_STATUS" });
  });

  it("sale CONVERTED -> INVALID_STATUS", () => {
    const result = canAnnulSale({
      sale: { id: "C-2", status: "CONVERTED" },
      activeProductionLogs: [],
    });
    expect(result).toEqual({ allowed: false, reason: "INVALID_STATUS" });
  });

  it("sale COMPLETED sin link -> allowed", () => {
    const result = canAnnulSale({
      sale: { id: "V-2", status: "COMPLETED" },
      activeProductionLogs: [],
    });
    expect(result).toEqual({ allowed: true });
  });

  it("sale COMPLETED con originQuoteId sin logs ACTIVE -> allowed", () => {
    const result = canAnnulSale({
      sale: { id: "V-3", status: "COMPLETED", originQuoteId: "C-NAT-1" },
      activeProductionLogs: [
        { id: "LOG-1", status: "VOIDED", source: { type: "QUOTE", id: "C-NAT-1" } },
      ],
    });
    expect(result).toEqual({ allowed: true });
  });

  it("sale COMPLETED con originQuoteId + log ACTIVE match -> ACTIVE_PRODUCTION con context correcto", () => {
    const result = canAnnulSale({
      sale: { id: "V-4", status: "COMPLETED", originQuoteId: "C-NAT-2" },
      activeProductionLogs: [
        { id: "LOG-2", status: "ACTIVE", source: { type: "QUOTE", id: "C-NAT-2" } },
      ],
    });
    expect(result).toEqual({
      allowed: false,
      reason: "ACTIVE_PRODUCTION",
      context: { quotationId: "C-NAT-2", activeLogIds: ["LOG-2"] },
    });
  });

  it("sale COMPLETED con relatedQuotationId + log ACTIVE match -> ACTIVE_PRODUCTION", () => {
    const result = canAnnulSale({
      sale: { id: "IMP-1", status: "COMPLETED", relatedQuotationId: "COT-IMP-1" },
      activeProductionLogs: [
        { id: "LOG-3", status: "ACTIVE", source: { type: "QUOTE", id: "COT-IMP-1" } },
      ],
    });
    expect(result).toEqual({
      allowed: false,
      reason: "ACTIVE_PRODUCTION",
      context: { quotationId: "COT-IMP-1", activeLogIds: ["LOG-3"] },
    });
  });

  it("sale COMPLETED con relatedQuotationId + log CUMPLIDA (no ACTIVE) -> allowed", () => {
    const result = canAnnulSale({
      sale: { id: "IMP-2", status: "COMPLETED", relatedQuotationId: "COT-IMP-2" },
      activeProductionLogs: [
        { id: "LOG-4", status: "VOIDED", source: { type: "QUOTE", id: "COT-IMP-2" } },
      ],
    });
    expect(result).toEqual({ allowed: true });
  });

  it("sale con AMBOS relatedQuotationId y originQuoteId -> usa relatedQuotationId (precedencia)", () => {
    const result = canAnnulSale({
      sale: {
        id: "X-1",
        status: "COMPLETED",
        relatedQuotationId: "COT-X",
        originQuoteId: "C-Y",
      },
      activeProductionLogs: [
        { id: "LOG-5", status: "ACTIVE", source: { type: "QUOTE", id: "COT-X" } },
        { id: "LOG-6", status: "ACTIVE", source: { type: "QUOTE", id: "C-Y" } },
      ],
    });
    expect(result).toEqual({
      allowed: false,
      reason: "ACTIVE_PRODUCTION",
      context: { quotationId: "COT-X", activeLogIds: ["LOG-5"] },
    });
  });

  it("multiples logs ACTIVE para la misma quotationId -> activeLogIds junta todos", () => {
    const result = canAnnulSale({
      sale: { id: "V-5", status: "COMPLETED", originQuoteId: "C-NAT-3" },
      activeProductionLogs: [
        { id: "LOG-7", status: "ACTIVE", source: { type: "QUOTE", id: "C-NAT-3" } },
        { id: "LOG-8", status: "ACTIVE", source: { type: "QUOTE", id: "C-NAT-3" } },
      ],
    });
    expect(result).toEqual({
      allowed: false,
      reason: "ACTIVE_PRODUCTION",
      context: { quotationId: "C-NAT-3", activeLogIds: ["LOG-7", "LOG-8"] },
    });
  });
});
