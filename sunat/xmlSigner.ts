// src/services/sunat/xmlSigner.ts
import * as forge from "node-forge";
import { SignedXml } from "xml-crypto";

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
 *
 * Notas clave sobre xml-crypto v6:
 *  - `xpath` selecciona QUÉ NODOS se hashean.
 *  - `isEmptyUri: true` produce URI="" en el XML de salida (referencia al documento completo).
 *  - La firma se inyecta en <ext:ExtensionContent> como exige SUNAT.
 *
 * El namespace xmlns:ds debe estar declarado en el root del XML generado por
 * xmlGenerator.ts para que la inyección sea válida bajo validación estricta.
 */
export function signXml(xmlString: string): string {
  const { privateKeyPem, certPem } = extractKeysFromPfx(
    process.env.SUNAT_CERT_BASE64!,
    process.env.SUNAT_CERT_PASSWORD!,
  );

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

  // Paso 1: xml-crypto calcula la firma y la añade al final del root
  sig.computeSignature(xmlString, { prefix: "ds" });
  const signedXml = sig.getSignedXml();

  // Paso 2: extraer el bloque <ds:Signature>
  const sigStart = signedXml.indexOf("<ds:Signature");
  const sigEnd =
    signedXml.indexOf("</ds:Signature>") + "</ds:Signature>".length;

  if (sigStart === -1 || sigEnd < "</ds:Signature>".length) {
    throw new Error("xml-crypto no generó el bloque <ds:Signature>");
  }
  const signatureBlock = signedXml.substring(sigStart, sigEnd);

  // Paso 3: quitar la firma del lugar donde xml-crypto la puso (final del root)
  // ── FIX: use a targeted replace that won't break if signatureBlock contains
  //    characters that are special to String.replace ($ signs in base64).
  const xmlSinFirma = signedXml.slice(0, sigStart) + signedXml.slice(sigEnd);

  // Paso 4: inyectar dentro de <ext:ExtensionContent> (vacío o auto-cerrado)
  const finalXml = xmlSinFirma.replace(
    /<ext:ExtensionContent\s*(?:\/>|><\/ext:ExtensionContent>)/,
    () => `<ext:ExtensionContent>${signatureBlock}</ext:ExtensionContent>`,
    // ↑ Using a replacer function avoids String.replace treating `$` in the
    //   signature's base64 values as special replacement patterns.
  );

  if (!finalXml.includes("<ds:Signature")) {
    throw new Error(
      "No se pudo inyectar la firma: <ext:ExtensionContent> no encontrado. " +
        "Verifica que xmlGenerator.ts genera ese nodo vacío.",
    );
  }

  // ── DEBUG: imprime el XML firmado final para validación antes de enviar ──
  // Elimina estas líneas una vez que SUNAT acepte el documento.
  console.log(
    "[signXml] XML firmado (primeros 2000 chars):\n",
    finalXml.substring(0, 2000),
  );
  console.log(
    "[signXml] XML firmado (últimos 500 chars):\n",
    finalXml.substring(finalXml.length - 500),
  );

  return finalXml;
}
