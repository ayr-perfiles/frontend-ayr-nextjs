/**
 * Normaliza un valor de timestamp a millis, tolerando el shape corrupto
 * {_seconds,_nanoseconds}/{seconds,nanoseconds} visto en docs `sales` (ver
 * scripts/local/recon-void500.md, scripts/local/recon-void-sizing.md).
 * `null` = no parseable, NUNCA se debe interpretar como "sin venta posterior".
 */
export function toMillisSafe(v: unknown): number | null {
  if (v === null || v === undefined) return null;

  if (typeof v === "number") return v;

  if (v instanceof Date) return v.getTime();

  if (typeof v === "object") {
    const obj = v as { toMillis?: unknown; seconds?: unknown; _seconds?: unknown; nanoseconds?: unknown; _nanoseconds?: unknown };

    if (typeof obj.toMillis === "function") {
      return (obj.toMillis as () => number).call(v);
    }

    if (typeof obj.seconds === "number") {
      const nanos = typeof obj.nanoseconds === "number" ? obj.nanoseconds : 0;
      return obj.seconds * 1000 + Math.floor(nanos / 1e6);
    }

    if (typeof obj._seconds === "number") {
      const nanos = typeof obj._nanoseconds === "number" ? obj._nanoseconds : 0;
      return obj._seconds * 1000 + Math.floor(nanos / 1e6);
    }
  }

  return null;
}
