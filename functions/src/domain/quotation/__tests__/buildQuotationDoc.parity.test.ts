import { describe, it, expect } from "vitest";
// Cross-boundary permitido: .test.ts, excluido del build de functions/.
import {
  buildSaleDoc as buildSaleClient,
  buildQuotationDoc as buildQuotationClient,
} from "../../../../../src/core/sales/domain/saleDocBuilder";
import {
  buildSaleDoc as buildSaleBackend,
  buildQuotationDoc as buildQuotationBackend,
} from "../buildQuotationDoc";

/**
 * Parity del builder canónico v6.28 (`src/core/sales/domain/saleDocBuilder.ts`).
 * Para inputs idénticos, la copia server debe devolver EXACTAMENTE lo mismo que la
 * cliente — incluido el orden de los arrays derivados de `Set` (`businessLines`, `skus`,
 * `allFlags`), que depende del orden de inserción y `toEqual` compara posicionalmente.
 *
 * El timestamp se inyecta como sentinel fijo para que las dos salidas sean comparables.
 */
const TS = "TIMESTAMP_SENTINEL";

// Los tipos del input son estructuralmente iguales en ambas copias; se usa `any` en el
// array de fixtures para no acoplar el test a una de las dos declaraciones.
type Fixture = { name: string; input: any };

