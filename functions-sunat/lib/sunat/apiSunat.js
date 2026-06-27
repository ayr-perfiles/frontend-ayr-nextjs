"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendInvoiceToSunat = sendInvoiceToSunat;
exports.sendSummaryToSunat = sendSummaryToSunat;
exports.getStatusFromSunat = getStatusFromSunat;
const jszip_1 = __importDefault(require("jszip"));
const secrets_1 = require("../config/secrets");
const integrations_1 = require("../config/integrations");
/**
 * Envía un comprobante (Factura/Boleta) a SUNAT
 */
async function sendInvoiceToSunat(fileName, signedXml, sunatConfig) {
    const ruc = sunatConfig.config.ruc;
    const user = secrets_1.SUNAT_USER_SOL.value();
    const password = secrets_1.SUNAT_PASS_SOL.value();
    const zip = new jszip_1.default();
    zip.file(`${fileName}.xml`, signedXml);
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const zipBase64 = zipBuffer.toString("base64");
    const soapEnvelope = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <soapenv:Header>
        <wsse:Security>
          <wsse:UsernameToken>
            <wsse:Username>${ruc}${user}</wsse:Username>
            <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${password}</wsse:Password>
          </wsse:UsernameToken>
        </wsse:Security>
      </soapenv:Header>
      <soapenv:Body>
        <ser:sendBill>
          <fileName>${fileName}.zip</fileName>
          <contentFile>${zipBase64}</contentFile>
        </ser:sendBill>
      </soapenv:Body>
    </soapenv:Envelope>
  `;
    const endpoint = (0, integrations_1.getSunatEndpoint)(sunatConfig);
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "text/xml;charset=UTF-8",
            SOAPAction: "urn:sendBill",
        },
        body: soapEnvelope.trim(),
    });
    const responseText = await response.text();
    if (!response.ok || responseText.includes("faultcode")) {
        const faultCodeMatch = responseText.match(/<faultcode[^>]*>(.*?)<\/faultcode>/);
        const faultStringMatch = responseText.match(/<faultstring[^>]*>(.*?)<\/faultstring>/);
        throw new Error(`Rechazo de SUNAT: ${faultCodeMatch?.[1]?.replace("soap-env:", "")} - ${faultStringMatch?.[1]}`);
    }
    const cdrMatch = responseText.match(/<[^>]*applicationResponse[^>]*>([\s\S]*?)<\/[^>]*applicationResponse>/i);
    if (!cdrMatch || !cdrMatch[1]) {
        throw new Error(`La SUNAT no devolvió la constancia de recepción (CDR).`);
    }
    return cdrMatch[1];
}
/**
 * Envía un resumen de bajas a SUNAT y retorna un ticket
 */
async function sendSummaryToSunat(fileName, signedXml, sunatConfig) {
    const ruc = sunatConfig.config.ruc;
    const user = secrets_1.SUNAT_USER_SOL.value();
    const password = secrets_1.SUNAT_PASS_SOL.value();
    const zip = new jszip_1.default();
    zip.file(`${fileName}.xml`, signedXml);
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const zipBase64 = zipBuffer.toString("base64");
    const soapEnvelope = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <soapenv:Header>
        <wsse:Security>
          <wsse:UsernameToken>
            <wsse:Username>${ruc}${user}</wsse:Username>
            <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${password}</wsse:Password>
          </wsse:UsernameToken>
        </wsse:Security>
      </soapenv:Header>
      <soapenv:Body>
        <ser:sendSummary>
          <fileName>${fileName}.zip</fileName>
          <contentFile>${zipBase64}</contentFile>
        </ser:sendSummary>
      </soapenv:Body>
    </soapenv:Envelope>
  `;
    const endpoint = (0, integrations_1.getSunatEndpoint)(sunatConfig);
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "text/xml;charset=UTF-8",
            SOAPAction: "urn:sendSummary",
        },
        body: soapEnvelope.trim(),
    });
    const responseText = await response.text();
    if (!response.ok || responseText.includes("faultcode")) {
        const faultCodeMatch = responseText.match(/<faultcode[^>]*>(.*?)<\/faultcode>/);
        const faultStringMatch = responseText.match(/<faultstring[^>]*>(.*?)<\/faultstring>/);
        throw new Error(`Rechazo de SUNAT: ${faultCodeMatch?.[1]?.replace("soap-env:", "")} - ${faultStringMatch?.[1]}`);
    }
    const ticketMatch = responseText.match(/<ticket[^>]*>(.*?)<\/ticket>/);
    if (!ticketMatch || !ticketMatch[1]) {
        throw new Error("La SUNAT no devolvió un ticket para la comunicación de baja.");
    }
    return ticketMatch[1];
}
/**
 * Consulta el estado de un ticket (comunicación de baja)
 */
async function getStatusFromSunat(ticket, sunatConfig) {
    const ruc = sunatConfig.config.ruc;
    const user = secrets_1.SUNAT_USER_SOL.value();
    const password = secrets_1.SUNAT_PASS_SOL.value();
    const soapEnvelope = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <soapenv:Header>
        <wsse:Security>
          <wsse:UsernameToken>
            <wsse:Username>${ruc}${user}</wsse:Username>
            <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${password}</wsse:Password>
          </wsse:UsernameToken>
        </wsse:Security>
      </soapenv:Header>
      <soapenv:Body>
        <ser:getStatus>
          <ticket>${ticket}</ticket>
        </ser:getStatus>
      </soapenv:Body>
    </soapenv:Envelope>
  `;
    const endpoint = (0, integrations_1.getSunatEndpoint)(sunatConfig);
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "text/xml;charset=UTF-8",
            SOAPAction: "urn:getStatus",
        },
        body: soapEnvelope.trim(),
    });
    const responseText = await response.text();
    if (!response.ok || responseText.includes("faultcode")) {
        const faultCodeMatch = responseText.match(/<faultcode[^>]*>(.*?)<\/faultcode>/);
        const faultStringMatch = responseText.match(/<faultstring[^>]*>(.*?)<\/faultstring>/);
        throw new Error(`Rechazo de SUNAT: ${faultCodeMatch?.[1]?.replace("soap-env:", "")} - ${faultStringMatch?.[1]}`);
    }
    // El statusCode 0 significa procesado correctamente. 98 en proceso, 99 con errores.
    const statusCodeMatch = responseText.match(/<statusCode[^>]*>(.*?)<\/statusCode>/);
    const statusCode = statusCodeMatch ? statusCodeMatch[1] : "";
    const contentMatch = responseText.match(/<content[^>]*>(.*?)<\/content>/);
    const cdrZipBase64 = contentMatch ? contentMatch[1] : null;
    return { statusCode, cdrZipBase64 };
}
//# sourceMappingURL=apiSunat.js.map