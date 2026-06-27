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

export interface SunatEmisionConfig extends IntegrationConfig<{
  ruc: string;
  razonSocial: string;
  direccionFiscal: string;
  ubigeo: string;
  series: {
    factura: string;
    boleta: string;
    notaCredito: string;
    notaDebito: string;
  };
  endpoints: {
    beta: string;
    prod: string;
  };
}> {}

export interface SunatConsultaConfig extends IntegrationConfig<{
  tokenEndpoint: string;
  validationEndpoint: string;
  grantType: string;
}> {}

export interface ApisnetConfig extends IntegrationConfig<{
  baseUrl: string;
}> {}

export interface AlgoliaConfig extends IntegrationConfig<{
  appId: string;
  indexName: string;
  searchKey?: string;
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

/**
 * Resuelve el endpoint de SUNAT basado en el entorno configurado.
 * @param config Configuración de emisión SUNAT
 * @returns URL del endpoint
 */
export function getSunatEndpoint(config: SunatEmisionConfig): string {
  const { environment, config: sunatConfig } = config;
  return environment === "prod" ?
    sunatConfig.endpoints.prod :
    sunatConfig.endpoints.beta;
}
