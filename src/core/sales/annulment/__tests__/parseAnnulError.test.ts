import { describe, it, expect } from "vitest";
import { parseAnnulError } from "../parseAnnulError";

describe("parseAnnulError", () => {
  it("production-block: failed-precondition con details.quotationId + activeLogIds -> extract correcto", () => {
    const error = {
      code: "functions/failed-precondition",
      message: "No se puede anular la venta: la cotización vinculada COT-X tiene producción activa.",
      details: { quotationId: "COT-X", activeLogIds: ["LOG-1", "LOG-2"] },
    };
    const result = parseAnnulError(error);
    expect(result).toEqual({
      type: "production-block",
      quotationId: "COT-X",
      activeLogIds: ["LOG-1", "LOG-2"],
      message: error.message,
    });
  });

  it("already-voided: failed-precondition sin quotationId, mensaje matchea /ya.*anulada/i", () => {
    const error = {
      code: "functions/failed-precondition",
      message: "Esta venta ya ha sido anulada.",
    };
    const result = parseAnnulError(error);
    expect(result.type).toBe("already-voided");
    expect(result.message).toBe(error.message);
  });

  it("not-found -> type not-found", () => {
    const error = { code: "functions/not-found", message: "La venta no existe." };
    const result = parseAnnulError(error);
    expect(result.type).toBe("not-found");
    expect(result.message).toBe(error.message);
  });

  it("permission-denied -> type permission", () => {
    const error = { code: "functions/permission-denied", message: "Solo ADMIN o SUPERVISOR pueden anular ventas." };
    const result = parseAnnulError(error);
    expect(result.type).toBe("permission");
  });

  it("unauthenticated -> type unauthenticated", () => {
    const error = { code: "functions/unauthenticated", message: "Login requerido" };
    const result = parseAnnulError(error);
    expect(result.type).toBe("unauthenticated");
  });

  it("invalid-argument -> type invalid-argument", () => {
    const error = { code: "functions/invalid-argument", message: "saleId es obligatorio." };
    const result = parseAnnulError(error);
    expect(result.type).toBe("invalid-argument");
  });

  it("error sin code -> type other, fallback message", () => {
    const error = new Error("Network error");
    const result = parseAnnulError(error);
    expect(result.type).toBe("other");
    expect(result.message).toBe("Network error");
  });

  it("error completamente desconocido (no Error, no code) -> type other, mensaje generico", () => {
    const result = parseAnnulError("string suelto");
    expect(result.type).toBe("other");
    expect(result.message).toBeTruthy();
  });

  it("failed-precondition con details.quotationId presente pero SIN activeLogIds -> production-block igual, activeLogIds undefined", () => {
    const error = {
      code: "functions/failed-precondition",
      message: "producción activa",
      details: { quotationId: "COT-Y" },
    };
    const result = parseAnnulError(error);
    expect(result.type).toBe("production-block");
    expect(result.quotationId).toBe("COT-Y");
    expect(result.activeLogIds).toBeUndefined();
  });
});
