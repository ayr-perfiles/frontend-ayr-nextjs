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
exports.confirmPurchaseStaging = exports.parsePurchaseXml = exports.importSireRce = exports.validarCpeSunat = exports.consultarEstadoBaja = exports.comunicarBaja = exports.emitirComprobante = void 0;
const v2_1 = require("firebase-functions/v2");
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp();
}
(0, v2_1.setGlobalOptions)({
    maxInstances: 10,
    region: "us-central1",
});
// SUNAT: Emisión y Bajas
var callables_1 = require("./sunat/callables");
Object.defineProperty(exports, "emitirComprobante", { enumerable: true, get: function () { return callables_1.emitirComprobante; } });
Object.defineProperty(exports, "comunicarBaja", { enumerable: true, get: function () { return callables_1.comunicarBaja; } });
Object.defineProperty(exports, "consultarEstadoBaja", { enumerable: true, get: function () { return callables_1.consultarEstadoBaja; } });
// INTEGRACIONES: Validación CPE
var integrations_1 = require("./callables/integrations");
Object.defineProperty(exports, "validarCpeSunat", { enumerable: true, get: function () { return integrations_1.validarCpeSunat; } });
// COMPRAS: Importación SIRE/RCE y XML
var purchases_1 = require("./callables/purchases");
Object.defineProperty(exports, "importSireRce", { enumerable: true, get: function () { return purchases_1.importSireRce; } });
Object.defineProperty(exports, "parsePurchaseXml", { enumerable: true, get: function () { return purchases_1.parsePurchaseXml; } });
Object.defineProperty(exports, "confirmPurchaseStaging", { enumerable: true, get: function () { return purchases_1.confirmPurchaseStaging; } });
//# sourceMappingURL=index.js.map