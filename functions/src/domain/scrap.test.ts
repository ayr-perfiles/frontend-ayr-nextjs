import { expect, test, describe } from "vitest";
import { validateScrapRequest as validateClient } from "../../../src/core/coils/domain/scrap";
import { validateScrapRequest as validateBackend, determineCoilStatusAfterReversal } from "./scrap";

describe("Parity Test: validateScrapRequest", () => {
  const cases = [
    {
      name: "válido (ADMIN, peso>0, reason no vacío)",
      inputs: { scrapWeightKg: 10, reason: "Merma por corte", role: "ADMIN" },
      shouldThrow: false,
    },
    {
      name: "role !== 'ADMIN'",
      inputs: { scrapWeightKg: 10, reason: "Merma", role: "OPERATOR" },
      shouldThrow: true,
    },
    {
      name: "role null",
      inputs: { scrapWeightKg: 10, reason: "Merma", role: null },
      shouldThrow: true,
    },
    {
      name: "peso <= 0",
      inputs: { scrapWeightKg: 0, reason: "Merma", role: "ADMIN" },
      shouldThrow: true,
    },
    {
      name: "peso negativo",
      inputs: { scrapWeightKg: -5, reason: "Merma", role: "ADMIN" },
      shouldThrow: true,
    },
    {
      name: "peso NaN/no numérico",
      inputs: { scrapWeightKg: NaN, reason: "Merma", role: "ADMIN" },
      shouldThrow: true,
    },
    {
      name: "reason vacío",
      inputs: { scrapWeightKg: 10, reason: "", role: "ADMIN" },
      shouldThrow: true,
    },
    {
      name: "reason whitespace",
      inputs: { scrapWeightKg: 10, reason: "   ", role: "ADMIN" },
      shouldThrow: true,
    },
  ];

  test.each(cases)("$name", ({ inputs, shouldThrow }) => {
    const runClient = () =>
      validateClient(inputs.scrapWeightKg, inputs.reason, inputs.role);
    const runBackend = () =>
      validateBackend(inputs.scrapWeightKg, inputs.reason, inputs.role);

    if (shouldThrow) {
      expect(runClient).toThrow();
      expect(runBackend).toThrow();

      // Verificar que los mensajes de error son IDÉNTICOS
      let errCMessage = "";
      let errBMessage = "";
      try { runClient(); } catch (e: any) { errCMessage = e.message; }
      try { runBackend(); } catch (e: any) { errBMessage = e.message; }
      
      expect(errBMessage).toBe(errCMessage);
    } else {
      expect(runClient).not.toThrow();
      expect(runBackend).not.toThrow();
    }
  });
});

describe("determineCoilStatusAfterReversal", () => {
  // Mismo EPSILON=0.01 que el cliente (voidProductionFromCoils)
  const cases = [
    { newWeight: 1000, initial: 1000, expected: "AVAILABLE", name: "borde exacto" },
    { newWeight: 999.995, initial: 1000, expected: "AVAILABLE", name: "dentro de ε" },
    { newWeight: 800, initial: 1000, expected: "IN_PROGRESS", name: "consumo parcial" },
    { newWeight: 200, initial: 1000, expected: "IN_PROGRESS", name: "salida de PROCESSED" },
    { newWeight: 1000.5, initial: 1000, expected: "AVAILABLE", name: "sobre-peso no rompe" },
  ];

  test.each(cases)("$name: newWeight=$newWeight, initial=$initial -> $expected", ({ newWeight, initial, expected }) => {
    expect(determineCoilStatusAfterReversal(newWeight, initial)).toBe(expected);
  });
});
