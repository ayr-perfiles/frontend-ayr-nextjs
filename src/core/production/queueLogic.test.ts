import { describe, it, expect } from "vitest";
import { buildQueueRow, sortQueueFifo, formatQuoteDisplayId } from "./queueLogic";

describe("queueLogic", () => {
  describe("buildQueueRow", () => {
    const baseQuote = {
      id: "COT-BBV1-316",
      documentNumber: "",
      customerName: "CLIENTE TEST",
      timestamp: { _seconds: 1780592400, _nanoseconds: 0 },
      items: [
        {
          sku: "COB030ROJO",
          productName: "COBERTURA DE ALUZINC 0.30MM COLOR ROJO",
          quantity: 31.8,
          unitOfMeasure: "METRO LINEAL",
          flags: ["sin costo", "sin peso"],
          businessLine: "metallic-roofing",
        },
      ],
    } as any;

    it("cotización sin logs -> PENDIENTE", () => {
      const row = buildQueueRow(baseQuote, []);
      expect(row.status).toBe("PENDIENTE");
      expect(row.lines[0].quantityProduced).toBe(0);
      expect(row.lines[0].pct).toBe(0);
    });

    it("1 de 2 líneas cumplida -> PARCIAL", () => {
      const quote2 = {
        ...baseQuote,
        items: [
          ...baseQuote.items,
          {
            sku: "COB035AZUL",
            productName: "COBERTURA DE ALUZINC 0.35MM COLOR AZUL",
            quantity: 50,
            businessLine: "metallic-roofing",
          },
        ],
      } as any;

      const logs = [
        { sku: "COB030ROJO", piecesProduced: 31.8, status: "ACTIVE" },
      ];

      const row = buildQueueRow(quote2, logs);
      expect(row.status).toBe("PARCIAL");
    });

    it("todas cumplidas exacto -> CUMPLIDA", () => {
      const logs = [
        { sku: "COB030ROJO", piecesProduced: 31.8, status: "ACTIVE" },
      ];
      const row = buildQueueRow(baseQuote, logs);
      expect(row.status).toBe("CUMPLIDA");
      expect(row.lines[0].pct).toBe(100);
    });

    it("una línea excedida -> SOBRE_PRODUCIDA", () => {
      const logs = [
        { sku: "COB030ROJO", piecesProduced: 31.85, status: "ACTIVE" },
      ];
      const row = buildQueueRow(baseQuote, logs);
      expect(row.status).toBe("SOBRE_PRODUCIDA");
    });

    it("logs con status VOIDED -> NO cuentan", () => {
      const logs = [
        { sku: "COB030ROJO", piecesProduced: 31.8, status: "VOIDED" },
      ];
      const row = buildQueueRow(baseQuote, logs);
      expect(row.status).toBe("PENDIENTE");
    });

    it("items[] vacío -> no explota", () => {
      const quoteEmpty = { ...baseQuote, items: [] };
      const row = buildQueueRow(quoteEmpty, []);
      expect(row.status).toBe("CUMPLIDA"); // Si no hay nada pedido, no hay nada pendiente. O podría ser PENDIENTE. Veremos.
    });

    it("FFA1-1264: agrupa items con el mismo SKU para el % de cumplimiento", () => {
      const quoteFfa = {
        id: "COT-FFA1-1264",
        items: [
          { sku: "COB030ROJO", productName: "COBERTURA DE ALUZINC TR4 0.30MM COLOR ROJO", quantity: 360, businessLine: "metallic-roofing" },
          { sku: "COB030ROJO", productName: "COBERTURA DE ALUZINC TR5 0.30MM COLOR ROJO", quantity: 1440, businessLine: "metallic-roofing" },
        ]
      } as any;

      const logs = [
        { sku: "COB030ROJO", piecesProduced: 1800, status: "ACTIVE" }
      ];

      const row = buildQueueRow(quoteFfa, logs);
      expect(row.status).toBe("CUMPLIDA"); // No SOBRE_PRODUCIDA
      expect(row.lines).toHaveLength(1); // 1 SKU = 1 linea combinada
      expect(row.lines[0].quantityRequested).toBe(1800);
      expect(row.lines[0].quantityProduced).toBe(1800);
      expect(row.lines[0].pct).toBe(100);
      // Mitigación acordada del pooling: agrupar por SKU no debe esconder que la línea
      // combinada viene de TR4 y TR5 -- ambas descripciones deben sobrevivir para el render.
      expect(row.lines[0].productNames).toContain("COBERTURA DE ALUZINC TR4 0.30MM COLOR ROJO");
      expect(row.lines[0].productNames).toContain("COBERTURA DE ALUZINC TR5 0.30MM COLOR ROJO");
      expect(row.lines[0].productNames).toHaveLength(2);
    });
  });

  describe("formatQuoteDisplayId", () => {
    it("recorta el prefijo COT- para lectura", () => {
      expect(formatQuoteDisplayId("COT-FFA1-1264")).toBe("FFA1-1264");
    });

    it("sin prefijo COT-, devuelve el id tal cual", () => {
      expect(formatQuoteDisplayId("FFA1-1264")).toBe("FFA1-1264");
    });

    it("nunca deriva de documentNumber -- ignora cualquier segundo argumento tipo RUC", () => {
      // formatQuoteDisplayId solo recibe quoteId. documentNumber (ej. un RUC "20100077044")
      // no debe poder colarse por ningun parametro de esta funcion.
      expect(formatQuoteDisplayId.length).toBe(1);
    });
  });

  describe("sortQueueFifo", () => {
    it("timestamp ausente -> no explota, va al final", () => {
      const rows = [
        { quoteId: "2", timestamp: null },
        { quoteId: "1", timestamp: { _seconds: 100 } },
      ] as any[];
      const sorted = sortQueueFifo(rows);
      expect(sorted[0].quoteId).toBe("1");
      expect(sorted[1].quoteId).toBe("2");
    });
    
    it("ordena por timestamp ASC", () => {
      const rows = [
        { quoteId: "3", timestamp: { _seconds: 300 } },
        { quoteId: "1", timestamp: { _seconds: 100 } },
        { quoteId: "2", timestamp: { _seconds: 200 } },
      ] as any[];
      const sorted = sortQueueFifo(rows);
      expect(sorted[0].quoteId).toBe("1");
      expect(sorted[1].quoteId).toBe("2");
      expect(sorted[2].quoteId).toBe("3");
    });

    it("paridad de formas de timestamp (SDK cliente, admin, nulo)", () => {
      const rows = [
        { quoteId: "1", timestamp: null },
        { quoteId: "2", timestamp: { toMillis: () => 150000 } },
        { quoteId: "3", timestamp: { seconds: 100 } },
        { quoteId: "4", timestamp: { _seconds: 200 } },
      ] as any[];
      const sorted = sortQueueFifo(rows);
      expect(sorted[0].quoteId).toBe("3"); // 100s
      expect(sorted[1].quoteId).toBe("2"); // 150s (150000ms)
      expect(sorted[2].quoteId).toBe("4"); // 200s
      expect(sorted[3].quoteId).toBe("1"); // null -> Infinity
    });
  });
});