const fixtures: Fixture[] = [
  {
    name: "1. item con costo normal (profit por item sobre unitValue)",
    input: {
      customerName: "CLIENTE A",
      customerDocument: "20512345678",
      items: [
        {
          sku: "COB030ROJO", productName: "COBERTURA ROJA", quantity: 10,
          unitPrice: 11.8, unitValue: 10, baseCost: 7, businessLine: "metallic-roofing",
          unitWeight: 1.2, unitOfMeasure: "METRO LINEAL",
        },
      ],
      sellerId: "vendedor@ayr.pe",
    },
  },
  {
    name: "2. baseCost === 0 -> profit 0 + flag 'sin costo'",
    input: {
      customerName: "CLIENTE B",
      items: [
        {
          sku: "P64GALV045", productName: "PARANTE", quantity: 5,
          unitPrice: 20, unitValue: 16.95, baseCost: 0, businessLine: "drywall",
        },
      ],
    },
  },
  {
    name: "3. baseCost 0 en SERVICES -> NO lleva flag 'sin costo'",
    input: {
      customerName: "CLIENTE C",
      items: [
        {
          sku: "SERV-CORTE", productName: "SERVICIO DE CORTE", quantity: 1,
          unitPrice: 100, unitValue: 84.75, baseCost: 0, businessLine: "services",
        },
      ],
    },
  },
  {
    name: "4. baseCost 0 en BOBINA (isCoil) -> NO lleva flag 'sin costo'",
    input: {
      customerName: "CLIENTE D",
      items: [
        {
          sku: "BOB-001", productName: "BOBINA", quantity: 1,
          unitPrice: 5000, unitValue: 4237.29, baseCost: 0, isCoil: true, businessLine: "",
        },
      ],
    },
  },
  {
    name: "5. multi-item: totales agregados + allFlags consolidado sin duplicados",
    input: {
      customerName: "CLIENTE E",
      items: [
        {
          sku: "COB030ROJO", productName: "COBERTURA ROJA", quantity: 10,
          unitPrice: 11.8, unitValue: 10, baseCost: 7, businessLine: "metallic-roofing",
          unitWeight: 1.2,
        },
        {
          sku: "P64GALV045", productName: "PARANTE", quantity: 5,
          unitPrice: 20, unitValue: 16.95, baseCost: 0, businessLine: "drywall",
        },
        {
          sku: "R39GALV045", productName: "RIEL", quantity: 3,
          unitPrice: 18, unitValue: 15.25, baseCost: 0, businessLine: "drywall",
        },
      ],
    },
  },
  {
    name: "6. item SIN businessLine -> dispara classifyLine",
    input: {
      customerName: "CLIENTE F",
      items: [
        { sku: "COB030AZUL", productName: "COBERTURA AZUL", quantity: 2, unitPrice: 10, unitValue: 8.47, baseCost: 5 },
        { sku: "ZZZZ999", productName: "PRODUCTO RARO", quantity: 1, unitPrice: 50, unitValue: 42.37, baseCost: 20 },
      ],
    },
  },
  {
    name: "7. businessLine invalido explicito ('UNKNOWN') -> flag 'linea no resuelta' y bl vacio",
    input: {
      customerName: "CLIENTE G",
      items: [
        { sku: "XXX", productName: "X", quantity: 1, unitPrice: 10, unitValue: 8.47, baseCost: 5, businessLine: "UNKNOWN" },
        { sku: "YYY", productName: "Y", quantity: 1, unitPrice: 10, unitValue: 8.47, baseCost: 5, businessLine: "coil" },
      ],
    },
  },
  {
    name: "8. heuristico RUC: documentNumber con RUC y sin customerDocument -> reubica + flag",
    input: {
      customerName: "CLIENTE H",
      documentNumber: "20512345678",
      items: [{ sku: "A", productName: "A", quantity: 1, unitPrice: 10, unitValue: 8.47, baseCost: 5, businessLine: "trading" }],
    },
  },
  {
    name: "8b. heuristico RUC con prefijo 'RUC-'",
    input: {
      customerName: "CLIENTE H2",
      documentNumber: "RUC-20512345678",
      items: [{ sku: "A", productName: "A", quantity: 1, unitPrice: 10, unitValue: 8.47, baseCost: 5, businessLine: "trading" }],
    },
  },
  {
    name: "8c. heuristico NO dispara si ya hay customerDocument",
    input: {
      customerName: "CLIENTE H3",
      documentNumber: "20512345678",
      customerDocument: "10456789012",
      items: [{ sku: "A", productName: "A", quantity: 1, unitPrice: 10, unitValue: 8.47, baseCost: 5, businessLine: "trading" }],
    },
  },
  {
    name: "8d. heuristico NO dispara con un comprobante normal",
    input: {
      customerName: "CLIENTE H4",
      documentNumber: "BBV1-238",
      items: [{ sku: "A", productName: "A", quantity: 1, unitPrice: 10, unitValue: 8.47, baseCost: 5, businessLine: "trading" }],
    },
  },
  {
    name: "9. totales del caller se RESPETAN (import/NC con signo negativo)",
    input: {
      customerName: "CLIENTE I",
      items: [{ sku: "A", productName: "A", quantity: 2, unitPrice: 100, unitValue: 84.75, baseCost: 50, businessLine: "trading" }],
      totalAmount: -200, totalCost: -100, totalProfit: -69.5, totalWeight: -4,
    },
  },
  {
    name: "9b. totalAmount 0 EXPLICITO se respeta (0 es un total legitimo, no ausencia)",
    input: {
      customerName: "CLIENTE I2",
      items: [{ sku: "A", productName: "A", quantity: 2, unitPrice: 100, unitValue: 84.75, baseCost: 50, businessLine: "trading" }],
      totalAmount: 0,
    },
  },
  {
    name: "10. item.profit firmado en el input gana sobre el calculo (incluso con baseCost 0)",
    input: {
      customerName: "CLIENTE J",
      items: [
        { sku: "A", productName: "A", quantity: 1, unitPrice: 100, unitValue: 84.75, baseCost: 50, profit: -34.75, businessLine: "trading" },
        { sku: "B", productName: "B", quantity: 1, unitPrice: 100, unitValue: 84.75, baseCost: 0, profit: 12, businessLine: "trading" },
      ],
    },
  },
  {
    name: "11. unitValue 0 -> el profit cae a unitPrice (con IGV)",
    input: {
      customerName: "CLIENTE K",
      items: [{ sku: "A", productName: "A", quantity: 4, unitPrice: 30, unitValue: 0, baseCost: 10, businessLine: "trading" }],
    },
  },
  {
    name: "12. campos condicionales: weightSnapshot truthy, piecesCount 0, pieceLengthM",
    input: {
      customerName: "CLIENTE L",
      items: [
        {
          sku: "COB030ROJO", productName: "COBERTURA", quantity: 12, unitPrice: 11, unitValue: 9.32,
          baseCost: 7, businessLine: "metallic-roofing",
          weightSnapshot: { pesoKg: 30, metrosTotales: 12, thicknessMm: 0.3, widthMm: 1200, colorFinish: "ALU-ROJO", densityFactor: 0.008 },
          piecesCount: 0, pieceLengthM: 6,
        },
      ],
    },
  },
  {
    name: "12b. weightSnapshot FALSY no se emite; piecesCount undefined tampoco",
    input: {
      customerName: "CLIENTE L2",
      items: [
        {
          sku: "COB030ROJO", productName: "COBERTURA", quantity: 12, unitPrice: 11, unitValue: 9.32,
          baseCost: 7, businessLine: "metallic-roofing", weightSnapshot: null,
        },
      ],
    },
  },
  {
    name: "13. metallic sin peso ni snapshot -> flag 'sin peso'",
    input: {
      customerName: "CLIENTE M",
      items: [
        { sku: "COB030ROJO", productName: "COBERTURA", quantity: 5, unitPrice: 11, unitValue: 9.32, baseCost: 7, businessLine: "metallic-roofing", unitWeight: 0 },
      ],
    },
  },
  {
    name: "14. allFlags semilla del caller se preserva y se une con las de items",
    input: {
      customerName: "CLIENTE N",
      allFlags: ["bandera previa", "sin costo"],
      items: [
        { sku: "A", productName: "A", quantity: 1, unitPrice: 10, unitValue: 8.47, baseCost: 0, businessLine: "trading" },
      ],
    },
  },
  {
    name: "15. calculatedWeight explicito gana sobre unitWeight * quantity",
    input: {
      customerName: "CLIENTE O",
      items: [
        { sku: "A", productName: "A", quantity: 10, unitPrice: 10, unitValue: 8.47, baseCost: 5, businessLine: "trading", unitWeight: 2, calculatedWeight: 7 },
      ],
    },
  },
  {
    name: "16. input minimo: sin items, sin nada",
    input: {},
  },
  {
    name: "17. item sin sku ni productName -> GENERIC",
    input: {
      customerName: "CLIENTE P",
      items: [{ quantity: 1, unitPrice: 10, unitValue: 8.47, baseCost: 5 }],
    },
  },
  {
    name: "18. `name` como alias de productName",
    input: {
      customerName: "CLIENTE Q",
      items: [{ sku: "COB030ROJO", name: "COBERTURA POR ALIAS", quantity: 1, unitPrice: 10, unitValue: 8.47, baseCost: 5 }],
    },
  },
  {
    name: "19. status explicito en el input (buildSaleDoc lo respeta)",
    input: {
      status: "VOIDED",
      customerName: "CLIENTE R",
      items: [{ sku: "A", productName: "A", quantity: 1, unitPrice: 10, unitValue: 8.47, baseCost: 5, businessLine: "trading" }],
    },
  },
  {
    name: "20. SKU repetido en 2 items -> `skus` deduplica pero `items` conserva los 2",
    input: {
      customerName: "CLIENTE S",
      items: [
        { sku: "COB030ROJO", productName: "TR4", quantity: 10, unitPrice: 11, unitValue: 9.32, baseCost: 7, businessLine: "metallic-roofing" },
        { sku: "COB030ROJO", productName: "TR5", quantity: 5, unitPrice: 11, unitValue: 9.32, baseCost: 7, businessLine: "metallic-roofing" },
      ],
    },
  },
];

