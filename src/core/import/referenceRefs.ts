import type { BusinessLine } from "@/types";

/**
 * [IMPORT-FETCH-ALLORNOTHING] + [CATALOGREF-ANY]
 *
 * Decisiones puras del fetch de referencias del importador de ventas
 * (`src/app/admin/sales/import/page.tsx`), extraídas para poder anclarlas con
 * tests: vivían inline en la página y no tenían ninguna cobertura.
 */

/** Lo mínimo de un `QueryDocumentSnapshot` que necesitan los mappers. */
export interface DocLike {
  id: string;
  data(): Record<string, unknown>;
}

/** Lo mínimo de un `PromiseSettledResult` que necesita la partición. */
export interface SettledLike {
  status: "fulfilled" | "rejected";
}

/**
 * Nombres de las colecciones cuyo `getDocs` fue rechazado, en el orden en que
 * se pidieron. `names` y `settled` son posicionales: mismo índice, misma
 * colección.
 */
export function collectFailedRefs(
  names: readonly string[],
  settled: readonly SettledLike[],
): string[] {
  return names.filter((_, i) => settled[i]?.status === "rejected");
}

/**
 * Mensaje de error que NOMBRA cada colección caída.
 *
 * No hay "degradación parcial" a propósito: las 10 colecciones alimentan peso
 * o costo, así que una caída parcial haría MENTIR a los avisos existentes
 * ("sin catálogo" sobre un SKU que sí está, "sin costo" sobre uno que tiene
 * costo real), y `coil_finishes` degradaría sin ningún flag — peso metallic en
 * 0 y en silencio, el defecto que [IMPORT-WEIGHT-BYPASS] (v6.78.0) cerró.
 */
export function buildRefFailureMessage(failedNames: readonly string[], total: number): string {
  return (
    `No se pudieron cargar ${failedNames.length} de ${total} colecciones de referencia:\n` +
    failedNames.map((name) => `• ${name}`).join("\n") +
    `\n\nLa importación queda BLOQUEADA: las ${total} alimentan peso o costo. ` +
    `Recargá la página; si persiste, es un problema de permisos o de red.`
  );
}

/**
 * Mapea docs a refs del importador poniendo el spread de `data()` PRIMERO, de
 * modo que el `id` del documento y la `businessLine` de la colección de origen
 * GANEN sobre cualquier campo homónimo denormalizado adentro del doc.
 *
 * Antes esto se hacía con `{ sku: d.id, businessLine, ...d.data() } as any`:
 * el spread al final dejaba que un `sku` denormalizado pisara al `d.id` real,
 * y el `as any` apagaba toda la verificación de tipos.
 */
export function toRefsWithId<T extends { sku: string; businessLine: BusinessLine }>(
  docs: readonly DocLike[],
  businessLine: BusinessLine,
): T[] {
  return docs.map(
    (d) =>
      ({
        ...d.data(),
        sku: d.id,
        businessLine,
      }) as T,
  );
}
