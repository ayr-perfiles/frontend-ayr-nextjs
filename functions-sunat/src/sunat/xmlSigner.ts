import * as forge from "node-forge";
import { SignedXml } from "xml-crypto";
import { SUNAT_CERT_BASE64, SUNAT_CERT_PASSWORD } from "../config/secrets";

/**
 * Extrae la llave privada (PEM) y el certificado (PEM) del PFX (.p12)
 */
function extractKeysFromPfx(pfxBase64: string, password: string) {
  const pfxDer = forge.util.decode64(pfxBase64);
  const p12Asn1 = forge.asn1.fromDer(pfxDer);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  if (!certBag?.cert) throw new Error("Certificado no encontrado en el .p12");
  const certPem = forge.pki.certificateToPem(certBag.cert);

  const keyBag =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ]?.[0] ??
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];

  if (!keyBag?.key) throw new Error("Llave privada no encontrada en el .p12");
  const privateKeyPem = forge.pki.privateKeyToPem(
    keyBag.key as forge.pki.rsa.PrivateKey,
  );

  return { privateKeyPem, certPem };
}

/**
 * Firma el XML con XMLDSig usando xml-crypto v6 (C14N real).
 */
export function signXml(xmlString: string): string {
  // Obtenemos los valores de los secretos en tiempo de ejecución
  const pfxBase64 = SUNAT_CERT_BASE64.value();
  const password = SUNAT_CERT_PASSWORD.value();

  const { privateKeyPem, certPem } = extractKeysFromPfx(pfxBase64, password);

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certPem,
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    canonicalizationAlgorithm:
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
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
  const sigEnd =
    signedXml.indexOf("</ds:Signature>") + "</ds:Signature>".length;

  if (sigStart === -1 || sigEnd < "</ds:Signature>".length) {
    throw new Error("xml-crypto no generó el bloque <ds:Signature>");
  }
  const signatureBlock = signedXml.substring(sigStart, sigEnd);

  const xmlSinFirma = signedXml.slice(0, sigStart) + signedXml.slice(sigEnd);

  const finalXml = xmlSinFirma.replace(
    /<ext:ExtensionContent\s*(?:\/>|><\/ext:ExtensionContent>)/,
    () => `<ext:ExtensionContent>${signatureBlock}</ext:ExtensionContent>`,
  );

  if (!finalXml.includes("<ds:Signature")) {
    throw new Error(
      "No se pudo inyectar la firma: <ext:ExtensionContent> no encontrado.",
    );
  }

  return finalXml;
}
