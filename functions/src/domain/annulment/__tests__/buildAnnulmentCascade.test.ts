import { describe, it, expect } from "vitest";
import { buildAnnulmentCascade } from "../buildAnnulmentCascade";

// Porteado 1:1 desde src/core/sales/annulment/__tests__/buildAnnulmentCascade.test.ts
// (TANDA A de [CASCADE-DUP], 2026-08-26) — la copia server no tenía test standalone
// propio, solo el parity contra la copia cliente. Mismos 12 casos, mismos asserts,
// misma semántica en los 12.
//
// ⚠️ ÚNICA ADAPTACIÓN (de forma, no de semántica): `baseSale` del test cliente
// extiende el tipo `Sale` completo (customerName/items/totalAmount/totalCost/
// sellerId/timestamp) porque `AnnulmentSaleInput` cliente es `Sale & {...}`.
// `AnnulmentSaleInput` server es una interfaz recortada a los 4 campos que la
// función REALMENTE lee (id, documentNumber?, relatedQuotationId?, originQuoteId?
// — ver docstring en buildAnnulmentCascade.ts server, y el diff verbatim del
// recon PASO 0/[CASCADE-DUP]). `baseSale` acá solo trae esos 4 (los 2 que este
// archivo usa: id, documentNumber) — mismo patrón que ya usa
// buildAnnulmentCascade.parity.test.ts. Ninguna aserción cambia: la función nunca
// leyó los campos que se recortan.
const baseSale = {
  id: "V-1",
  documentNumber: "F001-100",
};

