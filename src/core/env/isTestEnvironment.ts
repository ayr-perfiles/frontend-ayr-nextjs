/**
 * Project id de PRODUCCIÓN. Es la única fuente de verdad para distinguir entorno.
 *
 * ⚠️ El eje es el **projectId de Firebase**, NUNCA `NODE_ENV`. Un `next build` de la rama
 * apuntando a `ayrsteel-test` corre con `NODE_ENV==='production'` y sería indistinguible
 * de prod; y `npm run dev` contra prod (posible: `NEXT_PUBLIC_USE_EMULATOR="false"`) sería
 * indistinguible de test. Lo que importa es a qué base le estamos escribiendo.
 */
export const PROD_PROJECT_ID = "ayrsteel-2026";

/**
 * `true` cuando la app NO está apuntando a producción — es decir, cuando cualquier
 * escritura cae en una base que no es la del cliente.
 *
 * Fail-loud a propósito: un projectId ausente, vacío o solo espacios cuenta como
 * NO-producción y muestra la franja. Preferimos una franja de más en un entorno mal
 * configurado que una de menos en algo que en realidad es prod.
 *
 * La comparación es exacta y sensible a mayúsculas: un id que difiere en un carácter
 * es, literalmente, otro proyecto de Firebase.
 */
export function isTestEnvironment(projectId: string | undefined | null): boolean {
  return (projectId ?? "").trim() !== PROD_PROJECT_ID;
}
