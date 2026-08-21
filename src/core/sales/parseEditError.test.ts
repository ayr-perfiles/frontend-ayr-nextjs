import { describe, it, expect } from "vitest";
import { parseEditError } from "./parseEditError";

/**
 * `editQuotation` emite DOS guards distintos con `failed-precondition` + `details.quotationId`:
 *   - producción activa : { quotationId, activeLogIds: [...] }
 *   - importada         : { quotationId }            <- SIN activeLogIds
 *
 * Por eso `parseAnnulError` NO sirve acá: discrimina por la presencia de `quotationId`
 * (parseAnnulError.ts:50-57), que está en los dos, y clasificaría la importada como
 * "production-block". El discriminante correcto es `activeLogIds` NO VACÍO.
 */

/** Imita el FunctionsError del SDK cliente (que prefija el code con `functions/`). */
const err = (code: string, message: string, details?: unknown) =>
  Object.assign(new Error(message), { code, details });

describe("parseEditError", () => {
  // ── el discriminante que motiva este helper ────────────────────────────────
  it("failed-precondition CON activeLogIds no vacío -> production-block", () => {
    const r = parseEditError(
      err("functions/failed-precondition", "tiene producción activa", {
        quotationId: "C-000021",
        activeLogIds: ["LOG-1"],
      }),
    );
    expect(r.type).toBe("production-block");
    expect(r.quotationId).toBe("C-000021");
    expect(r.activeLogIds).toEqual(["LOG-1"]);
  });

  it("failed-precondition SIN activeLogIds (importada) -> imported, NO production-block", () => {
    const r = parseEditError(
      err("functions/failed-precondition", "Una cotización importada no se edita: …", {
        quotationId: "COT-BBV1-238",
      }),
    );
    expect(r.type).toBe("imported");
    expect(r.quotationId).toBe("COT-BBV1-238");
    expect(r.activeLogIds).toBeUndefined();
  });

  it("failed-precondition con activeLogIds VACÍO -> NO es production-block", () => {
    const r = parseEditError(
      err("functions/failed-precondition", "Una cotización importada no se edita", {
        quotationId: "COT-X",
        activeLogIds: [],
      }),
    );
    expect(r.type).toBe("imported");
  });

  it("failed-precondition sin details (status ≠ QUOTATION) -> not-editable", () => {
    const r = parseEditError(
      err("functions/failed-precondition", "Solo se puede editar una cotización vigente (estado actual: COMPLETED)."),
    );
    expect(r.type).toBe("not-editable");
    expect(r.message).toContain("COMPLETED");
  });

  // ── el resto de los guards del callable ────────────────────────────────────
  it("not-found", () => {
    expect(parseEditError(err("functions/not-found", "La cotización no existe.")).type).toBe("not-found");
  });

  it("permission-denied", () => {
    expect(parseEditError(err("functions/permission-denied", "Solo ADMIN puede editar cotizaciones.")).type).toBe(
      "permission",
    );
  });

  it("unauthenticated", () => {
    expect(parseEditError(err("functions/unauthenticated", "Login requerido")).type).toBe("unauthenticated");
  });

  it("invalid-argument", () => {
    expect(parseEditError(err("functions/invalid-argument", "quotationId es obligatorio.")).type).toBe(
      "invalid-argument",
    );
  });

  // ── bordes ────────────────────────────────────────────────────────────────
  it("error sin code -> other, con el mensaje preservado", () => {
    const r = parseEditError(new Error("boom de red"));
    expect(r.type).toBe("other");
    expect(r.message).toBe("boom de red");
  });

  it("code no-string -> other", () => {
    expect(parseEditError(err(42 as unknown as string, "raro")).type).toBe("other");
  });

  it("null / undefined / string suelto -> other con mensaje por defecto", () => {
    expect(parseEditError(null).type).toBe("other");
    expect(parseEditError(undefined).message).toBe("Ocurrió un error inesperado.");
    expect(parseEditError("texto suelto").type).toBe("other");
  });

  it("details null no rompe", () => {
    const r = parseEditError(err("functions/failed-precondition", "algo", null));
    expect(r.type).toBe("not-editable");
  });

  it("activeLogIds que no es array se ignora", () => {
    const r = parseEditError(
      err("functions/failed-precondition", "x", { quotationId: "C-1", activeLogIds: "LOG-1" }),
    );
    expect(r.type).toBe("imported");
    expect(r.activeLogIds).toBeUndefined();
  });

  it("quotationId ausente con activeLogIds presente -> production-block igual (el bloqueo manda)", () => {
    const r = parseEditError(err("functions/failed-precondition", "produccion", { activeLogIds: ["L-9"] }));
    expect(r.type).toBe("production-block");
    expect(r.activeLogIds).toEqual(["L-9"]);
  });
});
