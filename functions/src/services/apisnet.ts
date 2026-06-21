import { APISNET_TOKEN } from "../config/secrets";
import {
  IntegrationConfig,
  getIntegrationConfig,
} from "../config/integrations";

export interface ApisNetConfig extends IntegrationConfig {
  config: {
    baseUrl: string;
  };
}

/**
 * Consulta datos de un RUC usando decolecta.com (migrado de apis.net.pe)
 */
export async function fetchRucData(ruc: string, full = true) {
  const config = await getIntegrationConfig<ApisNetConfig>("apisnet");
  const token = APISNET_TOKEN.value();
  const baseUrl = config.config.baseUrl;

  const endpoint = full
    ? `${baseUrl}/sunat/ruc/full?numero=${ruc}`
    : `${baseUrl}/sunat/ruc?numero=${ruc}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const rawData = await response.json();
  console.log("RAW Response from decolecta (RUC):", JSON.stringify(rawData));

  if (!response.ok) {
    console.error("Error consultando RUC en decolecta:", rawData);
    throw new Error(
      `apis.net devolvió ${response.status}: ${JSON.stringify(rawData)}`,
    );
  }

  return rawData;
}

/**
 * Consulta datos de un DNI usando decolecta.com (migrado de apis.net.pe)
 */
export async function fetchDniData(dni: string) {
  const config = await getIntegrationConfig<ApisNetConfig>("apisnet");
  const token = APISNET_TOKEN.value();
  const baseUrl = config.config.baseUrl;

  const response = await fetch(`${baseUrl}/reniec/dni?numero=${dni}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const rawData = await response.json();
  console.log("RAW Response from decolecta (DNI):", JSON.stringify(rawData));

  if (!response.ok) {
    console.error("Error consultando DNI en decolecta:", rawData);
    throw new Error(
      `apis.net devolvió ${response.status}: ${JSON.stringify(rawData)}`,
    );
  }

  return rawData;
}
