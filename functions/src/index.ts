export { produceFromCoils } from "./callables/production";
/**
 * Cloud Functions para AYR Steel ERP
 *
 * IMPORTANTE: Este archivo usa Firebase Functions v2.
 * Asegúrate de tener "firebase-functions": "^5.0.0" o superior en package.json
 */

import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { getNextSequence } from "./services/correlative";

// Inicializar Firebase Admin
admin.initializeApp();

// Configuración global
setGlobalOptions({
  maxInstances: 10,
  region: "us-central1",
});

// ════════════════════════════════════════════════════════════
// ADMINISTRACIÓN: Inicializar Integraciones
// ════════════════════════════════════════════════════════════

export const initializeIntegrations = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  // Solo ADMIN puede inicializar
  if (request.auth.token.role !== "ADMIN") {
    throw new HttpsError("permission-denied", "Permisos insuficientes");
  }

  const db = admin.firestore();
  const batch = db.batch();

  const integrations = [
    {
      id: "sunat-emision",
      data: {
        provider: "SUNAT",
        enabled: true,
        environment: "beta",
        config: {
          ruc: "20123456789", // TODO: reemplazar en setup
          razonSocial: "AYR STEEL S.A.C.", // TODO: reemplazar en setup
          direccionFiscal: "Av. Principal 123, Lima", // TODO: reemplazar en setup
          ubigeo: "150101", // TODO: reemplazar en setup
          series: {
            factura: "F001",
            boleta: "B001",
            notaCredito: "FC01",
            notaDebito: "FD01",
          },
          endpoints: {
            beta: "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService",
            prod: "https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService",
          },
        },
        status: {
          lastCheck: admin.firestore.FieldValue.serverTimestamp(),
          ok: true,
          message: "Inicializado",
        },
      },
    },
    {
      id: "sunat-consulta",
      data: {
        provider: "SUNAT",
        enabled: true,
        environment: "prod",
        config: {
          // NOTA: Estas credenciales se generan en SOL → Comprobantes → Consulta de Validez → Credenciales API
          // El client_id debe reemplazarse en la URL en tiempo de ejecución o configurarse según el manual
          tokenEndpoint: "https://api-seguridad.sunat.gob.pe/v1/clientesextranet/{client_id}/oauth2/token/",
          validationEndpoint: "https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/{numRuc}/validarcomprobante",
          grantType: "client_credentials",
        },
        status: {
          lastCheck: admin.firestore.FieldValue.serverTimestamp(),
          ok: true,
          message: "Inicializado",
        },
      },
    },
    {
      id: "apisnet",
      data: {
        provider: "APISNET",
        enabled: true,
        environment: "prod",
        config: {
          // Migrado de apis.net.pe/v2 a decolecta.com/v1
          baseUrl: "https://api.decolecta.com/v1",
        },
        status: {
          lastCheck: admin.firestore.FieldValue.serverTimestamp(),
          ok: true,
          message: "Inicializado",
        },
      },
    },
    {
      id: "algolia",
      data: {
        provider: "ALGOLIA",
        enabled: true,
        environment: "prod",
        config: {
          appId: "APP_ID", // TODO: reemplazar en setup
          indexName: "products",
          searchKey: "", // Clave pública (puedes pegarla aquí con seguridad)
        },
        status: {
          lastCheck: admin.firestore.FieldValue.serverTimestamp(),
          ok: true,
          message: "Inicializado",
        },
      },
    },
  ];

  for (const integration of integrations) {
    const ref = db.collection("integrations").doc(integration.id);
    batch.set(ref, integration.data, { merge: true });
  }

  await batch.commit();

  return { success: true, message: "Integraciones inicializadas correctamente" };
});

// ════════════════════════════════════════════════════════════
// SUNAT: Obtener siguiente correlativo
// ════════════════════════════════════════════════════════════

export const getNextSunatSequence = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const { serie } = request.data;
  if (!serie) {
    throw new HttpsError("invalid-argument", "La serie es requerida");
  }

  try {
    const sequence = await getNextSequence(serie);
    return { success: true, sequence };
  } catch (error) {
    console.error("Error obteniendo correlativo:", error);
    throw new HttpsError("internal", "Error al generar correlativo");
  }
});

// ════════════════════════════════════════════════════════════
// FUNCIÓN 1: Obtener siguiente número de venta (secuencial seguro)
// ════════════════════════════════════════════════════════════

export const getNextSaleNumber = onCall(async (request) => {
  // Verificar autenticación
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  // Verificar rol ADMIN
  const role = request.auth.token.role;
  if (role !== "ADMIN") {
    throw new HttpsError(
      "permission-denied",
      "Solo usuarios ADMIN pueden obtener números de venta",
    );
  }

  try {
    const settingsRef = admin.firestore().doc("settings/general_settings");

    // Usar transacción para garantizar atomicidad
    const newNumber = await admin
      .firestore()
      .runTransaction(async (transaction) => {
        const settingsDoc = await transaction.get(settingsRef);

        let nextNumber = 1;
        if (settingsDoc.exists) {
          nextNumber = settingsDoc.data()?.nextSaleNumber || 1;
        }

        // Incrementar para la próxima vez
        transaction.set(
          settingsRef,
          { nextSaleNumber: nextNumber + 1 },
          { merge: true },
        );

        return nextNumber;
      });

    const saleId = `V-${String(newNumber).padStart(6, "0")}`;

    return {
      success: true,
      saleId,
      saleNumber: newNumber,
    };
  } catch (error: any) {
    console.error("Error obteniendo número de venta:", error);
    throw new HttpsError("internal", "Error al generar número de venta");
  }
});

