import { describe, it, expect } from "vitest";
// FAILS IN RED! src/core/sales/productionConfirmationLogic.ts todavía no existe.
import { canConfirmForProduction } from "./productionConfirmationLogic";

describe("canConfirmForProduction - predicado puro (RED PHASE)", () => {
  it("1. Sin ítems metallic-roofing -> false (aunque productionStatus sea PENDING)", () => {
    const sale = {
      productionStatus: "PENDING",
      items: [{ sku: "P25GALV", businessLine: "drywall", quantity: 10 }],
    };
    expect(canConfirmForProduction(sale)).toBe(false);
  });

  it("2. Ya CONFIRMED -> false (no se puede volver a confirmar, one-way)", () => {
    const sale = {
      productionStatus: "CONFIRMED",
      items: [{ sku: "COB030ROJO", businessLine: "metallic-roofing", quantity: 100 }],
    };
    expect(canConfirmForProduction(sale)).toBe(false);
  });

  it("3. Metallic en PRIMERA posición + PENDING -> true", () => {
    const sale = {
      productionStatus: "PENDING",
      items: [
        { sku: "COB030ROJO", businessLine: "metallic-roofing", quantity: 100 },
        { sku: "P25GALV", businessLine: "drywall", quantity: 10 },
      ],
    };
    expect(canConfirmForProduction(sale)).toBe(true);
  });

  it("4. Metallic en ÚLTIMA posición + PENDING -> true (demuestra que no solo lee items[0])", () => {
    const sale = {
      productionStatus: "PENDING",
      items: [
        { sku: "P25GALV", businessLine: "drywall", quantity: 10 },
        { sku: "TRAD-01", businessLine: "trading", quantity: 5 },
        { sku: "COB030ROJO", businessLine: "metallic-roofing", quantity: 100 },
      ],
    };
    expect(canConfirmForProduction(sale)).toBe(true);
  });

  it("5. Cotización legacy SIN campo productionStatus (como las 23 de prod) + metallic -> true (se trata como PENDING)", () => {
    const sale = {
      items: [{ sku: "COB030ROJO", businessLine: "metallic-roofing", quantity: 100 }],
    };
    expect(canConfirmForProduction(sale)).toBe(true);
  });
});
