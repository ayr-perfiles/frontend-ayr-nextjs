import { defineSecret } from "firebase-functions/params";

/**
 * Secretos de integración para SUNAT y otros servicios externos.
 * Estos deben ser configurados usando:
 * firebase functions:secrets:set NOMBRE_DEL_SECRETO
 */

// Credenciales SUNAT SOL
export const SUNAT_USER_SOL = defineSecret("SUNAT_USER_SOL");
export const SUNAT_PASS_SOL = defineSecret("SUNAT_PASS_SOL");
export const SUNAT_CERT_BASE64 = defineSecret("SUNAT_CERT_BASE64");
export const SUNAT_CERT_PASSWORD = defineSecret("SUNAT_CERT_PASSWORD");

// Credenciales SUNAT Consulta de Validez (OAuth2)
export const SUNAT_CONSULTA_CLIENT_ID = defineSecret(
  "SUNAT_CONSULTA_CLIENT_ID",
);
export const SUNAT_CONSULTA_CLIENT_SECRET = defineSecret(
  "SUNAT_CONSULTA_CLIENT_SECRET",
);


// Algolia Admin Key para re-indexación manual si fuera necesario
export const ALGOLIA_ADMIN_KEY = defineSecret("ALGOLIA_ADMIN_KEY");

/**
 * Lista de todos los secretos para pasar al 'runWith' o 'onCall' (v2 options)
 */
export const ALL_SECRETS = [
  SUNAT_USER_SOL,
  SUNAT_PASS_SOL,
  SUNAT_CERT_BASE64,
  SUNAT_CERT_PASSWORD,
  SUNAT_CONSULTA_CLIENT_ID,
  SUNAT_CONSULTA_CLIENT_SECRET,
  ALGOLIA_ADMIN_KEY,
];
