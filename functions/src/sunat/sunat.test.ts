import { describe, it, expect } from "vitest";
import { buildInvoiceXml } from "./xmlGenerator";

describe("SUNAT XML Generator", () => {
  it("should generate a valid Invoice XML structure", () => {
    const saleInfo = {
      documentId: "F001-000001",
      documentType: "01",
      issueDate: "2026-05-31",
      customerName: "CLIENTE DE PRUEBA S.A.C.",
      customerDocument: "20123456789",
      items: [
        {
          quantity: 2,
          unitPrice: 118,
          name: "PRODUCTO A",
        },
      ],
    };

    const sunatConfig = {
      ruc: "20612769151",
      razonSocial: "AYR STEEL S.A.C.",
    };

    const xml = buildInvoiceXml(saleInfo, sunatConfig);

    expect(xml).toContain("<cbc:ID>F001-000001</cbc:ID>");
    expect(xml).toContain("<cbc:InvoiceTypeCode listID=\"0101\">01</cbc:InvoiceTypeCode>");
    expect(xml).toContain("<cbc:RegistrationName>AYR STEEL S.A.C.</cbc:RegistrationName>");
    expect(xml).toContain("<cbc:RegistrationName>CLIENTE DE PRUEBA S.A.C.</cbc:RegistrationName>");
    // Total Gravada: 200 (100 each), IGV: 36 (18 each), Total: 236
    expect(xml).toContain("<cbc:PayableAmount currencyID=\"PEN\">236.00</cbc:PayableAmount>");
  });

  it("should generate a valid Receipt (Boleta) XML structure", () => {
    const saleInfo = {
      documentId: "B001-000001",
      documentType: "03",
      issueDate: "2026-05-31",
      customerName: "JUAN PEREZ",
      customerDocument: "12345678",
      items: [
        {
          quantity: 1,
          unitPrice: 100,
          name: "PRODUCTO B",
        },
      ],
    };

    const sunatConfig = {
      ruc: "20612769151",
      razonSocial: "AYR STEEL S.A.C.",
    };

    const xml = buildInvoiceXml(saleInfo, sunatConfig);

    expect(xml).toContain("<cbc:ID>B001-000001</cbc:ID>");
    expect(xml).toContain("<cbc:InvoiceTypeCode listID=\"0101\">03</cbc:InvoiceTypeCode>");
    expect(xml).toContain("<cbc:ID schemeID=\"1\">12345678</cbc:ID>");
  });
});