describe("Parity Test: buildSaleDoc (client vs functions)", () => {
  for (const { name, input } of fixtures) {
    it(`paridad buildSaleDoc: ${name}`, () => {
      expect(buildSaleBackend(input, TS)).toEqual(buildSaleClient(input, TS));
    });
  }
});

describe("Parity Test: buildQuotationDoc (client vs functions)", () => {
  for (const { name, input } of fixtures) {
    it(`paridad buildQuotationDoc: ${name}`, () => {
      expect(buildQuotationBackend(input, TS)).toEqual(buildQuotationClient(input, TS));
    });
  }
});

describe("Contrato del builder (ancla de forma, no solo paridad)", () => {
  it("buildQuotationDoc emite EXACTAMENTE 19 claves, y buildSaleDoc 18", () => {
    const input = fixtures[0].input;
    expect(Object.keys(buildSaleBackend(input, TS)).sort()).toHaveLength(18);
    expect(Object.keys(buildQuotationBackend(input, TS)).sort()).toHaveLength(19);
  });

  it("buildQuotationDoc fuerza status QUOTATION y productionStatus PENDING", () => {
    // Input con status VOIDED explicito: la quotation lo pisa igual.
    const q = buildQuotationBackend(fixtures[18].input, TS);
    expect(q.status).toBe("QUOTATION");
    expect(q.productionStatus).toBe("PENDING");
  });

  it("no hay spread: una clave extra del input NO se filtra al doc", () => {
    const doc = buildSaleBackend({ ...fixtures[0].input, campoInventado: "no debe pasar" } as any, TS);
    expect(doc).not.toHaveProperty("campoInventado");
  });

  it("el timestamp inyectado se usa tal cual", () => {
    expect(buildQuotationBackend(fixtures[0].input, TS).timestamp).toBe(TS);
  });
});
