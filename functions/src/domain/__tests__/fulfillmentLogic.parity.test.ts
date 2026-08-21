import { describe, it, expect } from "vitest";
// Cross-boundary permitido: este es un .test.ts (excluido del build de functions/,
// mismo patrón que los parity tests de src/domain/annulment/__tests__/).
import { hasActiveProduction as hasActiveClient } from "../../../../src/core/production/fulfillmentLogic";
import { hasActiveProduction as hasActiveBackend } from "../fulfillmentLogic";

describe("Parity Test: hasActiveProduction (client vs functions)", () => {
  const cases: Array<{ name: string; logs: { status?: string }[] }> = [
    { name: "array vacío", logs: [] },
    { name: "un ACTIVE", logs: [{ status: "ACTIVE" }] },
    { name: "un VOIDED", logs: [{ status: "VOIDED" }] },
    { name: "mezcla ACTIVE + VOIDED", logs: [{ status: "VOIDED" }, { status: "ACTIVE" }] },
    { name: "todos VOIDED", logs: [{ status: "VOIDED" }, { status: "VOIDED" }] },
    { name: "status ausente", logs: [{}] },
    { name: "status desconocido", logs: [{ status: "PENDIENTE" }] },
    // Sensible a mayúsculas a propósito: el escritor real siempre graba "ACTIVE".
    { name: "minúsculas 'active' NO cuenta", logs: [{ status: "active" }] },
  ];

  for (const { name, logs } of cases) {
    it(`paridad: ${name}`, () => {
      expect(hasActiveBackend(logs)).toBe(hasActiveClient(logs));
    });
  }

  it("los 8 casos cubren ambos resultados (true y false)", () => {
    const results = cases.map((c) => hasActiveBackend(c.logs));
    expect(results).toContain(true);
    expect(results).toContain(false);
  });
});
