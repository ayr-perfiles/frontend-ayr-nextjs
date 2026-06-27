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
exports.getNextSequence = getNextSequence;
const admin = __importStar(require("firebase-admin"));
/**
 * Obtiene el siguiente correlativo para una serie específica (Ej: "F001")
 * y actualiza el contador de forma atómica y segura.
 */
async function getNextSequence(serie) {
    const db = admin.firestore();
    const counterRef = db.collection("sunatCounters").doc(serie);
    return await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(counterRef);
        let nextValue = 1;
        if (doc.exists) {
            nextValue = (doc.data()?.current || 0) + 1;
        }
        // Guardamos el nuevo valor
        transaction.set(counterRef, {
            current: nextValue,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        // La SUNAT exige 6 a 8 dígitos. Rellenamos con ceros a la izquierda (Ej: 000015)
        return nextValue.toString().padStart(6, "0");
    });
}
//# sourceMappingURL=correlative.js.map