// src/services/sunat/apiSunat.ts

import JSZip from "jszip";

export async function sendInvoiceToSunat(fileName: string, signedXml: string) {
  const ruc = process.env.SUNAT_RUC;
  const user = process.env.SUNAT_USER_SOL;
  const password = process.env.SUNAT_PASS_SOL;

  if (!ruc || !user || !password) {
    throw new Error("Faltan credenciales SOL en el .env.local");
  }

  // 1. Comprimir el XML Firmado en un ZIP
  const zip = new JSZip();
  zip.file(`${fileName}.xml`, signedXml);
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const zipBase64 = zipBuffer.toString("base64");

  // 2. Armar el "Sobre" SOAP (WS-Security)
  // SUNAT exige que el UsernameToken sea RUC + USUARIO todo junto
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

  // 3. Enviar a SUNAT (Usamos el entorno BETA para pruebas)
  // Cuando pases a producción, esta URL cambia a: https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService
  // Cuando pases a producción, esta URL cambia a: "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService
  const endpoint =
    "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      SOAPAction: "urn:sendBill",
    },
    body: soapEnvelope.trim(),
  });

  const responseText = await response.text();

  // Imprimimos la respuesta cruda en consola para depuración
  console.log("Respuesta cruda de SUNAT:", responseText);

  // 4. Analizar la respuesta de SUNAT
  // SUNAT a veces devuelve HTTP 200 OK pero con un SOAP Fault oculto por dentro
  if (!response.ok || responseText.includes("faultcode")) {
    const faultCodeMatch = responseText.match(
      /<faultcode[^>]*>(.*?)<\/faultcode>/,
    );
    const faultStringMatch = responseText.match(
      /<faultstring[^>]*>(.*?)<\/faultstring>/,
    );
    throw new Error(
      `Rechazo de SUNAT: ${faultCodeMatch?.[1]?.replace("soap-env:", "")} - ${faultStringMatch?.[1]}`,
    );
  }

  // 5. Extraer el CDR (El ZIP de respuesta de SUNAT en Base64)
  const cdrMatch = responseText.match(
    /<[^>]*applicationResponse[^>]*>([\s\S]*?)<\/[^>]*applicationResponse>/i,
  );

  if (!cdrMatch || !cdrMatch[1]) {
    throw new Error(
      `La SUNAT no devolvió la constancia de recepción (CDR). Respuesta del servidor: ${responseText.substring(0, 500)}...`,
    );
  }

  // Retornamos el ZIP Base64 para que luego lo subas a Firebase Storage
  return cdrMatch[1];
}
