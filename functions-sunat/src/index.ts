import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

setGlobalOptions({
  maxInstances: 10,
  region: "us-central1",
});

// SUNAT: Emisión y Bajas
export { emitirComprobante, comunicarBaja, consultarEstadoBaja } from "./sunat/callables";

// INTEGRACIONES: Validación CPE y Consultas RUC/DNI
export { validarCpeSunat, consultarRuc, consultarDni } from "./callables/integrations";

// COMPRAS: Importación SIRE/RCE y XML
export { importSireRce, parsePurchaseXml, confirmPurchaseStaging } from "./callables/purchases";
