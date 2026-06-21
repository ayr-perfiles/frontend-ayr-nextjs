import * as admin from "firebase-admin";

/**
 * Script de Seed para Integraciones en el Emulador
 * Este script escribe los documentos de configuración base en la colección `integrations`.
 */

async function seed() {
  const projectId = "ayrsteel-2026";

  // Verificar que estamos en el emulador
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error("❌ ERROR: Este script solo debe correr contra el emulador.");
    console.error("Por favor, setea la variable de entorno FIRESTORE_EMULATOR_HOST.");
    console.error("Ejemplo: cross-env FIRESTORE_EMULATOR_HOST=localhost:8080 ts-node scripts/seedIntegrations.ts");
    process.exit(1);
  }

  console.log(`🌱 Iniciando seed de integraciones para el proyecto: ${projectId}...`);

  admin.initializeApp({ projectId });
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
          ruc: "20123456789",
          razonSocial: "AYR STEEL S.A.C.",
          direccionFiscal: "Av. Principal 123, Lima",
          ubigeo: "150101",
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
          message: "Seed local",
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
          tokenEndpoint: "https://api-seguridad.sunat.gob.pe/v1/clientesextranet/{client_id}/oauth2/token/",
          validationEndpoint: "https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/{numRuc}/validarcomprobante",
          grantType: "client_credentials",
        },
        status: {
          lastCheck: admin.firestore.FieldValue.serverTimestamp(),
          ok: true,
          message: "Seed local",
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
          message: "Seed local",
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
          appId: "APP_ID",
          indexName: "products",
          searchKey: "",
        },
        status: {
          lastCheck: admin.firestore.FieldValue.serverTimestamp(),
          ok: true,
          message: "Seed local",
        },
      },
    },
  ];

  for (const integration of integrations) {
    const ref = db.collection("integrations").doc(integration.id);
    batch.set(ref, integration.data, { merge: true });
    console.log(`   ✅ Preparado: ${integration.id}`);
  }

  await batch.commit();
  console.log("🚀 Seed completado exitosamente.");
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Error durante el seed:", error);
  process.exit(1);
});
