import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { ALL_SECRETS } from "../config/secrets";
import {
  validarComprobanteSunat,
  CpeValidationParams,
} from "../sunat/sunatConsultaService";

/**
 * Callable para validar un comprobante (CPE) en SUNAT
 */
export const validarCpeSunat = onCall(
  { secrets: ALL_SECRETS },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    const params = request.data as CpeValidationParams & {
      purchaseId?: string;
    };
    if (
      !params.numRuc ||
      !params.codComp ||
      !params.numeroSerie ||
      !params.numero
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Faltan parámetros obligatorios para la validación",
      );
    }

    try {
      const result = await validarComprobanteSunat(params);

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
              fecha: FieldValue.serverTimestamp(),
            },
          });

        // Audit Log
        await db.collection("audit_logs").add({
          action: "VALIDATE_PURCHASE_CPE",
          entityId: params.purchaseId,
          userEmail: request.auth.token.email || "unknown",
          details: `Validación de CPE ${params.numeroSerie}-${params.numero}: ${result.estadoCp}`,
          timestamp: FieldValue.serverTimestamp(),
        });
      }

      return { success: true, result };
    } catch (error: any) {
      console.error("Error en validarCpeSunat:", error);
      throw new HttpsError(
        "internal",
        error.message || "Error al validar comprobante en SUNAT",
      );
    }
  },
);

