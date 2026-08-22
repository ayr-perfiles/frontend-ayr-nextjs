import type { firestore } from "firebase-admin";

const ARRAY_UNION_PREFIX = "ARRAY_UNION:";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Resuelve recursivamente el placeholder "SERVER_TIMESTAMP" a un valor CONCRETO
 * (`now`), a cualquier profundidad -- objetos Y arrays. Usada SOLO para el payload
 * que viaja dentro de un elemento de `FieldValue.arrayUnion()` (ver deuda #3 / trampa
 * documentada en `translateCascadeFields` más abajo): ahí un sentinel real de
 * `FieldValue.serverTimestamp()` no es una opción.
 */
function resolveTimestampsDeep(value: unknown, now: unknown): unknown {
  if (value === "SERVER_TIMESTAMP") {
    return now;
  }
  if (Array.isArray(value)) {
    return value.map((el) => resolveTimestampsDeep(el, now));
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = resolveTimestampsDeep(v, now);
    }
    return result;
  }
  return value;
}

function translateFieldsInternal(
  fields: Record<string, unknown>,
  FieldValue: typeof firestore.FieldValue,
  getNow: () => unknown,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === "SERVER_TIMESTAMP") {
      result[key] = FieldValue.serverTimestamp();
    } else if (value === "DELETE_FIELD") {
      result[key] = FieldValue.delete();
    } else if (typeof value === "string" && value.startsWith(ARRAY_UNION_PREFIX)) {
      const parsed = JSON.parse(value.slice(ARRAY_UNION_PREFIX.length));
      result[key] = FieldValue.arrayUnion(resolveTimestampsDeep(parsed, getNow()));
    } else if (isPlainObject(value)) {
      result[key] = translateFieldsInternal(value, FieldValue, getNow);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Traduce los placeholders serializables de un `AnnulmentCascadePlan.writes[].fields`
 * (`src/core/sales/annulment/buildAnnulmentCascade.ts`, dominio puro sin firebase-admin)
 * a los sentinels reales del SDK, para poder aplicarlos en un `tx.update`. Recorre
 * objetos anidados (ej. `annulledSaleRef`), NO recorre arrays a nivel top-level
 * (un array literal en `fields` pasa tal cual, sin traducir nada adentro).
 *
 * ⚠️ TRAMPA (deuda #3, confirmada empíricamente contra el emulador de Firestore):
 * `FieldValue.serverTimestamp()` NO puede anidarse dentro de un elemento pasado a
 * `FieldValue.arrayUnion()` -- el SDK lo rechaza del lado del cliente, antes de tocar
 * la red: `"FieldValue.serverTimestamp() cannot be used inside of an array"`. Por eso
 * el payload de un campo `` `ARRAY_UNION:${JSON.stringify(...)}` `` NUNCA puede recibir
 * el sentinel real -- cualquier `"SERVER_TIMESTAMP"` que traiga adentro (a cualquier
 * profundidad) se resuelve con `resolveTimestampsDeep` a un `Timestamp` CONCRETO
 * (`Timestamp.now()`), no al sentinel de `FieldValue`. Un único `Timestamp.now()` por
 * invocación de esta función (lazy + memoizado vía `getNow`): si el mismo write no
 * tiene ningún campo `ARRAY_UNION`, `Timestamp.now()` nunca se llama; si tiene uno o
 * más, todos comparten el mismo instante. Si algún día se agrega un campo nuevo con
 * esta misma forma (sentinel anidado dentro de un array), tiene que pasar por
 * `resolveTimestampsDeep` -- nunca asumir que el sentinel de `FieldValue` sirve ahí.
 */
export function translateCascadeFields(
  fields: Record<string, unknown>,
  FieldValue: typeof firestore.FieldValue,
  Timestamp: typeof firestore.Timestamp,
): Record<string, unknown> {
  let cachedNow: unknown;
  let hasNow = false;
  const getNow = (): unknown => {
    if (!hasNow) {
      cachedNow = Timestamp.now();
      hasNow = true;
    }
    return cachedNow;
  };

  return translateFieldsInternal(fields, FieldValue, getNow);
}
