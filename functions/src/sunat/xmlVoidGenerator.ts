import { create } from "xmlbuilder2";

/**
 * Genera el XML de Comunicación de Baja (VoidedDocuments)
 */
export function buildVoidXml(bajaInfo: any, sunatConfig: any) {
  const { ruc: RUC_EMPRESA, razonSocial: RAZON_SOCIAL } = sunatConfig;

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

      "ext:UBLExtensions": {
        "ext:UBLExtension": {
          "ext:ExtensionContent": "",
        },
      },

      "cbc:UBLVersionID": "2.0",
      "cbc:CustomizationID": "1.0",
      "cbc:ID": bajaInfo.identifierBaja,
      "cbc:ReferenceDate": bajaInfo.originalIssueDate,
      "cbc:IssueDate": bajaInfo.voidIssueDate,

      "cac:AccountingSupplierParty": {
        "cbc:CustomerAssignedAccountID": RUC_EMPRESA,
        "cbc:AdditionalAccountID": "6",
        "cac:Party": {
          "cac:PartyLegalEntity": {
            "cbc:RegistrationName": RAZON_SOCIAL,
          },
        },
      },

      "sac:VoidedDocumentsLine": {
        "cbc:LineID": "1",
        "cbc:DocumentTypeCode": bajaInfo.originalDocumentType,
        "sac:DocumentSerialID": serieOriginal,
        "sac:DocumentNumberID": numeroOriginal,
        "sac:VoidReasonDescription": bajaInfo.voidReason,
      },
    },
  };

  const doc = create({ version: "1.0", encoding: "utf-8" }, xmlObj);
  return doc.end({ prettyPrint: false });
}
