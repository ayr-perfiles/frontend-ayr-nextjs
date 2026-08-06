import { describe, it, expect } from "vitest";
import {
  isQuoteFulfilled,
  productionUnitCostBySku,
  applyCostCascade,
} from "./quoteFulfillment";

describe("Frente A1 — quoteFulfillment Domain Logic", () => {
  // Fixture real de FFA1-1289 en producción
  const realSaleFFA1_1289 = {
    status: "COMPLETED",
    customerName: "EL FERRETERO DEL DRYWALL E.I.R.L.",
    customerDocument: "20606811145",
    documentNumber: "FFA1-1289",
    businessLines: ["metallic-roofing"],
    skus: ["COB030AZUL", "COB030ROJO"],
    items: [
      {
        sku: "COB030AZUL",
        productName: "COBERTURA DE ALUZINC 0.30MM COLOR AZUL",
        quantity: 300,
        unitPrice: 11.3,
        unitValue: 9.57627,
        baseCost: 7.87417,
        businessLine: "metallic-roofing",
        profit: 510.62999999999965,
        flags: ["sin peso", "sin costo"],
        unitWeight: 0,
        calculatedWeight: 0,
        unitOfMeasure: "METRO LINEAL",
        isCoil: false,
      },
      {
        sku: "COB030ROJO",
        productName: "COBERTURA DE ALUZINC 0.30MM COLOR ROJO",
        quantity: 821.5,
        unitPrice: 11.3,
        unitValue: 9.576271454656117,
        baseCost: 7.860585,
        businessLine: "metallic-roofing",
        profit: 1409.4364225,
        flags: ["sin peso"],
        unitWeight: 0,
        calculatedWeight: 0,
        unitOfMeasure: "METRO LINEAL",
        isCoil: false,
      },
    ],
    totalAmount: 12672.95,
    totalCost: 8819.7215775,
    totalProfit: 1920.0664224999996,
    totalWeight: 0,
    allFlags: ["sin peso", "sin costo"],
    paymentStatus: "PAID",
  };

  const prodCostBySku = {
    COB030ROJO: 7.991239,
    COB030AZUL: 7.573644,
  };

  describe("RED-1 (cascada de costos a la venta)", () => {
    it("aplica costo de producción real a cada SKU y recalcula profit, totalCost y totalProfit", () => {
      const updated = applyCostCascade(realSaleFFA1_1289, prodCostBySku);

      // 1. Ítem AZUL: costo baja de 7.87417 a 7.573644 -> profit sube de 510.63 a 600.79
      const itemAzul = updated.items.find((i: any) => i.sku === "COB030AZUL");
      expect(itemAzul.baseCost).toBe(7.573644);
      expect(itemAzul.profit).toBeCloseTo((9.57627 - 7.573644) * 300, 2); // ~600.79
      expect(itemAzul.profit).toBeCloseTo(600.79, 2);
      expect(itemAzul.costSource).toBe("PRODUCTION");
      expect(itemAzul.flags).not.toContain("sin costo");

      // 2. Ítem ROJO: costo sube de 7.860585 a 7.991239 -> profit baja de 1409.44 a 1302.10
      const itemRojo = updated.items.find((i: any) => i.sku === "COB030ROJO");
      expect(itemRojo.baseCost).toBe(7.991239);
      expect(itemRojo.profit).toBeCloseTo((9.576271454656117 - 7.991239) * 821.5, 2); // ~1302.10
      expect(itemRojo.profit).toBeCloseTo(1302.10, 2);
      expect(itemRojo.costSource).toBe("PRODUCTION");

      // 3. Totales de la venta
      // totalCost: 8,819.72 -> 8,836.90
      expect(updated.totalCost).toBeCloseTo(7.573644 * 300 + 7.991239 * 821.5, 2);
      expect(updated.totalCost).toBeCloseTo(8836.90, 2);

      // totalProfit: 1,920.07 -> 1,902.89
      expect(updated.totalProfit).toBeCloseTo(600.7878 + 1302.10416, 2);
      expect(updated.totalProfit).toBeCloseTo(1902.89, 2);

      // totalAmount intacto
      expect(updated.totalAmount).toBe(12672.95);

      // allFlags: 'sin costo' debe removerse
      expect(updated.allFlags).not.toContain("sin costo");
      expect(updated.allFlags).toContain("sin peso");
    });
  });

  describe("RED-2 (CUMPLIDA server-side)", () => {
    const quoteItems = [
      { sku: "COB030AZUL", quantity: 300, businessLine: "metallic-roofing" },
      { sku: "COB030ROJO", quantity: 821.5, businessLine: "metallic-roofing" },
    ];

    it("retorna false si solo se cubrió 1 de los 2 SKUs requeridos", () => {
      const logs = [
        {
          sku: "COB030ROJO",
          piecesProduced: 1200, // 1200 > 1121.5 total agregado, pero 0 AZUL!
          status: "ACTIVE",
          stripCost: 9600.00,
        },
      ];
      expect(isQuoteFulfilled(quoteItems, logs)).toBe(false);
    });

    it("retorna false si un log que cubría la cuota fue anulado (VOIDED)", () => {
      const logs = [
        {
          sku: "COB030ROJO",
          piecesProduced: 821.5,
          status: "ACTIVE",
          stripCost: 6564.80,
        },
        {
          sku: "COB030AZUL",
          piecesProduced: 300,
          status: "VOIDED",
          stripCost: 2272.09,
        },
      ];
      expect(isQuoteFulfilled(quoteItems, logs)).toBe(false);
    });

    it("retorna true cuando ambos SKUs están cubiertos dentro de la tolerancia EPSILON (0.01)", () => {
      const logs = [
        {
          sku: "COB030ROJO",
          piecesProduced: 821.5,
          status: "ACTIVE",
          stripCost: 6564.8029,
        },
        {
          sku: "COB030AZUL",
          piecesProduced: 299.995, // 300 - 0.005 >= 300 - 0.01 -> dentro de EPSILON
          status: "ACTIVE",
          stripCost: 2272.0933,
        },
      ];
      expect(isQuoteFulfilled(quoteItems, logs)).toBe(true);
    });
  });

  describe("RED-3 (Idempotencia y No-Ops)", () => {
    it("aplicar applyCostCascade dos veces consecutivas produce el mismo resultado determinístico", () => {
      const run1 = applyCostCascade(realSaleFFA1_1289, prodCostBySku);
      const run2 = applyCostCascade(run1, prodCostBySku);

      expect(run2.totalCost).toBe(run1.totalCost);
      expect(run2.totalProfit).toBe(run1.totalProfit);
      expect(run2.items[0].baseCost).toBe(run1.items[0].baseCost);
      expect(run2.items[0].profit).toBe(run1.items[0].profit);
      expect(run2.items[1].baseCost).toBe(run1.items[1].baseCost);
      expect(run2.items[1].profit).toBe(run1.items[1].profit);
    });

    it("no modifica líneas no-metallic o SKUs no presentes en costBySku", () => {
      const mixedSale = {
        totalAmount: 500,
        totalCost: 250,
        totalProfit: 250,
        items: [
          {
            sku: "PERF-DRYWALL-64",
            businessLine: "drywall",
            quantity: 10,
            unitPrice: 20,
            unitValue: 20,
            baseCost: 10,
            profit: 100,
          },
          {
            sku: "COB030ROJO",
            businessLine: "metallic-roofing",
            quantity: 10,
            unitPrice: 30,
            unitValue: 30,
            baseCost: 15,
            profit: 150,
          },
        ],
      };

      const costBySkuOnlyRojo = { COB030ROJO: 18 };
      const updated = applyCostCascade(mixedSale, costBySkuOnlyRojo);

      // PERF-DRYWALL-64 queda intacto
      const drywallItem = updated.items.find((i: any) => i.sku === "PERF-DRYWALL-64");
      expect(drywallItem.baseCost).toBe(10);
      expect(drywallItem.profit).toBe(100);

      // COB030ROJO se actualiza con baseCost 18 y profit (30-18)*10 = 120
      const rojoItem = updated.items.find((i: any) => i.sku === "COB030ROJO");
      expect(rojoItem.baseCost).toBe(18);
      expect(rojoItem.profit).toBe(120);

      // Totales: totalCost = 10*10 + 18*10 = 280, totalProfit = 100 + 120 = 220
      expect(updated.totalCost).toBe(280);
      expect(updated.totalProfit).toBe(220);
    });
  });

  describe("productionUnitCostBySku", () => {
    it("calcula el promedio ponderado ΣcostPEN ÷ ΣpiecesProduced ignorando logs VOIDED", () => {
      const logs = [
        {
          sku: "COB030ROJO",
          piecesProduced: 100,
          stripCost: 800,
          status: "ACTIVE",
        },
        {
          sku: "COB030ROJO",
          piecesProduced: 100,
          stripCost: 820,
          status: "ACTIVE",
        },
        {
          sku: "COB030ROJO",
          piecesProduced: 50,
          stripCost: 500,
          status: "VOIDED", // Ignorado
        },
        {
          sku: "COB030AZUL",
          piecesProduced: 50,
          stripCost: 375,
          status: "ACTIVE",
        },
      ];

      const costs = productionUnitCostBySku(logs);
      // ROJO: (800 + 820) / (100 + 100) = 1620 / 200 = 8.10
      expect(costs.COB030ROJO).toBe(8.10);
      // AZUL: 375 / 50 = 7.50
      expect(costs.COB030AZUL).toBe(7.50);
    });
  });
});
