import { describe, it, expect } from "vitest";
import {
  getQuotationOrigin,
  getQuotationStateLabel,
  getProductionStateLabel,
  buildQuotationRow,
  canEditQuotation,
  canAcceptQuotation,
  type QuotationRow,
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

// ── E3: canEditQuotation (allowlist origen × estado) ─────────────────────────
describe("canEditQuotation (E3-2)", () => {
  const row = (origin: string, quotationStatus: string): QuotationRow =>
    ({
      id: "C-000021",
      documentNumber: "",
      customerName: "CLIENTE",
      timestamp: null,
      origin: origin as QuotationRow["origin"],
      quotationStatus,
      linkedDocument: null,
      productionStatus: "PENDIENTE",
    }) as QuotationRow;

  // Las 4 combinaciones origen × estado: SOLO una es editable.
  it("NATIVA + QUOTATION -> editable (unico caso true)", () => {
    expect(canEditQuotation(row("NATIVA", "QUOTATION"))).toBe(true);
  });

  it("IMPORTADA + QUOTATION -> NO editable (D1: es el espejo de una factura emitida)", () => {
    expect(canEditQuotation(row("IMPORTADA", "QUOTATION"))).toBe(false);
  });

  it("NATIVA + CANCELLED -> NO editable", () => {
    expect(canEditQuotation(row("NATIVA", "CANCELLED"))).toBe(false);
  });

  it("IMPORTADA + CANCELLED -> NO editable", () => {
    expect(canEditQuotation(row("IMPORTADA", "CANCELLED"))).toBe(false);
  });

  // Allowlist: cualquier estado que no sea exactamente QUOTATION queda fuera.
  it.each(["CONVERTED", "COMPLETED", "VOIDED", "", "quotation", "QUOTATION "])(
    "NATIVA + %s -> NO editable (allowlist estricta, sensible a mayusculas y espacios)",
    (status) => {
      expect(canEditQuotation(row("NATIVA", status))).toBe(false);
    },
  );

  it("origen desconocido -> NO editable (default deniega)", () => {
    expect(canEditQuotation(row("OTRO", "QUOTATION"))).toBe(false);
  });

  it("row null/undefined -> NO editable, no lanza", () => {
    expect(canEditQuotation(null as unknown as QuotationRow)).toBe(false);
    expect(canEditQuotation(undefined as unknown as QuotationRow)).toBe(false);
  });
});

// ── U2: canAcceptQuotation ([QUOTATION-APPROVE-UNREACHABLE], COLA #1) ────────
// La accion de aceptacion se gatea en la capa de LOGICA, no en la pagina React:
// mismo patron que ya ancla canEditQuotation, y el unico harness disponible
// (medido en la Tanda 6, T0.4). El RED de este bloque es lo que autoriza a
// escribir el boton — sin el, la condicion de U2.2 no se escribe (v6.80.0).
describe("canAcceptQuotation (U2)", () => {
  const row = (
    origin: string,
    quotationStatus: string,
    clientAccepted?: boolean,
  ): QuotationRow =>
    ({
      id: "C-000022",
      documentNumber: "",
      customerName: "CLIENTE",
      timestamp: null,
      origin: origin as QuotationRow["origin"],
      quotationStatus,
      linkedDocument: null,
      productionStatus: "PENDIENTE",
      clientAccepted,
    }) as QuotationRow;

  it("NATIVA + QUOTATION + sin aceptar -> aceptable (unico caso true)", () => {
    expect(canAcceptQuotation(row("NATIVA", "QUOTATION", undefined))).toBe(true);
    expect(canAcceptQuotation(row("NATIVA", "QUOTATION", false))).toBe(true);
  });

  // U2.2: la accion NO aparece si ya esta aceptada. Espeja el guard de
  // idempotencia de markQuotationAccepted -- el boton nunca ofrece algo que el
  // escritor va a rechazar (mismo criterio que canEditQuotation vs editQuotation).
  it("NATIVA + QUOTATION + YA aceptada -> NO aceptable", () => {
    expect(canAcceptQuotation(row("NATIVA", "QUOTATION", true))).toBe(false);
  });

  it("IMPORTADA + QUOTATION -> NO aceptable (nace de una factura ya emitida)", () => {
    expect(canAcceptQuotation(row("IMPORTADA", "QUOTATION", false))).toBe(false);
  });

  // Allowlist estricta, mismo criterio que canEditQuotation: cualquier estado que
  // no sea exactamente QUOTATION queda fuera, incluido uno nuevo que se agregue.
  it.each(["CANCELLED", "CONVERTED", "COMPLETED", "VOIDED", "", "quotation", "QUOTATION "])(
    "NATIVA + %s -> NO aceptable",
    (status) => {
      expect(canAcceptQuotation(row("NATIVA", status, false))).toBe(false);
    },
  );

  it("origen desconocido -> NO aceptable (default deniega)", () => {
    expect(canAcceptQuotation(row("OTRO", "QUOTATION", false))).toBe(false);
  });

  it("row null/undefined -> NO aceptable, no lanza", () => {
    expect(canAcceptQuotation(null as unknown as QuotationRow)).toBe(false);
    expect(canAcceptQuotation(undefined as unknown as QuotationRow)).toBe(false);
  });
});

// buildQuotationRow tiene que PROPAGAR el flag: si no lo lleva a la fila, el gate
// de arriba nunca puede ver una cotizacion ya aceptada y el boton reaparece.
describe("buildQuotationRow propaga clientAccepted (U2)", () => {
  it("lleva clientAccepted del doc a la fila", () => {
    const aceptada = buildQuotationRow(
      { ...mkQuote({ id: "C-000023" }), clientAccepted: true } as never,
      [],
    );
    expect(aceptada.clientAccepted).toBe(true);

    const sinAceptar = buildQuotationRow(mkQuote({ id: "C-000024" }), []);
    expect(sinAceptar.clientAccepted).toBeFalsy();
  });
});
