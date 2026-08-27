import { describe, it, expect } from "vitest";
import { canAnnulSale } from "../canAnnulSale";

// Porteado 1:1 desde src/core/sales/annulment/__tests__/canAnnulSale.test.ts (TANDA A
// de [CASCADE-DUP], 2026-08-26) — la copia server no tenía test standalone propio,
// solo el parity contra la copia cliente. Mismos 11 casos, mismos inputs, mismos
// asserts. `SaleQuotationLinkInput` server (id?/status?/relatedQuotationId?/
// originQuoteId?, todos opcionales) es estructuralmente compatible con los objetos
// planos que ya usaba el test cliente — cero adaptación de shape necesaria.

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

  // ────────────────────────────────────────────────────────────────────────────
  // TANDA B ([CASCADE-DUP], 2026-08-27) — 5 casos `self` (status QUOTATION)
  // portados desde canAnnulSale.parity.test.ts, que se borra en este mismo
  // frente. Cubren el fix v6.52.1: antes de esa version, el bloqueo por
  // produccion ACTIVE solo aplicaba a `mode==='linked'`; una cotizacion en
  // QUOTATION con produccion viva se anulaba sin bloqueo. `self` y `linked`
  // comparten el mismo criterio desde entonces (canAnnulSale.ts:44). Fixtures
  // copiados verbatim del parity; los resultados esperados se derivan de la
  // MISMA logica (resolveSaleQuotationLink + el filtro de
  // activeProductionLogs), no de una relectura del parity.
  // ────────────────────────────────────────────────────────────────────────────

  describe("mode self (status QUOTATION, fix v6.52.1)", () => {
    it("QUOTATION nativa sin logs -> allowed", () => {
      const result = canAnnulSale({
        sale: { id: "C-NAT-9", status: "QUOTATION" },
        activeProductionLogs: [],
      });
      expect(result).toEqual({ allowed: true });
    });

    it("QUOTATION nativa CON log ACTIVE propio -> ACTIVE_PRODUCTION", () => {
      const result = canAnnulSale({
        sale: { id: "C-NAT-9", status: "QUOTATION" },
        activeProductionLogs: [
          { id: "LOG-9", status: "ACTIVE", source: { type: "QUOTE", id: "C-NAT-9" } },
        ],
      });
      expect(result).toEqual({
        allowed: false,
        reason: "ACTIVE_PRODUCTION",
        context: { quotationId: "C-NAT-9", activeLogIds: ["LOG-9"] },
      });
    });

    it("QUOTATION nativa con log VOIDED propio -> no bloquea (allowed)", () => {
      const result = canAnnulSale({
        sale: { id: "C-NAT-9", status: "QUOTATION" },
        activeProductionLogs: [
          { id: "LOG-10", status: "VOIDED", source: { type: "QUOTE", id: "C-NAT-9" } },
        ],
      });
      expect(result).toEqual({ allowed: true });
    });

    it("percha IMPORTADA en QUOTATION con log ACTIVE (tambien es mode self) -> ACTIVE_PRODUCTION", () => {
      const result = canAnnulSale({
        sale: { id: "COT-IMP-9", status: "QUOTATION", relatedQuotationId: "COT-IMP-9" },
        activeProductionLogs: [
          { id: "LOG-11", status: "ACTIVE", source: { type: "QUOTE", id: "COT-IMP-9" } },
        ],
      });
      expect(result).toEqual({
        allowed: false,
        reason: "ACTIVE_PRODUCTION",
        context: { quotationId: "COT-IMP-9", activeLogIds: ["LOG-11"] },
      });
    });

    it("QUOTATION con log ACTIVE de OTRA cotizacion -> no debe bloquear (allowed)", () => {
      const result = canAnnulSale({
        sale: { id: "C-NAT-9", status: "QUOTATION" },
        activeProductionLogs: [
          { id: "LOG-12", status: "ACTIVE", source: { type: "QUOTE", id: "C-OTRA" } },
        ],
      });
      expect(result).toEqual({ allowed: true });
    });
  });
});
