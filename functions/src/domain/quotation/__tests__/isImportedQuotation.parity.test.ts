import { describe, it, expect } from "vitest";
// Cross-boundary permitido: .test.ts, excluido del build de functions/.
import { isImportedQuotation as isImportedClient } from "../../../../../src/core/import/salesImportLogic";
import { isImportedQuotation as isImportedBackend } from "../isImportedQuotation";

describe("Parity Test: isImportedQuotation (client vs functions)", () => {
  const cases: Array<{ name: string; sale: any }> = [
    { name: "null", sale: null },
    { name: "undefined", sale: undefined },
    { name: "objeto vacío (nativa recién creada)", sale: {} },
    { name: "solo relatedSaleId", sale: { relatedSaleId: "BBV1-238" } },
    { name: "solo metadata.isQuotation", sale: { metadata: { isQuotation: true } } },
    { name: "las 2 señales (percha real del importador)", sale: { relatedSaleId: "BBV1-238", metadata: { isQuotation: true } } },
    { name: "metadata sin isQuotation", sale: { metadata: { isHistorical: true } } },
    { name: "metadata null", sale: { metadata: null } },
    { name: "relatedSaleId string vacío -> falsy", sale: { relatedSaleId: "" } },
    { name: "isQuotation false explícito", sale: { metadata: { isQuotation: false } } },
    // Una nativa CONVERTIDA tiene convertedToId pero NINGUNA de las 2 señales.
    { name: "nativa convertida (convertedToId) NO es importada", sale: { convertedToId: "V-000061" } },
    // El prefijo COT- en el id NO es señal: el criterio es el dato, no la convención de id.
    { name: "id con prefijo COT- pero sin señales -> NO importada", sale: { id: "COT-XYZ" } },
  ];

  for (const { name, sale } of cases) {
    it(`paridad: ${name}`, () => {
      expect(isImportedBackend(sale)).toBe(isImportedClient(sale));
    });
  }

  it("los casos cubren ambos resultados", () => {
    const results = cases.map((c) => isImportedBackend(c.sale));
    expect(results).toContain(true);
    expect(results).toContain(false);
  });
});
