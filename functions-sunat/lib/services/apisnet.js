"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchRucData = fetchRucData;
exports.fetchDniData = fetchDniData;
const secrets_1 = require("../config/secrets");
const integrations_1 = require("../config/integrations");
/**
 * Consulta datos de un RUC usando decolecta.com (migrado de apis.net.pe)
 */
async function fetchRucData(ruc, full = true) {
    const config = await (0, integrations_1.getIntegrationConfig)("apisnet");
    const token = secrets_1.APISNET_TOKEN.value();
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
        throw new Error(`apis.net devolvió ${response.status}: ${JSON.stringify(rawData)}`);
    }
    return rawData;
}
/**
 * Consulta datos de un DNI usando decolecta.com (migrado de apis.net.pe)
 */
async function fetchDniData(dni) {
    const config = await (0, integrations_1.getIntegrationConfig)("apisnet");
    const token = secrets_1.APISNET_TOKEN.value();
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
        throw new Error(`apis.net devolvió ${response.status}: ${JSON.stringify(rawData)}`);
    }
    return rawData;
}
//# sourceMappingURL=apisnet.js.map