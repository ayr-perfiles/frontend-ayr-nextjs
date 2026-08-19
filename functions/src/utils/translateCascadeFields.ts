import type { firestore } from "firebase-admin";

const ARRAY_UNION_PREFIX = "ARRAY_UNION:";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Traduce los placeholders serializables de un `AnnulmentCascadePlan.writes[].fields`
 * (`src/core/sales/annulment/buildAnnulmentCascade.ts`, dominio puro sin firebase-admin)
 * a los sentinels reales del SDK, para poder aplicarlos en un `tx.update`. Recorre
 * objetos anidados (ej. `annulledSaleRef`), NO recorre arrays.
 */
export function translateCascadeFields(
  fields: Record<string, unknown>,
  FieldValue: typeof firestore.FieldValue,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === "SERVER_TIMESTAMP") {
      result[key] = FieldValue.serverTimestamp();
    } else if (value === "DELETE_FIELD") {
      result[key] = FieldValue.delete();
    } else if (typeof value === "string" && value.startsWith(ARRAY_UNION_PREFIX)) {
      const parsed = JSON.parse(value.slice(ARRAY_UNION_PREFIX.length));
      result[key] = FieldValue.arrayUnion(parsed);
    } else if (isPlainObject(value)) {
      result[key] = translateCascadeFields(value, FieldValue);
    } else {
      result[key] = value;
    }
  }

  return result;
}
