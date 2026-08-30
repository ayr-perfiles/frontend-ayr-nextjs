import { describe, it, expect } from "vitest";
import { parseImportRows, skipReasonLabel, CatalogRef } from "@/core/import/parseImportRows";
import { BusinessLine } from "@/types";
import type { CoilFinish } from "@/core/coils/services/finishService";

describe("parseImportRows", () => {
  it("should parse valid sales and capture skipped rows", () => {
    const catalogRef: any[] = [
      { sku: "PGALV-001", businessLine: "drywall" as BusinessLine, standardWeight: 10, displayName: "Plancha Drywall" },
      { sku: "UPVC-001", businessLine: "roofing" as BusinessLine, standardWeight: 5, displayName: "Teja" }
    ];
    const stockRef: any[] = [
      { sku: "PGALV-001", businessLine: "drywall" as BusinessLine, avgCost: 20 },
      { sku: "UPVC-001", businessLine: "roofing" as BusinessLine, avgCost: 10 }
    ];
    const exchangeRates = { "2023-01-01": 3.8 };

    const jsonData = [
      {
        "SERIE - NÚMERO": "F001-001",
        "ESTADO COMPROBANTE": "Declarado",
        "CÓDIGO PRODUCTO": "PGALV-001",
        "NOMBRE PRODUCTO": "Plancha Drywall",
        "CLIENTE": "12345678901 - Cliente A",
        "MONEDA": "Soles",
        "F. EMISIÓN": "01/01/2023",
        "TIPO COMPROBANTE": "Factura",
        "CANTIDAD": "2",
        "VALOR DE VENTA": "40",
        "PRECIO DE VENTA": "47.2"
      },
      {
        "SERIE - NÚMERO": "F001-001",
        "ESTADO COMPROBANTE": "Declarado",
        "CÓDIGO PRODUCTO": "UPVC-001",
        "NOMBRE PRODUCTO": "Teja",
        "CLIENTE": "12345678901 - Cliente A",
        "MONEDA": "Soles",
        "F. EMISIÓN": "01/01/2023",
        "TIPO COMPROBANTE": "Factura",
        "CANTIDAD": "1",
        "VALOR DE VENTA": "10",
        "PRECIO DE VENTA": "11.8"
      },
      {
        "SERIE - NÚMERO": "F001-002",
        "ESTADO COMPROBANTE": "Declarado",
        "CÓDIGO PRODUCTO": "PGALV-001",
        "NOMBRE PRODUCTO": "Plancha Drywall",
        "CLIENTE": "222 - Cliente B",
        "MONEDA": "Soles",
        "F. EMISIÓN": "01/01/2023",
        "TIPO COMPROBANTE": "Factura",
        "CANTIDAD": "1",
        "VALOR DE VENTA": "20",
        "PRECIO DE VENTA": "23.6"
      },
      // Row 3 (Index 3): Skip NO_DOC_NUMBER
      {
        "SERIE - NÚMERO": "",
        "NOMBRE PRODUCTO": "Faltante",
      },
      // Row 4 (Index 4): Skip INVALID_STATUS
      {
        "SERIE - NÚMERO": "F001-003",
        "ESTADO COMPROBANTE": "Anulado",
        "NOMBRE PRODUCTO": "Anulada",
      },
      // Row 5 (Index 5): Skip UNRECOGNIZED_PRODUCT
      {
        "SERIE - NÚMERO": "F001-004",
        "ESTADO COMPROBANTE": "Declarado",
        "CÓDIGO PRODUCTO": "ANTI-001",
        "NOMBRE PRODUCTO": "Anticipo",
      }
    ];

    const result = parseImportRows(jsonData, { catalogRef, stockRef, exchangeRates, finishRef: [] });

    // Assertions
    expect(result.parsedSales).toHaveLength(2); // F001-001 and F001-002
    
    const sale1 = result.parsedSales.find(s => s.documentNumber === "F001-001");
    expect(sale1.items).toHaveLength(2); // PGALV-001 and UPVC-001
    
    // Check skipped rows
    expect(result.skippedRows).toHaveLength(3);
    
    // Check NO_DOC_NUMBER
    expect(result.skippedRows[0]).toMatchObject({
      documentNumber: null,
      reason: "NO_DOC_NUMBER"
    });

    // Check INVALID_STATUS
    expect(result.skippedRows[1]).toMatchObject({
      documentNumber: "F001-003",
      reason: "INVALID_STATUS"
    });

    // Check UNRECOGNIZED_PRODUCT
    expect(result.skippedRows[2]).toMatchObject({
      documentNumber: "F001-004",
      reason: "UNRECOGNIZED_PRODUCT"
    });
  });
});

