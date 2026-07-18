"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_SECRETS = exports.ALGOLIA_ADMIN_KEY = exports.SUNAT_CONSULTA_CLIENT_SECRET = exports.SUNAT_CONSULTA_CLIENT_ID = exports.SUNAT_CERT_PASSWORD = exports.SUNAT_CERT_BASE64 = exports.SUNAT_PASS_SOL = exports.SUNAT_USER_SOL = void 0;
const params_1 = require("firebase-functions/params");
/**
 * Secretos de integración para SUNAT y otros servicios externos.
 * Estos deben ser configurados usando:
 * firebase functions:secrets:set NOMBRE_DEL_SECRETO
 */
// Credenciales SUNAT SOL
exports.SUNAT_USER_SOL = (0, params_1.defineSecret)("SUNAT_USER_SOL");
exports.SUNAT_PASS_SOL = (0, params_1.defineSecret)("SUNAT_PASS_SOL");
exports.SUNAT_CERT_BASE64 = (0, params_1.defineSecret)("SUNAT_CERT_BASE64");
exports.SUNAT_CERT_PASSWORD = (0, params_1.defineSecret)("SUNAT_CERT_PASSWORD");
// Credenciales SUNAT Consulta de Validez (OAuth2)
exports.SUNAT_CONSULTA_CLIENT_ID = (0, params_1.defineSecret)("SUNAT_CONSULTA_CLIENT_ID");
exports.SUNAT_CONSULTA_CLIENT_SECRET = (0, params_1.defineSecret)("SUNAT_CONSULTA_CLIENT_SECRET");
// Algolia Admin Key para re-indexación manual si fuera necesario
exports.ALGOLIA_ADMIN_KEY = (0, params_1.defineSecret)("ALGOLIA_ADMIN_KEY");
/**
 * Lista de todos los secretos para pasar al 'runWith' o 'onCall' (v2 options)
 */
exports.ALL_SECRETS = [
    exports.SUNAT_USER_SOL,
    exports.SUNAT_PASS_SOL,
    exports.SUNAT_CERT_BASE64,
    exports.SUNAT_CERT_PASSWORD,
    exports.SUNAT_CONSULTA_CLIENT_ID,
    exports.SUNAT_CONSULTA_CLIENT_SECRET,
    exports.ALGOLIA_ADMIN_KEY,
];
//# sourceMappingURL=secrets.js.map