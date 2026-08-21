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

  // stockEffect (v6.53.1) — aditivo. El default preserva el detalle historico.
  it.each(["returned", "withdrawn", "none"] as const)("stockEffect %s: paridad", (stockEffect) => {
    const backendResult = buildBackend({
      sale: { id: "V-1", documentNumber: "F001-100", relatedQuotationId: "COT-IMP-1" },
      twinPath: "imported",
      userEmail: "tester@ayr.com",
      stockEffect,
    });
    const clientResult = buildClient({
      sale: { ...baseSaleFields, relatedQuotationId: "COT-IMP-1" },
      twinPath: "imported",
      userEmail: "tester@ayr.com",
      stockEffect,
    });
    expect(backendResult).toEqual(clientResult);
  });

  it("omitir stockEffect === pasarlo 'returned' (default retrocompatible, ambas copias)", () => {
    const sale = { id: "V-1", documentNumber: "F001-100", relatedQuotationId: "COT-IMP-1" };
    const clientSale = { ...baseSaleFields, relatedQuotationId: "COT-IMP-1" };

    expect(buildBackend({ sale, twinPath: "imported", userEmail: "t@ayr.com" })).toEqual(
      buildBackend({ sale, twinPath: "imported", userEmail: "t@ayr.com", stockEffect: "returned" }),
    );
    expect(buildClient({ sale: clientSale, twinPath: "imported", userEmail: "t@ayr.com" })).toEqual(
      buildClient({ sale: clientSale, twinPath: "imported", userEmail: "t@ayr.com", stockEffect: "returned" }),
    );
  });

  it("el texto del audit refleja el efecto real de stock (backend)", () => {
    const sale = { id: "V-1", documentNumber: "F001-100" };
    const base = { sale, twinPath: "orphan" as const, userEmail: "t@ayr.com" };

    expect(buildBackend(base).auditDetails).toContain("Stock devuelto.");
    expect(buildBackend({ ...base, stockEffect: "withdrawn" }).auditDetails).toContain("Stock retirado.");
    expect(buildBackend({ ...base, stockEffect: "none" }).auditDetails).toContain("Sin efecto en stock.");
    // El motivo sigue yendo despues del efecto, con el mismo espaciado de siempre.
    expect(buildBackend({ ...base, stockEffect: "none", reason: "test" }).auditDetails).toBe(
      "Se anulo la venta V-1 (path: orphan). Sin efecto en stock. Motivo: test.",
    );
  });
});