describe("parseImportRows — [IMPORT-WEIGHT-BYPASS] GREEN", () => {
  // Fixture calcada de datos reales de prod: BBV1-347 (item COB030ROJO) +
  // metallic_roofing_catalog/COB030ROJO + coil_finishes/ALZ-ROJO-3002.
  // El catalogo real NO tiene standardWeight ni weight (medido: 0/54 docs los tienen).
  // El peso teorico sale de finishRef (coil_finishes) + dimensiones del catalogo.
  it("COBERTURA sin standardWeight/weight en catalogo -> calculatedWeight usa el peso teorico (351.36)", () => {
    const catalogRef: CatalogRef[] = [
      {
        sku: "COB030ROJO",
        businessLine: "metallic-roofing",
        displayName: "COBERTURA ALZ-ROJO-3002 0.3MM X 1.220",
        family: "COBERTURA",
        unit: "METRO",
        thickness: 0.3,
        widthMm: 1220,
        finish: "ALZ-ROJO-3002",
      },
    ];
    const stockRef: any[] = [
      { sku: "COB030ROJO", businessLine: "metallic-roofing", avgCost: 0 },
    ];
    const finishRef: CoilFinish[] = [
      { id: "ALZ-ROJO-3002", label: "Rojo 3002", active: true, lines: ["metallic-roofing" as BusinessLine], densityFactor: 0.008 },
    ];
    const exchangeRates = {};

    const jsonData = [
      {
        "SERIE - NÚMERO": "BBV1-TEST-COB",
        "ESTADO COMPROBANTE": "Declarado",
        "CÓDIGO PRODUCTO": "COB030ROJO",
        "NOMBRE PRODUCTO": "COBERTURA DE ALUZINC 0.30MM COLOR ROJO TR5",
        "CLIENTE": "12345678901 - Cliente Test",
        "MONEDA": "Soles",
        "F. EMISIÓN": "01/01/2023",
        "TIPO COMPROBANTE": "Boleta",
        "CANTIDAD": "120",
        "VALOR DE VENTA": "1220.34",
        "PRECIO DE VENTA": "1440",
        "UNIDAD MEDIDA": "METRO LINEAL",
      },
    ];

    const result = parseImportRows(jsonData, { catalogRef, stockRef, exchangeRates, finishRef });
    const sale = result.parsedSales.find((s) => s.documentNumber === "BBV1-TEST-COB");
    const item = sale!.items[0];

    // Peso teorico derivado a mano ANTES de correr: 120 ML * 0.3mm * 1220mm * 0.008 = 351.36
    expect(item.calculatedWeight).toBe(351.36);
    expect(sale!.totalWeight).toBe(351.36);
  });

  it("PLANCHA sin standardWeight/weight en catalogo -> calculatedWeight usa el peso teorico (175.68)", () => {
    const catalogRef: CatalogRef[] = [
      {
        sku: "PL030AZ6MT",
        businessLine: "metallic-roofing",
        displayName: "PLANCHA ALZ-AZUL-5002 0.3MM X 1.220 X 6.00MT",
        family: "PLANCHA",
        unit: "PIEZA",
        thickness: 0.3,
        widthMm: 1220,
        length: 6,
        finish: "ALZ-AZUL-5002",
      },
    ];
    const stockRef: any[] = [
      { sku: "PL030AZ6MT", businessLine: "metallic-roofing", avgCost: 0 },
    ];
    const finishRef: CoilFinish[] = [
      { id: "ALZ-AZUL-5002", label: "Azul 5002", active: true, lines: ["metallic-roofing" as BusinessLine], densityFactor: 0.008 },
    ];
    const exchangeRates = {};

    const jsonData = [
      {
        "SERIE - NÚMERO": "BBV1-TEST-PL",
        "ESTADO COMPROBANTE": "Declarado",
        "CÓDIGO PRODUCTO": "PL030AZ6MT",
        "NOMBRE PRODUCTO": "PLANCHA ALUZINC AZUL 0.30MM X 6MT",
        "CLIENTE": "12345678901 - Cliente Test",
        "MONEDA": "Soles",
        "F. EMISIÓN": "01/01/2023",
        "TIPO COMPROBANTE": "Boleta",
        "CANTIDAD": "10",
        "VALOR DE VENTA": "500",
        "PRECIO DE VENTA": "590",
        "UNIDAD MEDIDA": "UNIDAD",
      },
    ];

    const result = parseImportRows(jsonData, { catalogRef, stockRef, exchangeRates, finishRef });
    const sale = result.parsedSales.find((s) => s.documentNumber === "BBV1-TEST-PL");
    const item = sale!.items[0];

    // Peso teorico derivado a mano ANTES de correr:
    // metrosTotales = cantidad(10 piezas) * length(6m) = 60
    // pesoKg = metrosTotales * thicknessMm(0.3) * widthMm(1220) * densityFactor(0.008)
    //        = 60 * 0.3 * 1220 * 0.008 = 175.68
    expect(item.calculatedWeight).toBe(175.68);
    expect(sale!.totalWeight).toBe(175.68);
  });

  // [IMPORT-WEIGHT-MULTIITEM] Los 2 casos de arriba tienen UN item cada uno, asi que
  // ninguno distingue un acumulador (`+=`) de una asignacion (`=`). Este cubre la
  // cabecera con DOS items metallic distintos: totalWeight tiene que ser la SUMA.
  it("cabecera con DOS items metallic -> totalWeight es la suma de ambos (351.36 + 175.68 = 527.04)", () => {
    const catalogRef: CatalogRef[] = [
      {
        sku: "COB030ROJO",
        businessLine: "metallic-roofing",
        displayName: "COBERTURA ALZ-ROJO-3002 0.3MM X 1.220",
        family: "COBERTURA",
        unit: "METRO",
        thickness: 0.3,
        widthMm: 1220,
        finish: "ALZ-ROJO-3002",
      },
      {
        sku: "PL030AZ6MT",
        businessLine: "metallic-roofing",
        displayName: "PLANCHA ALZ-AZUL-5002 0.3MM X 1.220 X 6.00MT",
        family: "PLANCHA",
        unit: "PIEZA",
        thickness: 0.3,
        widthMm: 1220,
        length: 6,
        finish: "ALZ-AZUL-5002",
      },
    ];
    const stockRef: any[] = [
      { sku: "COB030ROJO", businessLine: "metallic-roofing", avgCost: 0 },
      { sku: "PL030AZ6MT", businessLine: "metallic-roofing", avgCost: 0 },
    ];
    const finishRef: CoilFinish[] = [
      { id: "ALZ-ROJO-3002", label: "Rojo 3002", active: true, lines: ["metallic-roofing" as BusinessLine], densityFactor: 0.008 },
      { id: "ALZ-AZUL-5002", label: "Azul 5002", active: true, lines: ["metallic-roofing" as BusinessLine], densityFactor: 0.008 },
    ];
    const exchangeRates = {};

    // Las DOS filas comparten "SERIE - NÚMERO" -> una sola cabecera, dos items.
    const jsonData = [
      {
        "SERIE - NÚMERO": "BBV1-TEST-MULTI",
        "ESTADO COMPROBANTE": "Declarado",
        "CÓDIGO PRODUCTO": "COB030ROJO",
        "NOMBRE PRODUCTO": "COBERTURA DE ALUZINC 0.30MM COLOR ROJO TR5",
        "CLIENTE": "12345678901 - Cliente Test",
        "MONEDA": "Soles",
        "F. EMISIÓN": "01/01/2023",
        "TIPO COMPROBANTE": "Boleta",
        "CANTIDAD": "120",
        "VALOR DE VENTA": "1220.34",
        "PRECIO DE VENTA": "1440",
        "UNIDAD MEDIDA": "METRO LINEAL",
      },
      {
        "SERIE - NÚMERO": "BBV1-TEST-MULTI",
        "ESTADO COMPROBANTE": "Declarado",
        "CÓDIGO PRODUCTO": "PL030AZ6MT",
        "NOMBRE PRODUCTO": "PLANCHA ALUZINC AZUL 0.30MM X 6MT",
        "CLIENTE": "12345678901 - Cliente Test",
        "MONEDA": "Soles",
        "F. EMISIÓN": "01/01/2023",
        "TIPO COMPROBANTE": "Boleta",
        "CANTIDAD": "10",
        "VALOR DE VENTA": "500",
        "PRECIO DE VENTA": "590",
        "UNIDAD MEDIDA": "UNIDAD",
      },
    ];

    const result = parseImportRows(jsonData, { catalogRef, stockRef, exchangeRates, finishRef });
    const sale = result.parsedSales.find((s) => s.documentNumber === "BBV1-TEST-MULTI");

    expect(sale!.items).toHaveLength(2);
    expect(sale!.items[0].calculatedWeight).toBe(351.36);
    expect(sale!.items[1].calculatedWeight).toBe(175.68);

    // Derivado a mano ANTES de correr:
    //   COB030ROJO -> 120 ML * 0.3 * 1220 * 0.008 = 351.36
    //   PL030AZ6MT -> (10 piezas * 6 m) * 0.3 * 1220 * 0.008 = 175.68
    //   totalWeight = 351.36 + 175.68 = 527.04
    expect(sale!.totalWeight).toBe(527.04);
  });

  // [IMPORT-WEIGHT-ZEROQTY] Hueco de cobertura que la mutacion M3 de v6.78.0 dejo al
  // descubierto: sacar el guard `cantidad > 0` del unitWeight NO ponia ningun test en
  // rojo. La fila es ALCANZABLE — los 3 unicos guards del loop (NO_DOC_NUMBER /
  // INVALID_STATUS / UNRECOGNIZED_PRODUCT) miran docNumber, estado y clasificacion,
  // ninguno mira CANTIDAD, y `cantidad` se parsea DESPUES de los tres.
  // Mecanismo: calcCoverageWeightKg con quantity 0 devuelve pesoKg = 0 (NO null), asi
  // que el override queda en 0 y `0 / 0` daria NaN sin el guard.
  it("cantidad 0 en item metallic -> unitWeight es 0, nunca NaN (guard `cantidad > 0`)", () => {
    const catalogRef: CatalogRef[] = [
      {
        sku: "COB030ROJO",
        businessLine: "metallic-roofing",
        displayName: "COBERTURA ALZ-ROJO-3002 0.3MM X 1.220",
        family: "COBERTURA",
        unit: "METRO",
        thickness: 0.3,
        widthMm: 1220,
        finish: "ALZ-ROJO-3002",
      },
    ];
    const stockRef: any[] = [
      { sku: "COB030ROJO", businessLine: "metallic-roofing", avgCost: 0 },
    ];
    const finishRef: CoilFinish[] = [
      { id: "ALZ-ROJO-3002", label: "Rojo 3002", active: true, lines: ["metallic-roofing" as BusinessLine], densityFactor: 0.008 },
    ];
    const exchangeRates = {};

    const jsonData = [
      {
        "SERIE - NÚMERO": "BBV1-TEST-ZEROQTY",
        "ESTADO COMPROBANTE": "Declarado",
        "CÓDIGO PRODUCTO": "COB030ROJO",
        "NOMBRE PRODUCTO": "COBERTURA DE ALUZINC 0.30MM COLOR ROJO TR5",
        "CLIENTE": "12345678901 - Cliente Test",
        "MONEDA": "Soles",
        "F. EMISIÓN": "01/01/2023",
        "TIPO COMPROBANTE": "Boleta",
        "CANTIDAD": "0",
        "VALOR DE VENTA": "0",
        "PRECIO DE VENTA": "0",
        "UNIDAD MEDIDA": "METRO LINEAL",
      },
    ];

    const result = parseImportRows(jsonData, { catalogRef, stockRef, exchangeRates, finishRef });
    const sale = result.parsedSales.find((s) => s.documentNumber === "BBV1-TEST-ZEROQTY");

    // La fila NO se descarta: llega viva a la rama metallic.
    expect(sale).toBeDefined();
    expect(result.skippedRows).toHaveLength(0);

    const item = sale!.items[0];
    expect(Number.isNaN(item.unitWeight)).toBe(false);
    expect(item.unitWeight).toBe(0);
    expect(item.calculatedWeight).toBe(0);
    expect(sale!.totalWeight).toBe(0);
  });
});

describe("skipReasonLabel", () => {
  it("should return correct labels for known reasons", () => {
    expect(skipReasonLabel("NO_DOC_NUMBER")).toBe("Sin n° de comprobante");
    expect(skipReasonLabel("INVALID_STATUS")).toBe("Comprobante anulado / baja / no declarado");
    expect(skipReasonLabel("UNRECOGNIZED_PRODUCT")).toBe("Producto no reconocido (no importable)");
  });

  it("should return fallback label for unknown reasons", () => {
    expect(skipReasonLabel("UNKNOWN_REASON" as any)).toBe("Motivo desconocido");
  });
});
