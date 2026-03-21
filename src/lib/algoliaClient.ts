import { getSystemSettings } from "@/services/settingsService";
import { algoliasearch } from "algoliasearch";

// Inicializamos una única instancia global del cliente
export const algoliaClient = {
  searchSingleIndex: async ({ indexName, searchParams }: any) => {
    try {
      // 1. Traemos la configuración guardada en Firebase
      const settings = await getSystemSettings();

      // 2. Prioridad: Firebase > Archivo .env local
      const appId =
        settings?.algoliaAppId || process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || "";
      const apiKey =
        settings?.algoliaSearchKey ||
        process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY ||
        "";

      // 3. Validación de seguridad
      if (!appId || !apiKey) {
        console.warn(
          "⚠️ Faltan las credenciales de Algolia. Ve a Ajustes > Integraciones.",
        );
        return { hits: [] }; // Retornamos vacío para no romper la app
      }

      // 4. Inicializamos el cliente de Algolia al vuelo
      const client = algoliasearch(appId, apiKey);

      // 5. Ejecutamos la búsqueda real
      const response = await client.searchSingleIndex({
        indexName,
        searchParams,
      });

      return response;
    } catch (error) {
      console.error("Error en búsqueda predictiva Algolia:", error);
      return { hits: [] };
    }
  },
};

// Definimos los nombres de los índices en un solo lugar
export const ALGOLIA_INDICES = {
  COILS: "coils_index",
  CUSTOMERS: "customers_index",
  CONTACTS: "contacts_index",
  SALES: "sales_index", // <--- Agregamos este
};