// ════════════════════════════════════════════════════════════
// FUNCIÓN 2: Trigger - Audit log automático al crear venta
// ════════════════════════════════════════════════════════════

export const onSaleCreated = onDocumentCreated(
  "sales/{saleId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data associated with the event");
      return;
    }

    const saleData = snapshot.data();
    const saleId = event.params.saleId;

    try {
      // Crear registro de auditoría
      await admin
        .firestore()
        .collection("audit_logs")
        .add({
          action: "SALE_CREATED",
          entityId: saleId,
          userEmail: saleData.sellerId || "unknown",
          details: `Venta ${saleId} creada. Total: ${saleData.totalAmount || 0}`,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

      console.log(`Audit log creado para venta ${saleId}`);
    } catch (error) {
      console.error("Error creando audit log:", error);
      // No lanzamos error para no bloquear la creación de la venta
    }
  },
);

// ════════════════════════════════════════════════════════════
// FUNCIÓN 3: Trigger - Audit log al crear bobina
// ════════════════════════════════════════════════════════════

export const onCoilCreated = onDocumentCreated(
  "coils/{coilId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const coilData = snapshot.data();
    const coilId = event.params.coilId;

    try {
      await admin
        .firestore()
        .collection("audit_logs")
        .add({
          action: "COIL_CREATED",
          entityId: coilId,
          userEmail: coilData.registeredBy || "unknown",
          details: `Bobina ${coilId} registrada. Peso: ${coilData.initialWeight}kg`,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

      console.log(`Audit log creado para bobina ${coilId}`);
    } catch (error) {
      console.error("Error creando audit log:", error);
    }
  },
);

// ════════════════════════════════════════════════════════════
// FUNCIÓN 4: Trigger - Audit log al crear log de producción
// ════════════════════════════════════════════════════════════

export const onProductionLogCreated = onDocumentCreated(
  "production_logs/{logId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const logData = snapshot.data();
    const logId = event.params.logId;

    try {
      await admin
        .firestore()
        .collection("audit_logs")
        .add({
          action: "PRODUCTION_LOG_CREATED",
          entityId: logId,
          userEmail: logData.operatorId || "unknown",
          details: `Producción ${logId}: ${logData.piecesProduced} piezas de ${logData.sku}`,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

      console.log(`Audit log creado para producción ${logId}`);
    } catch (error) {
      console.error("Error creando audit log:", error);
    }
  },
);

// ════════════════════════════════════════════════════════════
// FUNCIÓN 5: Trigger - Sincronizar Custom Claims de Usuarios
// ════════════════════════════════════════════════════════════

export const onUserWritten = onDocumentWritten(
  "users/{uid}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const uid = event.params.uid;
    const beforeData = snapshot.before.exists ? snapshot.before.data() : null;
    const afterData = snapshot.after.exists ? snapshot.after.data() : null;

    try {
      if (!afterData) {
        // Documento fue borrado -> Limpiar claims
        await admin.auth().setCustomUserClaims(uid, null);
        console.log(`[UsersTrigger] Usuario ${uid} borrado. Custom claims limpiados.`);
        return;
      }

      const currentRole = afterData.role;
      const currentIsActive = afterData.isActive !== false; // Si es undefined, asumimos true

      const previousRole = beforeData?.role;
      const previousIsActive = beforeData?.isActive !== false;

      // Solo sincronizamos si hay cambios reales (Idempotencia)
      const roleChanged = currentRole !== previousRole;
      const activeChanged = currentIsActive !== previousIsActive;

      if (!roleChanged && !activeChanged) {
        return; // No hay cambios que afecten los claims o el acceso
      }

      // Validar rol
      const validRoles = ["ADMIN", "SUPERVISOR", "OPERATOR"];
      if (currentRole && !validRoles.includes(currentRole)) {
        console.warn(`[UsersTrigger] Rol inválido para ${uid}: ${currentRole}`);
      }

      // Asignamos el claim al token
      await admin.auth().setCustomUserClaims(uid, { role: currentRole });
      console.log(`[UsersTrigger] Custom claims actualizados para ${uid}: { role: "${currentRole}" }`);

      // Propagación / Revocación crítica
      // Si se desactiva la cuenta, o se le hace "downgrade" (ej: de ADMIN a OPERATOR), forzamos cierre de sesión.
      const isDowngrade =
        (previousRole === "ADMIN" && currentRole !== "ADMIN") ||
        (previousRole === "SUPERVISOR" && currentRole === "OPERATOR");

      if (!currentIsActive || isDowngrade) {
        await admin.auth().revokeRefreshTokens(uid);
        console.log(`[UsersTrigger] Tokens revocados para ${uid} (isActive: ${currentIsActive}, downgrade: ${isDowngrade})`);
      }
    } catch (error) {
      console.error(`[UsersTrigger] Error actualizando claims para ${uid}:`, error);
    }
  },
);

// ════════════════════════════════════════════════════════════
// FUNCIÓN 6: Health check (para verificar que Functions funciona)
// ════════════════════════════════════════════════════════════

export const healthCheck = onCall(async () => {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "AYR Steel ERP Functions are running",
  };
});

// ════════════════════════════════════════════════════════════
// MERMAS: Registro de merma en bobinas
// ════════════════════════════════════════════════════════════

export { registerCoilScrap } from "./callables/scrap";
export { registerCoilSplit } from "./callables/split";

export { voidCoil, updateCoil, cancelCoilPlan } from "./callables/coilManagement";
