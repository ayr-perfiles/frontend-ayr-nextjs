"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseInvoiceXml = parseInvoiceXml;
const xmlbuilder2_1 = require("xmlbuilder2");
/**
 * Parsea un XML de factura UBL 2.1 (SUNAT) de proveedor
 */
function parseInvoiceXml(xmlString) {
    const doc = (0, xmlbuilder2_1.create)(xmlString);
    // Extraemos datos usando JS object traversal
    const obj = doc.toJS();
    const invoice = obj.Invoice || obj["Invoice"];
    if (!invoice)
        throw new Error("No se encontró el nodo Invoice en el XML.");
    const invId = (invoice["cbc:ID"]?.["#"] || invoice["cbc:ID"] || "").toString();
    const [serie, numero] = invId.split("-");
    const fechaEmision = (invoice["cbc:IssueDate"]?.["#"] || invoice["cbc:IssueDate"] || "").toString();
    const moneda = (invoice["cbc:DocumentCurrencyCode"]?.["#"] || invoice["cbc:DocumentCurrencyCode"] || "") === "USD" ? "USD" : "PEN";
    const supplier = invoice["cac:AccountingSupplierParty"]?.["cac:Party"];
    const rucProveedor = (supplier?.["cac:PartyIdentification"]?.["cbc:ID"]?.["#"] || supplier?.["cac:PartyIdentification"]?.["cbc:ID"] || "").toString();
    const razonSocialProveedor = (supplier?.["cac:PartyLegalEntity"]?.["cbc:RegistrationName"]?.["#"] || supplier?.["cac:PartyLegalEntity"]?.["cbc:RegistrationName"] || "").toString();
    const monetaryTotal = invoice["cac:LegalMonetaryTotal"];
    const baseImponible = parseFloat(monetaryTotal?.["cbc:LineExtensionAmount"]?.["#"] || monetaryTotal?.["cbc:LineExtensionAmount"] || 0);
    const total = parseFloat(monetaryTotal?.["cbc:PayableAmount"]?.["#"] || monetaryTotal?.["cbc:PayableAmount"] || 0);
    const taxTotal = invoice["cac:TaxTotal"];
    const igv = parseFloat(taxTotal?.["cbc:TaxAmount"]?.["#"] || taxTotal?.["cbc:TaxAmount"] || 0);
    // Líneas
    let lineNodes = invoice["cac:InvoiceLine"];
    if (!lineNodes)
        lineNodes = [];
    if (!Array.isArray(lineNodes))
        lineNodes = [lineNodes];
    const lines = lineNodes.filter(Boolean).map((node) => {
        const description = (node["cac:Item"]?.["cbc:Description"]?.["#"] || node["cac:Item"]?.["cbc:Description"] || "").toString();
        const quantity = parseFloat(node["cbc:InvoicedQuantity"]?.["#"] || node["cbc:InvoicedQuantity"] || 0);
        const unitCode = node["cbc:InvoicedQuantity"]?.["@unitCode"] || "NIU";
        const lineExtensionAmount = parseFloat(node["cbc:LineExtensionAmount"]?.["#"] || node["cbc:LineExtensionAmount"] || 0);
        const unitPrice = quantity > 0 ? lineExtensionAmount / quantity : 0;
        return {
            description,
            quantity,
            unitCode,
            unitPrice,
            totalValue: lineExtensionAmount,
        };
    });
    return {
        rucProveedor: rucProveedor.replace(/\D/g, ""),
        razonSocialProveedor,
        serie,
        numero,
        fechaEmision,
        moneda,
        tipoCambio: 1,
        baseImponible,
        igv,
        total,
        lines,
    };
}
//# sourceMappingURL=purchaseXmlParser.js.map