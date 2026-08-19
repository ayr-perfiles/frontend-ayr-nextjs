import { describe, it, expect } from "vitest";
import { resolveSaleTwinPath } from "../resolveSaleTwinPath";

describe("resolveSaleTwinPath", () => {
  it("sale sin ningun link -> orphan", () => {
    const result = resolveSaleTwinPath({ id: "V-1", status: "COMPLETED" });
    expect(result).toBe("orphan");
  });

  it("sale status QUOTATION -> orphan (self, no twin que anular)", () => {
    const result = resolveSaleTwinPath({ id: "C-1", status: "QUOTATION" });
    expect(result).toBe("orphan");
  });

  it("sale con originQuoteId solo -> native", () => {
    const result = resolveSaleTwinPath({
      id: "V-2",
      status: "COMPLETED",
      originQuoteId: "C-NAT-1",
    });
    expect(result).toBe("native");
  });

  it("sale con relatedQuotationId solo -> imported", () => {
    const result = resolveSaleTwinPath({
      id: "IMP-1",
      status: "COMPLETED",
      relatedQuotationId: "COT-IMP-1",
    });
    expect(result).toBe("imported");
  });

  it("sale con ambos -> imported (precedencia por resolveSaleQuotationLink)", () => {
    const result = resolveSaleTwinPath({
      id: "X-1",
      status: "COMPLETED",
      relatedQuotationId: "COT-X",
      originQuoteId: "C-Y",
    });
    expect(result).toBe("imported");
  });

  it("sale con originQuoteId trim vacio (solo espacios) -> orphan", () => {
    const result = resolveSaleTwinPath({
      id: "X-2",
      status: "COMPLETED",
      originQuoteId: "   ",
    });
    expect(result).toBe("orphan");
  });

  it("sale con relatedQuotationId trim vacio + originQuoteId -> native", () => {
    const result = resolveSaleTwinPath({
      id: "X-3",
      status: "COMPLETED",
      relatedQuotationId: "   ",
      originQuoteId: "C-NAT-2",
    });
    expect(result).toBe("native");
  });

  it("sale VOIDED con relatedQuotationId -> imported (twin path no depende de status VOIDED)", () => {
    const result = resolveSaleTwinPath({
      id: "X-4",
      status: "VOIDED",
      relatedQuotationId: "COT-X-4",
    });
    expect(result).toBe("imported");
  });
});
