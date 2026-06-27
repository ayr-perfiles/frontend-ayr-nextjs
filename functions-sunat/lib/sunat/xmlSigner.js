"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.signXml = signXml;
const forge = __importStar(require("node-forge"));
const xml_crypto_1 = require("xml-crypto");
const secrets_1 = require("../config/secrets");
/**
 * Extrae la llave privada (PEM) y el certificado (PEM) del PFX (.p12)
 */
function extractKeysFromPfx(pfxBase64, password) {
    const pfxDer = forge.util.decode64(pfxBase64);
    const p12Asn1 = forge.asn1.fromDer(pfxDer);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag]?.[0];
    if (!certBag?.cert)
        throw new Error("Certificado no encontrado en el .p12");
    const certPem = forge.pki.certificateToPem(certBag.cert);
    const keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0] ??
        p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];
    if (!keyBag?.key)
        throw new Error("Llave privada no encontrada en el .p12");
    const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);
    return { privateKeyPem, certPem };
}
/**
 * Firma el XML con XMLDSig usando xml-crypto v6 (C14N real).
 */
function signXml(xmlString) {
    // Obtenemos los valores de los secretos en tiempo de ejecución
    const pfxBase64 = secrets_1.SUNAT_CERT_BASE64.value();
    const password = secrets_1.SUNAT_CERT_PASSWORD.value();
    const { privateKeyPem, certPem } = extractKeysFromPfx(pfxBase64, password);
    const sig = new xml_crypto_1.SignedXml({
        privateKey: privateKeyPem,
        publicCert: certPem,
        signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
        canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    });
    sig.addReference({
        xpath: "/*",
        isEmptyUri: true,
        transforms: [
            "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
            "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
        ],
        digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
    });
    sig.computeSignature(xmlString, { prefix: "ds" });
    const signedXml = sig.getSignedXml();
    const sigStart = signedXml.indexOf("<ds:Signature");
    const sigEnd = signedXml.indexOf("</ds:Signature>") + "</ds:Signature>".length;
    if (sigStart === -1 || sigEnd < "</ds:Signature>".length) {
        throw new Error("xml-crypto no generó el bloque <ds:Signature>");
    }
    const signatureBlock = signedXml.substring(sigStart, sigEnd);
    const xmlSinFirma = signedXml.slice(0, sigStart) + signedXml.slice(sigEnd);
    const finalXml = xmlSinFirma.replace(/<ext:ExtensionContent\s*(?:\/>|><\/ext:ExtensionContent>)/, () => `<ext:ExtensionContent>${signatureBlock}</ext:ExtensionContent>`);
    if (!finalXml.includes("<ds:Signature")) {
        throw new Error("No se pudo inyectar la firma: <ext:ExtensionContent> no encontrado.");
    }
    return finalXml;
}
//# sourceMappingURL=xmlSigner.js.map