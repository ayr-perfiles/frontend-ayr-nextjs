import { describe, it, expect } from "vitest";
import { buildAnnulmentCascade as buildClient } from "../../../../../src/core/sales/annulment/buildAnnulmentCascade";
import { buildAnnulmentCascade as buildBackend } from "../buildAnnulmentCascade";

// La copia cliente tipa `sale: Sale & {...}` (Sale con campos obligatorios:
// customerName/items/totalAmount/totalCost/status/sellerId/timestamp). La copia
// backend simplificó a solo los 4 campos que la función lee (ver nota en
// buildAnnulmentCascade.ts). El parity test compara el OUTPUT sobre los mismos
// 4 campos relevantes — el resto del shape Sale no afecta el resultado.
const baseSaleFields = {
  id: "V-1",
  documentNumber: "F001-100",
  customerName: "CLIENTE X",
  items: [],
  totalAmount: 100,
  totalCost: 50,
  status: "COMPLETED" as const,
  sellerId: "SISTEMA",
  timestamp: null,
};

describe("Parity Test: buildAnnulmentCascade (client vs functions)", () => {
  it("orphan", () => {
    const backendResult = buildBackend({
      sale: { id: "V-1", documentNumber: "F001-100" },
      twinPath: "orphan",
      userEmail: "tester@ayr.com",
    });
    const clientResult = buildClient({
      sale: baseSaleFields,
      twinPath: "orphan",
      userEmail: "tester@ayr.com",
    });
    expect(backendResult).toEqual(clientResult);
  });

  it("native con reason", () => {
    const backendResult = buildBackend({
      sale: { id: "V-1", documentNumber: "F001-100", originQuoteId: "C-NAT-1" },
      twinPath: "native",
      userEmail: "tester@ayr.com",
      reason: "Error de digitación",
    });
    const clientResult = buildClient({
      sale: { ...baseSaleFields, originQuoteId: "C-NAT-1" },
      twinPath: "native",
      userEmail: "tester@ayr.com",
      reason: "Error de digitación",
    });
    expect(backendResult).toEqual(clientResult);
  });

  it("imported sin reason", () => {
    const backendResult = buildBackend({
      sale: { id: "V-1", documentNumber: "F001-100", relatedQuotationId: "COT-IMP-1" },
      twinPath: "imported",
      userEmail: "tester@ayr.com",
    });
    const clientResult = buildClient({
      sale: { ...baseSaleFields, relatedQuotationId: "COT-IMP-1" },
      twinPath: "imported",
      userEmail: "tester@ayr.com",
    });
    expect(backendResult).toEqual(clientResult);
  });

  it("documentNumber ausente -> saleNumber fallback a id (ambas copias)", () => {
    const { documentNumber, ...saleSinDocNumber } = baseSaleFields;
    const backendResult = buildBackend({
      sale: { id: "V-1", originQuoteId: "C-NAT-4" },
      twinPath: "native",
      userEmail: "tester@ayr.com",
    });
    const clientResult = buildClient({
      sale: { ...saleSinDocNumber, originQuoteId: "C-NAT-4" },
      twinPath: "native",
      userEmail: "tester@ayr.com",
    });
    expect(backendResult).toEqual(clientResult);
  });
});
