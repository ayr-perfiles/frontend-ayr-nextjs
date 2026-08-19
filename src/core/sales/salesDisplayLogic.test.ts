import { describe, it, expect } from "vitest";
import {
  resolveCustomerDoc,
  getSaleStatusBadge,
  canDuplicate,
  duplicateIntentFromStatus,
  parseDuplicateIntent,
} from "./salesDisplayLogic";

describe("salesDisplayLogic - resolveCustomerDoc", () => {
  it("Venta nueva del POS (customerDocument presente, documentNumber vacío) -> Extrae rucDni y comprobante es null", () => {
    const sale = {
      customerDocument: "72248284",
      documentNumber: "",
    };
    const result = resolveCustomerDoc(sale);
    expect(result.rucDni).toBe("72248284");
    expect(result.comprobante).toBeNull();
  });

  it("Venta legacy (documentNumber presente, SIN customerDocument) -> Fallback legacy extrae RUC y comprobante es null", () => {
    const sale = {
      customerDocument: undefined,
      documentNumber: "20608931156",
    };
    const result = resolveCustomerDoc(sale);
    expect(result.rucDni).toBe("20608931156");
    expect(result.comprobante).toBeNull();
  });

  it("Venta importada (customerDocument = RUC, documentNumber = BBV1-324) -> Extrae RUC y Comprobante correcto", () => {
    const sale = {
      customerDocument: "76334430",
      documentNumber: "BBV1-324",
    };
    const result = resolveCustomerDoc(sale);
    expect(result.rucDni).toBe("76334430");
    expect(result.comprobante).toBe("BBV1-324");
  });

  it("Venta con ambos vacíos -> rucDni es '---' y comprobante null", () => {
    const sale = {
      customerDocument: "",
      documentNumber: "",
    };
    const result = resolveCustomerDoc(sale);
    expect(result.rucDni).toBe("---");
    expect(result.comprobante).toBeNull();
  });
});

describe("salesDisplayLogic - getSaleStatusBadge (Frente #9-A: fix binario SalesHistoryTable)", () => {
  it("COMPLETED -> Venta Cerrada", () => {
    expect(getSaleStatusBadge("COMPLETED").label).toBe("Venta Cerrada");
  });

  it("QUOTATION -> Cotización", () => {
    expect(getSaleStatusBadge("QUOTATION").label).toBe("Cotización");
  });

  it("VOIDED -> Anulada (antes se pintaba como 'Cotización', bug binario)", () => {
    expect(getSaleStatusBadge("VOIDED").label).toBe("Anulada");
  });

  it("CANCELLED -> Cancelada (antes se pintaba como 'Cotización')", () => {
    expect(getSaleStatusBadge("CANCELLED").label).toBe("Cancelada");
  });

  it("CONVERTED -> Convertida (antes se pintaba como 'Cotización')", () => {
    expect(getSaleStatusBadge("CONVERTED").label).toBe("Convertida");
  });

  it("status desconocido o undefined -> fallback con el valor crudo o guion, nunca 'Cotización' por defecto", () => {
    expect(getSaleStatusBadge("RARO").label).toBe("RARO");
    expect(getSaleStatusBadge(undefined).label).toBe("—");
  });
});

describe("salesDisplayLogic - canDuplicate (#9-B.2a: gating del botón Duplicar)", () => {
  it("COMPLETED -> true", () => {
    expect(canDuplicate("COMPLETED")).toBe(true);
  });

  it("QUOTATION -> true", () => {
    expect(canDuplicate("QUOTATION")).toBe(true);
  });

  it("VOIDED -> false", () => {
    expect(canDuplicate("VOIDED")).toBe(false);
  });

  it("CANCELLED -> false", () => {
    expect(canDuplicate("CANCELLED")).toBe(false);
  });

  it("CONVERTED -> false", () => {
    expect(canDuplicate("CONVERTED")).toBe(false);
  });

  it("undefined -> false (allowlist, status nuevo/desconocido queda oculto por defecto)", () => {
    expect(canDuplicate(undefined)).toBe(false);
  });
});

describe("salesDisplayLogic - duplicateIntentFromStatus (#9-B.2a-2: default por tipo al duplicar)", () => {
  it("COMPLETED -> 'SALE'", () => {
    expect(duplicateIntentFromStatus("COMPLETED")).toBe("SALE");
  });

  it("QUOTATION -> 'QUOTE'", () => {
    expect(duplicateIntentFromStatus("QUOTATION")).toBe("QUOTE");
  });

  it("VOIDED -> null (fuera de la allowlist de duplicable, sin intent)", () => {
    expect(duplicateIntentFromStatus("VOIDED")).toBeNull();
  });

  it("string basura -> null", () => {
    expect(duplicateIntentFromStatus("RARO")).toBeNull();
  });
});

describe("salesDisplayLogic - parseDuplicateIntent (#9-B.2a-2: whitelist estricta del query param ?as=)", () => {
  it("'SALE' -> 'SALE'", () => {
    expect(parseDuplicateIntent("SALE")).toBe("SALE");
  });

  it("'QUOTE' -> 'QUOTE'", () => {
    expect(parseDuplicateIntent("QUOTE")).toBe("QUOTE");
  });

  it("null -> null", () => {
    expect(parseDuplicateIntent(null)).toBeNull();
  });

  it("undefined -> null", () => {
    expect(parseDuplicateIntent(undefined)).toBeNull();
  });

  it("string vacío -> null", () => {
    expect(parseDuplicateIntent("")).toBeNull();
  });

  it("string basura -> null (sin uppercase-coerce: 'sale' minúscula NO cuenta)", () => {
    expect(parseDuplicateIntent("sale")).toBeNull();
    expect(parseDuplicateIntent("XYZ")).toBeNull();
  });
});
