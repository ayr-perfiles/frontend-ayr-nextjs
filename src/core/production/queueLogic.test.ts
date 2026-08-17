import { describe, it, expect } from "vitest";
import { buildQueueRow, sortQueueFifo, formatQuoteDisplayId, buildQuoteDetailView } from "./queueLogic";

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

  describe("buildQuoteDetailView", () => {
    it("cotización simple, 1 línea, sin SKU compartido", () => {
      const sale = {
        id: "COT-SIMPLE-1",
        totalAmount: 1000,
        items: [
          { sku: "COB030ROJO", productName: "COBERTURA ROJO", quantity: 100, unitPrice: 10, businessLine: "metallic-roofing" },
        ],
      } as any;
      const queueRow = {
        quoteId: "COT-SIMPLE-1",
        lines: [
          { sku: "COB030ROJO", productNames: ["COBERTURA ROJO"], quantityRequested: 100, quantityProduced: 40, pct: 40 },
        ],
      } as any;

      const view = buildQuoteDetailView(sale, queueRow);

      expect(view.rows).toHaveLength(1);
      expect(view.rows[0].isSharedSku).toBe(false);
      expect(view.hasSharedSku).toBe(false);
      expect(view.rows[0].producedForSku).toBe(40);
      expect(view.rows[0].lineSubtotal).toBe(1000); // sin subtotal -> unitPrice * quantity
      expect(view.totalAmount).toBe(1000);
    });

    it("SKU compartido TR4/TR5: filas separadas, mismo producedForSku, ambas marcadas", () => {
      const sale = {
        id: "COT-FFA1-1072",
        totalAmount: 5000,
        items: [
          { sku: "COB030ROJO", productName: "COBERTURA DE ALUZINC 0.30MM COLOR ROJO TR4", quantity: 270, unitPrice: 10.9, businessLine: "metallic-roofing" },
          { sku: "COB030ROJO", productName: "COBERTURA DE ALUZINC 0.30MM COLOR ROJO TR5", quantity: 1800, unitPrice: 10.9, businessLine: "metallic-roofing" },
        ],
      } as any;
      const queueRow = {
        quoteId: "COT-FFA1-1072",
        lines: [
          {
            sku: "COB030ROJO",
            productNames: ["COBERTURA DE ALUZINC 0.30MM COLOR ROJO TR4", "COBERTURA DE ALUZINC 0.30MM COLOR ROJO TR5"],
            quantityRequested: 2070,
            quantityProduced: 500,
            pct: 24.154589371980676,
          },
        ],
      } as any;

      const view = buildQuoteDetailView(sale, queueRow);

      expect(view.rows).toHaveLength(2);
      expect(view.rows[0].quantityRequested).toBe(270);
      expect(view.rows[1].quantityRequested).toBe(1800);
      expect(view.rows[0].producedForSku).toBe(500);
      expect(view.rows[1].producedForSku).toBe(500);
      expect(view.rows[0].isSharedSku).toBe(true);
      expect(view.rows[1].isSharedSku).toBe(true);
      expect(view.hasSharedSku).toBe(true);
    });

    it("subtotal ausente en un item -> lineSubtotal cae a unitPrice * quantity", () => {
      const sale = {
        id: "COT-NOSUB",
        totalAmount: 500,
        items: [
          { sku: "SKU-A", productName: "A", quantity: 10, unitPrice: 50, businessLine: "metallic-roofing" },
        ],
      } as any;
      const queueRow = {
        quoteId: "COT-NOSUB",
        lines: [{ sku: "SKU-A", productNames: ["A"], quantityRequested: 10, quantityProduced: 0, pct: 0 }],
      } as any;

      const view = buildQuoteDetailView(sale, queueRow);
      expect(view.rows[0].lineSubtotal).toBe(500);
    });

    it("subtotal presente en un item -> se respeta tal cual, no se recalcula", () => {
      const sale = {
        id: "COT-SUB",
        totalAmount: 999,
        items: [
          { sku: "SKU-B", productName: "B", quantity: 10, unitPrice: 50, subtotal: 480, businessLine: "metallic-roofing" },
        ],
      } as any;
      const queueRow = {
        quoteId: "COT-SUB",
        lines: [{ sku: "SKU-B", productNames: ["B"], quantityRequested: 10, quantityProduced: 0, pct: 0 }],
      } as any;

      const view = buildQuoteDetailView(sale, queueRow);
      expect(view.rows[0].lineSubtotal).toBe(480);
    });

    it("piecesCount/pieceLengthM presentes (caso nativo tipo C-000020) -> se propagan", () => {
      const sale = {
        id: "C-000020",
        totalAmount: 14160,
        items: [
          {
            sku: "COB035NATURAL",
            productName: "COBERTURA ALZ-NATURAL 0.35MM X 1.220",
            quantity: 1200,
            unitPrice: 11.8,
            piecesCount: 200,
            pieceLengthM: 6,
            businessLine: "metallic-roofing",
          },
        ],
      } as any;
      const queueRow = {
        quoteId: "C-000020",
        lines: [{ sku: "COB035NATURAL", productNames: ["COBERTURA ALZ-NATURAL 0.35MM X 1.220"], quantityRequested: 1200, quantityProduced: 1200, pct: 100 }],
      } as any;

      const view = buildQuoteDetailView(sale, queueRow);
      expect(view.rows[0].piecesCount).toBe(200);
      expect(view.rows[0].pieceLengthM).toBe(6);
    });

    it("item con sku que no está en queueRow.lines -> producedForSku:0, sin throw", () => {
      const sale = {
        id: "COT-ORPHAN",
        totalAmount: 100,
        items: [
          { sku: "UNKNOWN-SKU", productName: "X", quantity: 10, unitPrice: 5, businessLine: "metallic-roofing" },
        ],
      } as any;
      const queueRow = { quoteId: "COT-ORPHAN", lines: [] } as any;

      expect(() => buildQuoteDetailView(sale, queueRow)).not.toThrow();
      const view = buildQuoteDetailView(sale, queueRow);
      expect(view.rows[0].producedForSku).toBe(0);
    });

    it("totalAmount se pasa tal cual desde sale.totalAmount", () => {
      const sale = {
        id: "COT-TOTAL",
        totalAmount: 7654.32,
        items: [{ sku: "SKU-C", productName: "C", quantity: 1, unitPrice: 1, businessLine: "metallic-roofing" }],
      } as any;
      const queueRow = {
        quoteId: "COT-TOTAL",
        lines: [{ sku: "SKU-C", productNames: ["C"], quantityRequested: 1, quantityProduced: 0, pct: 0 }],
      } as any;

      const view = buildQuoteDetailView(sale, queueRow);
      expect(view.totalAmount).toBe(7654.32);
    });
  });
});
