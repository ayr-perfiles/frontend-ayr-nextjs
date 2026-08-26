import { Coil } from "@/types";

/**
 * Bobinas cuyo `finish` está en `finishIds`. Puro, no muta la entrada.
 * `finishIds` vacío ⇒ `[]` (vacío significa "ninguna línea matchea", NUNCA "todas").
 * Bobina sin `finish` (undefined/null/"") ⇒ excluida.
 */
export function scopeCoilsByFinishIds(coils: Coil[], finishIds: string[]): Coil[] {
  if (finishIds.length === 0) return [];
  const allowed = new Set(finishIds);
  return coils.filter((c) => !!c.finish && allowed.has(c.finish));
}

/**
 * Página `page` (1-indexed) de `items`, de tamaño `pageSize`.
 * page 1 = items[0..pageSize). Página < 1 o fuera de rango ⇒ `[]`.
 * El guard `page < 1` es explícito: `slice` con índices negativos devolvería
 * elementos reales desde el final del array.
 */
export function sliceCoilsForPage<T>(items: T[], page: number, pageSize: number): T[] {
  if (page < 1) return [];
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
