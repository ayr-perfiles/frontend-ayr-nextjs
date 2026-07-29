import { describe, it, expect } from "vitest";
import { parseImportRows } from "@/core/import/parseImportRows";
import { BusinessLine } from "@/types";

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

    const result = parseImportRows(jsonData, { catalogRef, stockRef, exchangeRates });

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
