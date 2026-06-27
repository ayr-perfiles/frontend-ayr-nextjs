import { SUNAT_CONSULTA_CLIENT_ID, SUNAT_CONSULTA_CLIENT_SECRET } from "../config/secrets";
import { IntegrationConfig, getIntegrationConfig } from "../config/integrations";

export interface SunatConsultaConfig extends IntegrationConfig {
  config: {
    tokenEndpoint: string;
    validationEndpoint: string;
  };
}

export interface CpeValidationParams {
  numRuc: string; // RUC del emisor
  codComp: string; // Tipo de comprobante (01, 03, etc)
  numeroSerie: string;
  numero: string;
  fechaEmision: string; // YYYY-MM-DD
  monto: string; // Total de la operación
}

/**
 * Obtiene el token de acceso OAuth2 para la API de Consulta de CPE
 */
async function getSunatAccessToken(config: SunatConsultaConfig): Promise<string> {
  const clientId = SUNAT_CONSULTA_CLIENT_ID.value();
  const clientSecret = SUNAT_CONSULTA_CLIENT_SECRET.value();

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("scope", "https://api.sunat.gob.pe/v1/contribuyente/contribuyentes");
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);

  const response = await fetch(config.config.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Error obteniendo token SUNAT:", errorText);
    throw new Error("No se pudo obtener el token de acceso de SUNAT");
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Valida un comprobante electrónico directamente con SUNAT
 */
export async function validarComprobanteSunat(params: CpeValidationParams) {
  const config = await getIntegrationConfig<SunatConsultaConfig>("sunat-consulta");
  const token = await getSunatAccessToken(config);

  const url = config.config.validationEndpoint.replace("{numRuc}", params.numRuc);

  const body = {
    numRuc: params.numRuc,
    codComp: params.codComp,
    numeroSerie: params.numeroSerie,
    numero: params.numero,
    fechaEmision: params.fechaEmision,
    monto: params.monto,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Error validando comprobante SUNAT:", errorData);
    throw new Error(errorData.errors?.[0]?.msg || "Error en la validación de SUNAT");
  }

  const data = await response.json();
  return mapSunatResponse(data.data);
}

/**
 * Mapea la respuesta de SUNAT a un formato amigable en español
 */
function mapSunatResponse(data: any) {
  const estadoCpMap: Record<string, string> = {
    "0": "NO EXISTE",
    "1": "ACEPTADO",
    "2": "ANULADO",
    "3": "AUTORIZADO",
    "4": "NO AUTORIZADO",
  };

  const estadoRucMap: Record<string, string> = {
    "00": "ACTIVO",
    "01": "BAJA PROVISIONAL",
    "02": "BAJA PROV. POR OFICIO",
    "03": "SUSPENSION TEMPORAL",
    "10": "BAJA DEFINITIVA",
    "11": "BAJA DE OFICIO",
    "22": "INHABILITADO-VENTA-SUCESION",
  };

  const condDomiRucMap: Record<string, string> = {
    "00": "HABIDO",
    "01": "NO HALLADO",
    "02": "NO HABIDO",
    "03": "PENDIENTE",
    "04": "NO HALLADO SEQ. EN PROCESO",
    "05": "NO HABIDO ATENCION DENUNCIA",
    "06": "SUSPENSION TEMPORAL",
    "07": "BAJA DEFINITIVA",
    "08": "BAJA DE OFICIO",
    "09": "SUSPENSION DE OFICIO",
  };

  return {
    valido: data.estadoCp === "1" || data.estadoCp === "3",
    estadoCp: estadoCpMap[data.estadoCp] || `OTRO (${data.estadoCp})`,
    estadoRuc: estadoRucMap[data.estadoRuc] || `OTRO (${data.estadoRuc})`,
    condDomiRuc: condDomiRucMap[data.condDomiRuc] || `OTRO (${data.condDomiRuc})`,
    observaciones: data.observaciones || [],
  };
}
