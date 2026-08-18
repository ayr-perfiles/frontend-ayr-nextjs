import { describe, it, expect } from "vitest";
import {
  getQuotationOrigin,
  getQuotationStateLabel,
  getProductionStateLabel,
  buildQuotationRow,
} from "./quotationsViewLogic";
import type { Sale } from "@/types";

function mkQuote(overrides: Partial<Sale> & { id: string }): Sale {
  return {
    documentNumber: "",
    customerName: "CLIENTE TEST",
    status: "QUOTATION",
    timestamp: { toMillis: () => 1000 },
    items: [{ sku: "COB030ROJO", quantity: 100, businessLine: "metallic-roofing" } as any],
    ...overrides,
  } as Sale;
}

describe("getQuotationOrigin", () => {
  it("IMPORTADA: sale con relatedSaleId", () => {
    expect(getQuotationOrigin(mkQuote({ id: "COT-BBV1-238", relatedSaleId: "BBV1-238" } as any))).toBe(
      "IMPORTADA",
    );
  });

  it("IMPORTADA: sale con metadata.isQuotation", () => {
    expect(
      getQuotationOrigin(mkQuote({ id: "COT-X", metadata: { isQuotation: true } } as any)),
    ).toBe("IMPORTADA");
  });

  it("NATIVA: sale sin ninguno de los 2 marcadores", () => {
    expect(getQuotationOrigin(mkQuote({ id: "C-000020" }))).toBe("NATIVA");
  });
});

describe("getQuotationStateLabel", () => {
  it("QUOTATION -> Vigente", () => {
    expect(getQuotationStateLabel("QUOTATION").label).toBe("Vigente");
  });

  it("CANCELLED -> Cancelada", () => {
    expect(getQuotationStateLabel("CANCELLED").label).toBe("Cancelada");
  });

  it("status desconocido/undefined -> fallback con el valor crudo o guion", () => {
    expect(getQuotationStateLabel("RARO").label).toBe("RARO");
    expect(getQuotationStateLabel(undefined).label).toBe("—");
  });
});

describe("getProductionStateLabel", () => {
  it("mapea los 4 estados de buildQueueRow + NO_APLICA, cada uno con label propio", () => {
    expect(getProductionStateLabel("PENDIENTE").label).toBe("Pendiente");
    expect(getProductionStateLabel("PARCIAL").label).toBe("Parcial");
    expect(getProductionStateLabel("CUMPLIDA").label).toBe("Cumplida");
    expect(getProductionStateLabel("SOBRE_PRODUCIDA").label).toBe("Sobre-producida");
    expect(getProductionStateLabel("NO_APLICA").label).toBe("No aplica");
  });
});

describe("buildQuotationRow", () => {
  // Casos reales de prod (Frente #9-A, dueño): BBV1-280 PENDIENTE, FFA1-1059 PARCIAL, BBV1-238 CUMPLIDA.
  it("PENDIENTE: cero production_logs -> productionStatus PENDIENTE", () => {
    const quote = mkQuote({
      id: "COT-BBV1-280",
      relatedSaleId: "BBV1-280",
      items: [{ sku: "COB030AZUL", quantity: 36, businessLine: "metallic-roofing" } as any],
    } as any);
    const row = buildQuotationRow(quote, []);
    expect(row.productionStatus).toBe("PENDIENTE");
    expect(row.origin).toBe("IMPORTADA");
  });

  it("PARCIAL: production_logs cubren menos que lo pedido -> productionStatus PARCIAL", () => {
    const quote = mkQuote({
      id: "COT-FFA1-1059",
      relatedSaleId: "FFA1-1059",
      items: [{ sku: "COB030ROJO", quantity: 100, businessLine: "metallic-roofing" } as any],
    } as any);
    const logs = [{ sku: "COB030ROJO", piecesProduced: 40, status: "ACTIVE" }];
    const row = buildQuotationRow(quote, logs);
    expect(row.productionStatus).toBe("PARCIAL");
  });

  it("CUMPLIDA: production_logs cubren todo lo pedido -> productionStatus CUMPLIDA", () => {
    const quote = mkQuote({
      id: "COT-BBV1-238",
      relatedSaleId: "BBV1-238",
      items: [{ sku: "COB030ROJO", quantity: 24.5, businessLine: "metallic-roofing" } as any],
    } as any);
    const logs = [{ sku: "COB030ROJO", piecesProduced: 24.5, status: "ACTIVE" }];
    const row = buildQuotationRow(quote, logs);
    expect(row.productionStatus).toBe("CUMPLIDA");
  });

  it("NATIVA CANCELLED sin ítems metallic -> productionStatus NO_APLICA, quotationStatus CANCELLED", () => {
    const quote = mkQuote({
      id: "C-000020",
      status: "CANCELLED",
      items: [{ sku: "P25GALV", quantity: 10, businessLine: "drywall" } as any],
    } as any);
    const row = buildQuotationRow(quote, []);
    expect(row.productionStatus).toBe("NO_APLICA");
    expect(row.quotationStatus).toBe("CANCELLED");
    expect(row.origin).toBe("NATIVA");
    expect(row.linkedDocument).toBeNull();
  });

  it("linkedDocument: IMPORTADA usa relatedSaleId, NATIVA usa convertedToId", () => {
    const imported = buildQuotationRow(
      mkQuote({ id: "COT-BBV1-238", relatedSaleId: "BBV1-238" } as any),
      [],
    );
    expect(imported.linkedDocument).toBe("BBV1-238");

    const nativeConverted = buildQuotationRow(
      mkQuote({ id: "C-000015", status: "CONVERTED", convertedToId: "V-000042" } as any),
      [],
    );
    expect(nativeConverted.linkedDocument).toBe("V-000042");

    const nativePending = buildQuotationRow(mkQuote({ id: "C-000020" }), []);
    expect(nativePending.linkedDocument).toBeNull();
  });
});
