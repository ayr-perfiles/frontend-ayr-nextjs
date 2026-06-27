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
exports.getIntegrationConfig = getIntegrationConfig;
exports.getSunatEndpoint = getSunatEndpoint;
const admin = __importStar(require("firebase-admin"));
/**
 * Obtiene la configuración de una integración desde Firestore.
 * @param id ID del documento en la colección 'integrations'
 * @returns Configuración de la integración
 */
async function getIntegrationConfig(id) {
    const doc = await admin.firestore().collection("integrations").doc(id).get();
    if (!doc.exists) {
        throw new Error(`Integración '${id}' no encontrada en Firestore.`);
    }
    return doc.data();
}
/**
 * Resuelve el endpoint de SUNAT basado en el entorno configurado.
 * @param config Configuración de emisión SUNAT
 * @returns URL del endpoint
 */
function getSunatEndpoint(config) {
    const { environment, config: sunatConfig } = config;
    return environment === "prod" ?
        sunatConfig.endpoints.prod :
        sunatConfig.endpoints.beta;
}
//# sourceMappingURL=integrations.js.map