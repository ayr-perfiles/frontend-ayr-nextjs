// src/services/sunat/xmlVoidGenerator.ts
import { create } from "xmlbuilder2";

/**
 * Genera el XML de Comunicación de Baja (VoidedDocuments)
 */
export function buildVoidXml(bajaInfo: any) {
  const RUC_EMPRESA = process.env.SUNAT_RUC || "20612769151";
  const RAZON_SOCIAL =
    process.env.EMPRESA_RAZON_SOCIAL || "EMBOTELLADORA MOALV S.A.C.";

  // Desglosar el ID del documento original (Ej: F001-15 -> Serie: F001, Numero: 15)
  const [serieOriginal, numeroOriginal] =
    bajaInfo.originalDocumentId.split("-");

  const xmlObj = {
    VoidedDocuments: {
      "@xmlns":
        "urn:sunat:names:specification:ubl:peru:schema:xsd:VoidedDocuments-1",
      "@xmlns:cac":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
      "@xmlns:cbc":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
      "@xmlns:ext":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
      "@xmlns:sac":
        "urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1",

      // Espacio para la firma electrónica
      "ext:UBLExtensions": {
        "ext:UBLExtension": {
          "ext:ExtensionContent": "",
        },
      },

      "cbc:UBLVersionID": "2.0",
      "cbc:CustomizationID": "1.0",
      "cbc:ID": bajaInfo.identifierBaja, // Ej: RA-20260515-1
      "cbc:ReferenceDate": bajaInfo.originalIssueDate, // Fecha en que se emitió la factura original
      "cbc:IssueDate": bajaInfo.voidIssueDate, // Fecha de hoy (cuando se comunica la baja)

      // DATOS DEL EMISOR
      "cac:AccountingSupplierParty": {
        "cbc:CustomerAssignedAccountID": RUC_EMPRESA,
        "cbc:AdditionalAccountID": "6",
        "cac:Party": {
          "cac:PartyLegalEntity": {
            "cbc:RegistrationName": RAZON_SOCIAL,
          },
        },
      },

      // DETALLE DEL DOCUMENTO A ANULAR
      "sac:VoidedDocumentsLine": {
        "cbc:LineID": "1", // Correlativo de la línea de baja
        "cbc:DocumentTypeCode": bajaInfo.originalDocumentType, // 01 (Factura) o 03 (Boleta)
        "sac:DocumentSerialID": serieOriginal,
        "sac:DocumentNumberID": numeroOriginal,
        "sac:VoidReasonDescription": bajaInfo.voidReason,
      },
    },
  };

  const doc = create({ version: "1.0", encoding: "utf-8" }, xmlObj);
  return doc.end({ prettyPrint: false });
}
