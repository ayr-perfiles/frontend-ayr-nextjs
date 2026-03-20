import { algoliasearch } from "algoliasearch";

// Inicializamos una única instancia global del cliente
export const algoliaClient = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || "",
  process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY || "",
);

// Definimos los nombres de los índices en un solo lugar
export const ALGOLIA_INDICES = {
  COILS: "coils_index",
  CUSTOMERS: "customers_index",
  CONTACTS: "contacts_index",
  SALES: "sales_index", // <--- Agregamos este
};
