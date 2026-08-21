/**
 * Clasifica el `FunctionsError` que lanza el SDK cliente al invocar `editQuotation`.
 *
 * ── Por qué NO se reusa `parseAnnulError` ──
 * `parseAnnulError` decide `production-block` **por la presencia de `details.quotationId`**
 * (`parseAnnulError.ts:50-57`). Eso funciona para `annulSale`, cuyo ÚNICO
 * `failed-precondition` con `quotationId` es el de producción.
 *
 * `editQuotation` tiene DOS guards que emiten `failed-precondition` + `quotationId`:
 *   - producción activa : { quotationId, activeLogIds: [...] }
 *   - importada (D1)    : { quotationId }              <- SIN activeLogIds
 *
 * Reusar `parseAnnulError` clasificaría la importada como `production-block` y abriría el
 * modal de "producción activa" con copy que no corresponde. El discriminante correcto es
 * **`activeLogIds` NO VACÍO**, no `quotationId`.
 */

export type EditErrorType =
  | "production-block"
  | "imported"
  | "not-editable"
  | "not-found"
  | "permission"
  | "unauthenticated"
  | "invalid-argument"
  | "other";

export interface ParsedEditError {
  type: EditErrorType;
  quotationId?: string;
  activeLogIds?: string[];
  message: string;
}

/** Shape mínimo del FunctionsError del SDK cliente. */
interface FunctionsErrorLike {
  code?: unknown;
  message?: unknown;
  details?: { quotationId?: unknown; activeLogIds?: unknown } | null;
}

function extractMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const msg = (error as FunctionsErrorLike).message;
    if (typeof msg === "string" && msg) return msg;
  }
  return "Ocurrió un error inesperado.";
}

export function parseEditError(error: unknown): ParsedEditError {
  const message = extractMessage(error);

  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as FunctionsErrorLike).code
      : undefined;

  if (typeof code !== "string") {
    return { type: "other", message };
  }

  const details =
    typeof error === "object" && error !== null ? (error as FunctionsErrorLike).details : null;

  if (code === "functions/failed-precondition") {
    const rawLogIds = details?.activeLogIds;
    const activeLogIds = Array.isArray(rawLogIds) ? (rawLogIds as string[]) : undefined;
    const quotationId = typeof details?.quotationId === "string" ? details.quotationId : undefined;

    // EL discriminante: producción real = al menos un log activo.
    if (activeLogIds && activeLogIds.length > 0) {
      return { type: "production-block", quotationId, activeLogIds, message };
    }
    // Con `quotationId` pero sin logs activos, el único guard que lo emite es el de origen.
    if (quotationId) {
      return { type: "imported", quotationId, message };
    }
    // Sin details: el guard de estado (status !== QUOTATION).
    return { type: "not-editable", message };
  }

  if (code === "functions/not-found") return { type: "not-found", message };
  if (code === "functions/permission-denied") return { type: "permission", message };
  if (code === "functions/unauthenticated") return { type: "unauthenticated", message };
  if (code === "functions/invalid-argument") return { type: "invalid-argument", message };

  return { type: "other", message };
}
