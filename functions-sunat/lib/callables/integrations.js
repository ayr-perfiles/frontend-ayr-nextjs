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
exports.validarCpeSunat = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const secrets_1 = require("../config/secrets");
const sunatConsultaService_1 = require("../sunat/sunatConsultaService");
/**
 * Callable para validar un comprobante (CPE) en SUNAT
 */
exports.validarCpeSunat = (0, https_1.onCall)({ secrets: secrets_1.ALL_SECRETS }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Usuario no autenticado");
    }
    const params = request.data;
    if (!params.numRuc ||
        !params.codComp ||
        !params.numeroSerie ||
        !params.numero) {
        throw new https_1.HttpsError("invalid-argument", "Faltan parámetros obligatorios para la validación");
    }
    try {
        const result = await (0, sunatConsultaService_1.validarComprobanteSunat)(params);
        // Si se proporciona purchaseId, actualizamos el documento de la compra
        if (params.purchaseId) {
            const db = admin.firestore();
            await db
                .collection("purchases")
                .doc(params.purchaseId)
                .update({
                validacionSunat: {
                    valido: result.valido,
                    estadoCp: result.estadoCp,
                    estadoRuc: result.estadoRuc,
                    condDomiRuc: result.condDomiRuc,
                    fecha: firestore_1.FieldValue.serverTimestamp(),
                },
            });
            // Audit Log
            await db.collection("audit_logs").add({
                action: "VALIDATE_PURCHASE_CPE",
                entityId: params.purchaseId,
                userEmail: request.auth.token.email || "unknown",
                details: `Validación de CPE ${params.numeroSerie}-${params.numero}: ${result.estadoCp}`,
                timestamp: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        return { success: true, result };
    }
    catch (error) {
        console.error("Error en validarCpeSunat:", error);
        throw new https_1.HttpsError("internal", error.message || "Error al validar comprobante en SUNAT");
    }
});
//# sourceMappingURL=integrations.js.map