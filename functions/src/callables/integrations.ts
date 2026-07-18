import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { APISNET_TOKEN } from "../config/secrets";
import { fetchRucData, fetchDniData } from "../services/apisnet";

/**
 * Callable para consultar datos de RUC en APIS.NET (decolecta.com)
 */
export const consultarRuc = onCall(
  { secrets: [APISNET_TOKEN] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    const { ruc, full = true } = request.data;
    if (!ruc || ruc.length !== 11) {
      throw new HttpsError(
        "invalid-argument",
        "RUC inválido. Debe tener 11 dígitos.",
      );
    }

    try {
      const data = await fetchRucData(ruc, full);

      // Audit Log
      const db = admin.firestore();
      await db.collection("audit_logs").add({
        action: "ENRICH_PARTY_DATA",
        entityId: ruc,
        userEmail: request.auth.token.email || "unknown",
        details: `Consulta de RUC: ${data.razonSocial || data.razon_social || "Desconocido"}`,
        timestamp: FieldValue.serverTimestamp(),
      });

      return { success: true, data };
    } catch (error: any) {
      console.error("Error en consultarRuc:", error);
      const message = error.message || "Error al consultar RUC";
      throw new HttpsError(
        "internal",
        message.includes("apis.net")
          ? message
          : `Error al consultar RUC: ${message}`,
      );
    }
  },
);

/**
 * Callable para consultar datos de DNI en APIS.NET (decolecta.com)
 */
export const consultarDni = onCall(
  { secrets: [APISNET_TOKEN] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    const { dni } = request.data;
    if (!dni || dni.length !== 8) {
      throw new HttpsError(
        "invalid-argument",
        "DNI inválido. Debe tener 8 dígitos.",
      );
    }

    try {
      const data = await fetchDniData(dni);

      // Audit Log
      const db = admin.firestore();
      await db.collection("audit_logs").add({
        action: "ENRICH_PARTY_DATA",
        entityId: dni,
        userEmail: request.auth.token.email || "unknown",
        details:
          `Consulta de DNI: ${data.nombres || ""} ${data.apellidoPaterno || ""}`.trim() ||
          "Desconocido",
        timestamp: FieldValue.serverTimestamp(),
      });

      return { success: true, data };
    } catch (error: any) {
      console.error("Error en consultarDni:", error);
      const message = error.message || "Error al consultar DNI";
      throw new HttpsError(
        "internal",
        message.includes("apis.net")
          ? message
          : `Error al consultar DNI: ${message}`,
      );
    }
  },
);
