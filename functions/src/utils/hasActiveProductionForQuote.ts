import type { firestore } from "firebase-admin";
import { hasActiveProduction } from "../domain/fulfillmentLogic";

/**
 * Lee los `production_logs` colgados de una cotización y devuelve los que están ACTIVE.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────────
 * `annulSale` (functions/src/callables/sales.ts) trae los logs inline, pero gateado a
 * `link.mode === "linked"` — o sea, NUNCA para un doc con `status === "QUOTATION"`,
 * que `resolveSaleQuotationLink` clasifica como `mode: "self"`. Este helper trabaja
 * DIRECTO sobre el `quoteId`, sin pasar por `resolveSaleQuotationLink`: quien llama ya
 * sabe qué cotización quiere chequear (para `self` el `quoteId` es el propio doc.id).
 *
 * ── Por qué vive en utils/ y no en domain/ ────────────────────────────────────
 * Hace I/O (una query a Firestore). `functions/src/domain/` es dominio PURO — el único
 * subdirectorio que toca `firebase-admin` es `strategies/`, y su propia nota
 * (`domain/strategies/types.ts:3-8`) lo justifica como espejo del patrón Strategy del
 * cliente. `functions/src/utils/` es justamente el lugar de los helpers server-side que
 * dependen del SDK admin y se comparten entre callables — hoy `translateCascadeFields.ts`,
 * consumido por `sales.ts:8`. Tampoco puede vivir inline en `sales.ts`: un futuro callable
 * de edición tendría que importarlo desde un archivo de callable, lo cual acopla dos
 * entry points entre sí.
 *
 * La clasificación ACTIVE se delega al predicado puro `hasActiveProduction`
 * (`domain/fulfillmentLogic.ts`, con parity test contra la copia cliente) — este helper
 * NO reimplementa el criterio.
 *
 * ── Sobre la query ────────────────────────────────────────────────────────────
 * Mismo shape exacto que el path `linked` de `annulSale` (`sales.ts:89-94`):
 * `where("source.id", "==", quoteId)` **sin** filtrar `status` en la query — se trae todo
 * y se clasifica en memoria. Campo simple sin `orderBy` ⇒ índice automático, no hace falta
 * declarar ninguno nuevo.
 */

export interface ActiveProductionLog {
  id: string;
  status: string;
  source?: { type: string; id: string };
}

export interface ActiveProductionResult {
  /** true si al menos un log está ACTIVE. */
  hasActive: boolean;
  /** Ids de los logs ACTIVE — alimentan `details` del HttpsError para que la UI los muestre. */
  activeLogIds: string[];
  /** Todos los logs de la cotización, ACTIVE o no (por si el caller necesita el set completo). */
  allLogs: ActiveProductionLog[];
}

export async function hasActiveProductionForQuote(
  quoteId: string,
  db: firestore.Firestore,
): Promise<ActiveProductionResult> {
  if (!quoteId || quoteId.trim() === "") {
    // Sin id no hay nada que chequear. Fail-safe: NO bloquea (el caller ya validó su input).
    return { hasActive: false, activeLogIds: [], allLogs: [] };
  }

  const snap = await db.collection("production_logs").where("source.id", "==", quoteId).get();

  const allLogs: ActiveProductionLog[] = snap.docs.map((d) => ({
    id: d.id,
    status: d.data().status as string,
    source: d.data().source as { type: string; id: string } | undefined,
  }));

  return {
    hasActive: hasActiveProduction(allLogs),
    activeLogIds: allLogs.filter((l) => l.status === "ACTIVE").map((l) => l.id),
    allLogs,
  };
}
