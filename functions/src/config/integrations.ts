import * as admin from "firebase-admin";

export type Environment = "beta" | "prod";

export interface IntegrationConfig<TConfig = unknown> {
  provider: string;
  enabled: boolean;
  environment: Environment;
  config: TConfig;
  status: {
    lastCheck: admin.firestore.Timestamp | null;
    ok: boolean;
    message: string;
  };
}

export interface ApisnetConfig extends IntegrationConfig<{
  baseUrl: string;
}> {}

/**
 * Obtiene la configuración de una integración desde Firestore.
 * @param id ID del documento en la colección 'integrations'
 * @returns Configuración de la integración
 */
export async function getIntegrationConfig<T extends IntegrationConfig<any>>(
  id: string,
): Promise<T> {
  const doc = await admin.firestore().collection("integrations").doc(id).get();

  if (!doc.exists) {
    throw new Error(`Integración '${id}' no encontrada en Firestore.`);
  }

  return doc.data() as T;
}
