// src/services/sunat/xmlGenerator.ts

import { create } from "xmlbuilder2";

/**
 * Genera el XML en formato oficial UBL 2.1 para Facturas (01) y Boletas (03)
 */
export function buildInvoiceXml(saleInfo: any) {
  const RUC_EMPRESA = process.env.SUNAT_RUC || "20612769151";
  const RAZON_SOCIAL =
    process.env.EMPRESA_RAZON_SOCIAL || "EMBOTELLADORA MOALV S.A.C.";

  const IGV_RATE = 0.18;
  let totalVenta = 0;
  let totalGravadas = 0;
  let totalIgv = 0;

  // 1. Mapeo de Ítems en formato UBL 2.1 Estricto
  const invoiceLines = saleInfo.items.map((item: any, index: number) => {
    const lineTotal = item.quantity * item.unitPrice;
    const valorVenta = lineTotal / (1 + IGV_RATE);
    const valorUnitario = item.unitPrice / (1 + IGV_RATE);
    const igvLinea = lineTotal - valorVenta;

    totalVenta += lineTotal;
    totalGravadas += valorVenta;
    totalIgv += igvLinea;

    const itemDescription =
      item.name || item.description || "Producto de Planta";

    return {
      "cbc:ID": (index + 1).toString(),
      "cbc:InvoicedQuantity": {
        "@unitCode": "NIU",
        "#text": item.quantity.toString(),
      },
      "cbc:LineExtensionAmount": {
        "@currencyID": "PEN",
        "#text": valorVenta.toFixed(2),
      },
      "cac:PricingReference": {
        "cac:AlternativeConditionPrice": {
          "cbc:PriceAmount": {
            "@currencyID": "PEN",
            "#text": item.unitPrice.toFixed(2),
          },
          "cbc:PriceTypeCode": "01",
        },
      },
      "cac:TaxTotal": {
        "cbc:TaxAmount": { "@currencyID": "PEN", "#text": igvLinea.toFixed(2) },
        "cac:TaxSubtotal": {
          "cbc:TaxableAmount": {
            "@currencyID": "PEN",
            "#text": valorVenta.toFixed(2),
          },
          "cbc:TaxAmount": {
            "@currencyID": "PEN",
            "#text": igvLinea.toFixed(2),
          },
          "cac:TaxCategory": {
            "cbc:ID": "S", // ← FIX: required by UBL 2.1 schema
            "cbc:Percent": "18.00",
            "cbc:TaxExemptionReasonCode": "10",
            "cac:TaxScheme": {
              "cbc:ID": "1000",
              "cbc:Name": "IGV",
              "cbc:TaxTypeCode": "VAT",
            },
          },
        },
      },
      "cac:Item": {
        "cbc:Description": itemDescription.toUpperCase(),
      },
      "cac:Price": {
        "cbc:PriceAmount": {
          "@currencyID": "PEN",
          "#text": valorUnitario.toFixed(2),
        },
      },
    };
  });

  const isFactura = saleInfo.documentType === "01";

  // ── FIX: build the DespatchDocumentReference array only when it has entries.
  // Passing `undefined` to xmlbuilder2 can produce a ghost empty element that
  // breaks SUNAT's schema validation (cascades as error 2074).
  const despatchRefs =
    Array.isArray(saleInfo.guiasAsociadas) && saleInfo.guiasAsociadas.length > 0
      ? saleInfo.guiasAsociadas.map((guiaId: string) => ({
          "cbc:ID": guiaId,
          "cbc:DocumentTypeCode": "09",
        }))
      : null; // xmlbuilder2 silently skips null values

  // 2. Estructura Maestra JSON para UBL 2.1
  const xmlObj: Record<string, any> = {
    Invoice: {
      // ── Namespaces ──────────────────────────────────────────────────────────
      "@xmlns": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
      "@xmlns:cac":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
      "@xmlns:cbc":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
      "@xmlns:ext":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
      // ── FIX: declare ds namespace on the root element so it is in scope
      // after the signature is injected into ext:ExtensionContent. Without
      // this, some validators (and SUNAT's) may reject the document structure
      // and surface it as error 2074 (UBLVersionID).
      "@xmlns:ds": "http://www.w3.org/2000/09/xmldsig#",

      // Space reserved for the digital signature
      "ext:UBLExtensions": {
        "ext:UBLExtension": {
          "ext:ExtensionContent": "",
        },
      },

      "cbc:UBLVersionID": "2.1",
      "cbc:CustomizationID": "2.0",

      "cbc:ID": saleInfo.documentId,
      "cbc:IssueDate": saleInfo.issueDate,
      "cbc:IssueTime": "00:00:00",
      "cbc:InvoiceTypeCode": {
        "@listID": "0101",
        "#text": saleInfo.documentType,
      },
      "cbc:DocumentCurrencyCode": "PEN",

      // ── FIX: only include this element when it has data (null is skipped)
      ...(despatchRefs
        ? { "cac:DespatchDocumentReference": despatchRefs }
        : {}),

      "cac:AccountingSupplierParty": {
        "cac:Party": {
          "cac:PartyIdentification": {
            "cbc:ID": { "@schemeID": "6", "#text": RUC_EMPRESA },
          },
          "cac:PartyLegalEntity": {
            "cbc:RegistrationName": RAZON_SOCIAL,
          },
        },
      },

      "cac:AccountingCustomerParty": {
        "cac:Party": {
          "cac:PartyIdentification": {
            "cbc:ID": {
              "@schemeID": isFactura ? "6" : "1",
              "#text": saleInfo.customerDocument,
            },
          },
          "cac:PartyLegalEntity": {
            "cbc:RegistrationName": saleInfo.customerName,
          },
        },
      },

      "cac:TaxTotal": {
        "cbc:TaxAmount": { "@currencyID": "PEN", "#text": totalIgv.toFixed(2) },
        "cac:TaxSubtotal": {
          "cbc:TaxableAmount": {
            "@currencyID": "PEN",
            "#text": totalGravadas.toFixed(2),
          },
          "cbc:TaxAmount": {
            "@currencyID": "PEN",
            "#text": totalIgv.toFixed(2),
          },
          "cac:TaxCategory": {
            "cbc:ID": "S", // ← FIX: required by UBL 2.1 schema
            "cbc:Percent": "18.00", // ← FIX: also required at global level
            "cac:TaxScheme": {
              "cbc:ID": "1000",
              "cbc:Name": "IGV",
              "cbc:TaxTypeCode": "VAT",
            },
          },
        },
      },

      "cac:LegalMonetaryTotal": {
        "cbc:LineExtensionAmount": {
          "@currencyID": "PEN",
          "#text": totalGravadas.toFixed(2),
        },
        "cbc:TaxInclusiveAmount": {
          "@currencyID": "PEN",
          "#text": totalVenta.toFixed(2),
        },
        "cbc:PayableAmount": {
          "@currencyID": "PEN",
          "#text": totalVenta.toFixed(2),
        },
      },

      "cac:InvoiceLine": invoiceLines,
    },
  };

  // 3. Generamos el XML estructurado
  const doc = create({ version: "1.0", encoding: "utf-8" }, xmlObj);
  return doc.end({ prettyPrint: false });
}
