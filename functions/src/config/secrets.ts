import { defineSecret } from "firebase-functions/params";

// API Token para consultas de RUC/DNI (apis.net.pe/decolecta)
export const APISNET_TOKEN = defineSecret("APISNET_TOKEN");

export const ALL_SECRETS = [
  APISNET_TOKEN,
];