describe("buildAnnulmentCascade", () => {
  it("twinPath orphan -> writes.length === 1, solo sale, campos correctos", () => {
    const plan = buildAnnulmentCascade({
      sale: baseSale,
      twinPath: "orphan",
      userEmail: "tester@ayr.com",
    });

    expect(plan.writes).toHaveLength(1);
    expect(plan.writes[0]).toEqual({
      target: "sale",
      docPath: "sales/V-1",
      op: "update",
      fields: {
        status: "VOIDED",
        voidedAt: "SERVER_TIMESTAMP",
        voidedBy: "tester@ayr.com",
      },
    });
  });

  it("twinPath native -> writes.length === 2, sale VOIDED + quote QUOTATION con annulledSaleRef + deletes", () => {
    const plan = buildAnnulmentCascade({
      sale: { ...baseSale, originQuoteId: "C-NAT-1" },
      twinPath: "native",
      userEmail: "tester@ayr.com",
    });

    expect(plan.writes).toHaveLength(2);
    expect(plan.writes[0].target).toBe("sale");
    expect(plan.writes[0].fields).toEqual({
      status: "VOIDED",
      voidedAt: "SERVER_TIMESTAMP",
      voidedBy: "tester@ayr.com",
    });

    const quoteWrite = plan.writes[1];
    expect(quoteWrite.target).toBe("quote");
    expect(quoteWrite.docPath).toBe("sales/C-NAT-1");
    expect(quoteWrite.op).toBe("update");
    expect(quoteWrite.fields).toEqual({
      status: "QUOTATION",
      updatedAt: "SERVER_TIMESTAMP",
      annulledSaleRef: {
        saleId: "V-1",
        saleNumber: "F001-100",
        annulledAt: "SERVER_TIMESTAMP",
        annulledBy: "tester@ayr.com",
      },
      convertedToId: "DELETE_FIELD",
      approvedAt: "DELETE_FIELD",
      costSyncedAt: "DELETE_FIELD",
    });
  });

  it("twinPath imported (INVERTIDO) -> writes.length === 2, quote recibe status:'CANCELLED' + annulledSaleRefs ARRAY_UNION (la percha sale de la cola de producción)", () => {
    const plan = buildAnnulmentCascade({
      sale: { ...baseSale, relatedQuotationId: "COT-IMP-1" },
      twinPath: "imported",
      userEmail: "tester@ayr.com",
    });

    expect(plan.writes).toHaveLength(2);
    const quoteWrite = plan.writes[1];
    expect(quoteWrite.target).toBe("quote");
    expect(quoteWrite.docPath).toBe("sales/COT-IMP-1");
    expect(Object.keys(quoteWrite.fields)).toEqual(["status", "annulledSaleRefs"]);
    expect(quoteWrite.fields.status).toBe("CANCELLED");
    expect(quoteWrite.fields.productionStatus).toBeUndefined();
    expect(quoteWrite.fields.isFulfilled).toBeUndefined();

    const expectedRef = JSON.stringify({
      saleId: "V-1",
      saleNumber: "F001-100",
      annulledAt: "SERVER_TIMESTAMP",
      annulledBy: "tester@ayr.com",
    });
    expect(quoteWrite.fields.annulledSaleRefs).toBe(`ARRAY_UNION:${expectedRef}`);
  });

  it("reason presente (native) -> aparece en sale.voidedReason Y en annulledSaleRef.reason", () => {
    const plan = buildAnnulmentCascade({
      sale: { ...baseSale, originQuoteId: "C-NAT-2" },
      twinPath: "native",
      userEmail: "tester@ayr.com",
      reason: "Error de digitación",
    });

    expect(plan.writes[0].fields.voidedReason).toBe("Error de digitación");
    const quoteFields = plan.writes[1].fields as { annulledSaleRef: { reason?: string } };
    expect(quoteFields.annulledSaleRef.reason).toBe("Error de digitación");
  });

  it("reason presente (imported) -> aparece en sale.voidedReason Y en el JSON de annulledSaleRefs", () => {
    const plan = buildAnnulmentCascade({
      sale: { ...baseSale, relatedQuotationId: "COT-IMP-2" },
      twinPath: "imported",
      userEmail: "tester@ayr.com",
      reason: "Devolución del cliente",
    });

    expect(plan.writes[0].fields.voidedReason).toBe("Devolución del cliente");
    const refRaw = plan.writes[1].fields.annulledSaleRefs as string;
    expect(refRaw.startsWith("ARRAY_UNION:")).toBe(true);
    const parsed = JSON.parse(refRaw.replace("ARRAY_UNION:", ""));
    expect(parsed.reason).toBe("Devolución del cliente");
  });

  it("reason ausente -> voidedReason NO esta en fields, reason NO esta en el ref (native)", () => {
    const plan = buildAnnulmentCascade({
      sale: { ...baseSale, originQuoteId: "C-NAT-3" },
      twinPath: "native",
      userEmail: "tester@ayr.com",
    });

    expect("voidedReason" in plan.writes[0].fields).toBe(false);
    const quoteFields = plan.writes[1].fields as { annulledSaleRef: Record<string, unknown> };
    expect("reason" in quoteFields.annulledSaleRef).toBe(false);
  });

  it("documentNumber ausente -> saleNumber === sale.id (fallback)", () => {
    const { documentNumber, ...saleSinDocNumber } = baseSale;
    const plan = buildAnnulmentCascade({
      sale: { ...saleSinDocNumber, originQuoteId: "C-NAT-4" },
      twinPath: "native",
      userEmail: "tester@ayr.com",
    });

    const quoteFields = plan.writes[1].fields as { annulledSaleRef: { saleNumber: string } };
    expect(quoteFields.annulledSaleRef.saleNumber).toBe("V-1");
  });

  it("auditDetails contiene twinPath y auditAction es VOID_SALE", () => {
    const plan = buildAnnulmentCascade({
      sale: { ...baseSale, relatedQuotationId: "COT-IMP-3" },
      twinPath: "imported",
      userEmail: "tester@ayr.com",
    });

    expect(plan.auditAction).toBe("VOID_SALE");
    expect(plan.auditDetails).toContain("imported");
    expect(plan.auditDetails).toContain("V-1");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // TANDA A2 (2026-08-26) — 2 casos portados desde buildAnnulmentCascade.parity.test.ts
  // que NO tenían equivalente acá. Son las únicas 2 aserciones del parity que ya eran
  // 100% backend-only (no comparan contra la copia cliente) — se portan verbatim,
  // sin adaptar. Las 3 `stockEffect %s: paridad` (it.each) del parity SÍ comparan
  // contra el cliente y no se portan: su contenido semántico (¿STOCK_EFFECT_LABEL
  // funciona para los 3 valores?) queda cubierto por el 2º test de este bloque.
  // ────────────────────────────────────────────────────────────────────────────

  it("omitir stockEffect === pasarlo 'returned' (default retrocompatible)", () => {
    const sale = { id: "V-1", documentNumber: "F001-100", relatedQuotationId: "COT-IMP-1" };

    expect(buildAnnulmentCascade({ sale, twinPath: "imported", userEmail: "t@ayr.com" })).toEqual(
      buildAnnulmentCascade({ sale, twinPath: "imported", userEmail: "t@ayr.com", stockEffect: "returned" }),
    );
  });

  it("el texto del audit refleja el efecto real de stock", () => {
    const sale = { id: "V-1", documentNumber: "F001-100" };
    const base = { sale, twinPath: "orphan" as const, userEmail: "t@ayr.com" };

    expect(buildAnnulmentCascade(base).auditDetails).toContain("Stock devuelto.");
    expect(buildAnnulmentCascade({ ...base, stockEffect: "withdrawn" }).auditDetails).toContain("Stock retirado.");
    expect(buildAnnulmentCascade({ ...base, stockEffect: "none" }).auditDetails).toContain("Sin efecto en stock.");
    // El motivo sigue yendo despues del efecto, con el mismo espaciado de siempre.
    expect(buildAnnulmentCascade({ ...base, stockEffect: "none", reason: "test" }).auditDetails).toBe(
      "Se anulo la venta V-1 (path: orphan). Sin efecto en stock. Motivo: test.",
    );
  });

  // ────────────────────────────────────────────────────────────────────────────
  // FIX: la percha de una venta anulada sale de la cola de producción.
  //
  // `cancelQuotation` (salesService.ts) bloquea cancelar una percha importada y le
  // dice al usuario "para revertir, anule la venta" — promesa que la cascada de
  // anulación no cumplía (solo escribía `annulledSaleRefs`, nunca `status`). Reusa
  // el mismo `status:'CANCELLED'` que `cancelQuotation` ya usa para nativas: deja
  // de matchear `PRODUCTION_QUEUE_FILTER` (que exige `status==='QUOTATION'`), sin
  // inventar un estado nuevo.
  // ────────────────────────────────────────────────────────────────────────────

  describe("Fix: percha sale de la cola al anular la venta importada", () => {
    it("imported -> quote.fields.status es 'CANCELLED'", () => {
      const plan = buildAnnulmentCascade({
        sale: { ...baseSale, relatedQuotationId: "COT-IMP-CANCEL" },
        twinPath: "imported",
        userEmail: "tester@ayr.com",
      });

      const quoteWrite = plan.writes[1];
      expect(quoteWrite.fields.status).toBe("CANCELLED");
    });

    it("imported -> annulledSaleRefs SIGUE presente (el breadcrumb existente no se pierde con el fix)", () => {
      const plan = buildAnnulmentCascade({
        sale: { ...baseSale, relatedQuotationId: "COT-IMP-CANCEL" },
        twinPath: "imported",
        userEmail: "tester@ayr.com",
      });

      const quoteWrite = plan.writes[1];
      expect(quoteWrite.fields.annulledSaleRefs).toBeDefined();
      expect(String(quoteWrite.fields.annulledSaleRefs)).toContain("ARRAY_UNION:");
    });

    it("native -> NO recibe status:'CANCELLED' (sigue revirtiendo a 'QUOTATION', comportamiento sin cambios)", () => {
      const plan = buildAnnulmentCascade({
        sale: { ...baseSale, originQuoteId: "C-NAT-CANCEL" },
        twinPath: "native",
        userEmail: "tester@ayr.com",
      });

      const quoteWrite = plan.writes[1];
      expect(quoteWrite.fields.status).toBe("QUOTATION");
    });

    it("orphan -> sin cambios: writes.length === 1, ningún write de quote", () => {
      const plan = buildAnnulmentCascade({
        sale: baseSale,
        twinPath: "orphan",
        userEmail: "tester@ayr.com",
      });

      expect(plan.writes).toHaveLength(1);
      expect(plan.writes[0].target).toBe("sale");
    });
  });
});
