import { describe, it, expect } from "vitest";
import { resolveSaleQuotationLink } from "./saleProductionLink";

describe("resolveSaleQuotationLink", () => {
  it("status QUOTATION -> self, quotationId = sale.id", () => {
    const result = resolveSaleQuotationLink({ id: "C-000020", status: "QUOTATION" });
    expect(result).toEqual({ mode: "self", quotationId: "C-000020" });
  });

  it("COMPLETED + relatedQuotationId -> linked (importada COT-*)", () => {
    const result = resolveSaleQuotationLink({
      id: "BBV1-238",
      status: "COMPLETED",
      relatedQuotationId: "COT-BBV1-238",
    });
    expect(result).toEqual({ mode: "linked", quotationId: "COT-BBV1-238" });
  });

  it("COMPLETED sin relatedQuotationId ni originQuoteId -> none", () => {
    const result = resolveSaleQuotationLink({ id: "BBV1-253", status: "COMPLETED" });
    expect(result).toEqual({ mode: "none" });
  });

  it("COMPLETED + relatedQuotationId vacio '' -> none", () => {
    const result = resolveSaleQuotationLink({
      id: "X-1",
      status: "COMPLETED",
      relatedQuotationId: "",
    });
    expect(result).toEqual({ mode: "none" });
  });

  it("COMPLETED + relatedQuotationId solo espacios '   ' -> none", () => {
    const result = resolveSaleQuotationLink({
      id: "X-2",
      status: "COMPLETED",
      relatedQuotationId: "   ",
    });
    expect(result).toEqual({ mode: "none" });
  });

  it("VOIDED + relatedQuotationId -> linked", () => {
    const result = resolveSaleQuotationLink({
      id: "X-3",
      status: "VOIDED",
      relatedQuotationId: "COT-X-3",
    });
    expect(result).toEqual({ mode: "linked", quotationId: "COT-X-3" });
  });

  it("COMPLETED + originQuoteId (sin relatedQuotationId) -> linked (nativa convertida C-*)", () => {
    const result = resolveSaleQuotationLink({
      id: "V-000045",
      status: "COMPLETED",
      originQuoteId: "C-000123",
    });
    expect(result).toEqual({ mode: "linked", quotationId: "C-000123" });
  });

  it("COMPLETED + relatedQuotationId Y originQuoteId -> linked por relatedQuotationId (precedencia: importada gana)", () => {
    const result = resolveSaleQuotationLink({
      id: "X-4",
      status: "COMPLETED",
      relatedQuotationId: "COT-X",
      originQuoteId: "C-Y",
    });
    expect(result).toEqual({ mode: "linked", quotationId: "COT-X" });
  });

  it("COMPLETED + originQuoteId solo espacios (sin relatedQuotationId) -> none", () => {
    const result = resolveSaleQuotationLink({
      id: "X-5",
      status: "COMPLETED",
      originQuoteId: "   ",
    });
    expect(result).toEqual({ mode: "none" });
  });
});
