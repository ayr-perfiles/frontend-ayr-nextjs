import JSZip from "jszip";
import crypto from "crypto";

/**
 * 1. Obtener Token OAuth2 de SUNAT
 */
export async function getSunatToken(): Promise<string> {
  const ruc = process.env.SUNAT_RUC!;
  const user = process.env.SUNAT_USER_SOL!;
  const password = process.env.SUNAT_PASS_SOL!;
  const clientId = process.env.SUNAT_CLIENT_ID!;
  const clientSecret = process.env.SUNAT_CLIENT_SECRET!;

  const authUrl = `https://api-seguridad.sunat.gob.pe/v1/clientessol/${clientId}/oauth2/token/`;

  const params = new URLSearchParams();
  params.append("grant_type", "password");
  params.append("scope", "https://api-cpe.sunat.gob.pe");
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  params.append("username", `${ruc}${user}`);
  params.append("password", password);

  const response = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(`Error obteniendo token SUNAT: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

/**
 * 2. Enviar la Guía de Remisión mediante API REST
 */
export async function sendGuiaToSunatRest(fileName: string, signedXml: string) {
  // 1. Obtener el Token
  const token = await getSunatToken();

  // 2. Comprimir el XML en un archivo ZIP
  const zip = new JSZip();
  zip.file(`${fileName}.xml`, signedXml);
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  // 3. Generar Base64 y Hash SHA-256 del ZIP
  const zipBase64 = zipBuffer.toString("base64");
  const hashZip = crypto.createHash("sha256").update(zipBuffer).digest("hex");

  // 4. Construir el payload JSON
  const payload = {
    archivo: {
      nomArchivo: `${fileName}.zip`,
      arcGreZip: zipBase64,
      hashZip: hashZip,
    },
  };

  const greUrl = `https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/${fileName}`;

  // 5. Hacer la petición a SUNAT CON DEBUG DETALLADO
  console.log("\n[DEBUG] 🚀 Enviando GRE a SUNAT...");
  console.log("[DEBUG] 📍 URL:", greUrl);
  console.log(
    "[DEBUG] 🔑 Token (primeros 50 chars):",
    token.substring(0, 50) + "...",
  );
  console.log("[DEBUG] 📦 FileName:", fileName);
  console.log("[DEBUG] 📄 Payload structure:", {
    archivo: {
      nomArchivo: payload.archivo.nomArchivo,
      arcGreZip: `[${payload.archivo.arcGreZip.length} chars]`,
      hashZip: payload.archivo.hashZip,
    },
  });

  const response = await fetch(greUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  console.log(
    "[DEBUG] 📊 Response status:",
    response.status,
    response.statusText,
  );
  console.log("[DEBUG] 📋 Response headers:");
  response.headers.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  });

  const responseData = await response.json();
  console.log(
    "[DEBUG] 📥 Response body:",
    JSON.stringify(responseData, null, 2),
  );

  if (!response.ok) {
    // Mensajes de error específicos según el código
    if (response.status === 401) {
      console.error("\n❌ ERROR 401: UNAUTHORIZED en el endpoint de GRE");
      console.error("\n📋 Checklist de diagnóstico:");
      console.error("  1️⃣  ¿Tu RUC está inscrito en el Registro de GRE?");
      console.error(
        "      → SOL → Comprobantes Electrónicos → GRE → Consultar Inscripción",
      );
      console.error("      → Debe decir 'ACTIVO'");
      console.error(
        "\n  2️⃣  ¿Habilitaste el servicio GEM en el Portal de Desarrolladores?",
      );
      console.error("      → https://api-cpe.sunat.gob.pe/");
      console.error("      → Mis Aplicaciones → Tu App → Permisos");
      console.error(
        "      → Debe tener marcado: 'API Guías de Remisión (GEM)'",
      );
      console.error("\n  3️⃣  ¿El token OAuth2 tiene el scope correcto?");
      console.error("      → Scope actual: 'https://api-cpe.sunat.gob.pe'");
      console.error("      → Verifica que cubra /gem/ endpoints");
      console.error("\n  4️⃣  ¿El fileName tiene el formato correcto?");
      console.error(`      → Formato actual: ${fileName}`);
      console.error("      → Debe ser: {RUC}-09-{SERIE}-{NUMERO}");
      console.error("      → Ejemplo: 20612769151-09-T001-00000001");
    }

    if (response.status === 400) {
      console.error("\n❌ ERROR 400: BAD REQUEST");
      console.error("  → El formato del payload o fileName es incorrecto");
      console.error("  → Revisa la estructura del JSON enviado arriba");
    }

    if (response.status === 403) {
      console.error("\n❌ ERROR 403: FORBIDDEN");
      console.error("  → Tu RUC no tiene permisos para este servicio");
      console.error("  → Contacta a SUNAT para solicitar acceso a GEM");
    }

    throw new Error(
      `Rechazo de SUNAT (GRE) [${response.status}]: ${JSON.stringify(responseData)}`,
    );
  }

  // 6. La API REST devuelve un ticket (proceso asíncrono)
  if (!responseData.numTicket) {
    throw new Error("SUNAT no devolvió un número de ticket para la Guía.");
  }

  console.log("✅ Guía enviada exitosamente. Ticket:", responseData.numTicket);
  return responseData.numTicket;
}

/**
 * 3. Consultar el estado del Ticket de una GRE en la API REST
 */
export async function getGreTicketStatusRest(numTicket: string) {
  const token = await getSunatToken();

  const url = `https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/envios/${numTicket}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(
      `Error consultando ticket GRE: ${JSON.stringify(responseData)}`,
    );
  }

  console.log(
    "✅ Estado del ticket consultado exitosamente:",
    responseData.error,
  );

  // codRespuesta: "0" = Aceptado, "98" = En proceso, "99" = Rechazado con error
  return {
    status: responseData.codRespuesta,
    cdrZipBase64: responseData.arcCdr,
    error: responseData.indEstadoCpe === "2" ? responseData.error : null,
  };
}
