export type AnnulErrorType =
  | "production-block"
  | "already-voided"
  | "not-found"
  | "permission"
  | "unauthenticated"
  | "invalid-argument"
  | "other";

export interface ParsedAnnulError {
  type: AnnulErrorType;
  quotationId?: string;
  activeLogIds?: string[];
  message: string;
}

const ALREADY_VOIDED_RE = /ya.*anulada/i;

/** Shape mínimo de lo que el SDK cliente de Firebase Functions lanza (FunctionsError). */
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

export function parseAnnulError(error: unknown): ParsedAnnulError {
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
    const quotationId = details?.quotationId;
    if (typeof quotationId === "string" && quotationId) {
      const activeLogIds = Array.isArray(details?.activeLogIds)
        ? (details!.activeLogIds as string[])
        : undefined;
      return { type: "production-block", quotationId, activeLogIds, message };
    }
    if (ALREADY_VOIDED_RE.test(message)) {
      return { type: "already-voided", message };
    }
    return { type: "other", message };
  }

  if (code === "functions/not-found") {
    return { type: "not-found", message };
  }

  if (code === "functions/permission-denied") {
    return { type: "permission", message };
  }

  if (code === "functions/unauthenticated") {
    return { type: "unauthenticated", message };
  }

  if (code === "functions/invalid-argument") {
    return { type: "invalid-argument", message };
  }

  return { type: "other", message };
}
