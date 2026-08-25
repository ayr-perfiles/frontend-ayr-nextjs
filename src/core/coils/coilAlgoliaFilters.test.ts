import { describe, it, expect } from "vitest";
import { buildCoilAlgoliaFilters } from "./coilAlgoliaFilters";

/**
 * El bug (medido contra el índice real, 2026-08-25): `metadata.provider` se
 * interpola crudo en el string de filters. TODOS los providers de prod (13/13)
 * tienen espacios — Algolia rechaza el string con
 * "Unexpected token string(PERU) expected end of filter".
 * Un valor con espacios debe ir entre comillas dobles (y las comillas internas
 * escapadas) para ser un facet filter válido.
 */

describe("buildCoilAlgoliaFilters — provider con espacios (el bug)", () => {
  it("envuelve en comillas un provider con espacios (valor real de prod)", () => {
    const out = buildCoilAlgoliaFilters(
      { statusFilter: "ALL", providerFilter: "TREAM PERU S.A.C." },
      "inventory",
    );
    expect(out).toBe(
      'NOT status:VOIDED AND metadata.provider:"TREAM PERU S.A.C."',
    );
  });

  it("envuelve en comillas un provider con paréntesis (valor real de prod)", () => {
    const out = buildCoilAlgoliaFilters(
      { statusFilter: "ALL", providerFilter: "J Y J (sin identificar en Itemizado)" },
      "export",
    );
    expect(out).toBe(
      'metadata.provider:"J Y J (sin identificar en Itemizado)"',
    );
  });

  it("escapa comillas dobles dentro del valor", () => {
    const out = buildCoilAlgoliaFilters(
      { statusFilter: "ALL", providerFilter: 'ACME "EL BUENO" S.A.C.' },
      "export",
    );
    expect(out).toBe('metadata.provider:"ACME \\"EL BUENO\\" S.A.C."');
  });
});

describe("buildCoilAlgoliaFilters — anclas de no-regresión (comportamiento vigente)", () => {
  it("inventory + ALL sin otros filtros → NOT status:VOIDED", () => {
    expect(buildCoilAlgoliaFilters({ statusFilter: "ALL" }, "inventory")).toBe(
      "NOT status:VOIDED",
    );
  });

  it("export + ALL sin otros filtros → string vacío (VOIDED incluido)", () => {
    expect(buildCoilAlgoliaFilters({ statusFilter: "ALL" }, "export")).toBe("");
  });

  it("status concreto igual en ambos modos", () => {
    expect(
      buildCoilAlgoliaFilters({ statusFilter: "AVAILABLE" }, "inventory"),
    ).toBe("status:AVAILABLE");
    expect(
      buildCoilAlgoliaFilters({ statusFilter: "AVAILABLE" }, "export"),
    ).toBe("status:AVAILABLE");
  });

  it("finish y currency (sin espacios en prod) se interpolan directo", () => {
    const out = buildCoilAlgoliaFilters(
      {
        statusFilter: "AVAILABLE",
        finishFilter: "ALZ-NATURAL",
        currencyFilter: "USD",
      },
      "inventory",
    );
    expect(out).toBe(
      "status:AVAILABLE AND finish:ALZ-NATURAL AND metadata.currency:USD",
    );
  });

  it('finishFilter/currencyFilter "ALL" o ausentes no agregan cláusula', () => {
    const out = buildCoilAlgoliaFilters(
      { statusFilter: "ALL", finishFilter: "ALL", currencyFilter: "ALL" },
      "inventory",
    );
    expect(out).toBe("NOT status:VOIDED");
  });

  it("providerFilter vacío o solo espacios no agrega cláusula", () => {
    expect(
      buildCoilAlgoliaFilters(
        { statusFilter: "ALL", providerFilter: "   " },
        "inventory",
      ),
    ).toBe("NOT status:VOIDED");
  });

  it("los 4 filtros juntos se unen con AND en orden status→finish→currency→provider", () => {
    const out = buildCoilAlgoliaFilters(
      {
        statusFilter: "IN_PROGRESS",
        finishFilter: "GALV",
        currencyFilter: "PEN",
        providerFilter: "MARELIAC S.R.L.",
      },
      "export",
    );
    expect(out).toBe(
      'status:IN_PROGRESS AND finish:GALV AND metadata.currency:PEN AND metadata.provider:"MARELIAC S.R.L."',
    );
  });
});
