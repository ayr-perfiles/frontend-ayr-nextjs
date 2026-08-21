import { describe, it, expect, vi } from "vitest";
import { hasActiveProductionForQuote } from "../hasActiveProductionForQuote";

/**
 * Unit con db stubbeado (mismo espíritu que translateCascadeFields.test.ts: sin emulador).
 * El comportamiento contra Firestore real lo cubre el test de integración de annulSale.
 */
function makeDb(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const get = vi.fn(async () => ({ docs: docs.map((d) => ({ id: d.id, data: () => d.data })) }));
  const where = vi.fn(() => ({ get }));
  const collection = vi.fn(() => ({ where }));
  return { db: { collection } as any, collection, where, get };
}

const log = (id: string, status: string, sourceId = "COT-X") => ({
  id,
  data: { status, source: { type: "QUOTE", id: sourceId } },
});

describe("hasActiveProductionForQuote", () => {
  it("query: colección production_logs, filtro source.id == quoteId, SIN filtro de status", async () => {
    const { db, collection, where } = makeDb([]);
    await hasActiveProductionForQuote("COT-X", db);

    expect(collection).toHaveBeenCalledWith("production_logs");
    expect(where).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledWith("source.id", "==", "COT-X");
  });

  it("sin logs -> hasActive false, listas vacías", async () => {
    const { db } = makeDb([]);
    const res = await hasActiveProductionForQuote("COT-X", db);
    expect(res).toEqual({ hasActive: false, activeLogIds: [], allLogs: [] });
  });

  it("un log ACTIVE -> hasActive true y su id en activeLogIds", async () => {
    const { db } = makeDb([log("LOG-1", "ACTIVE")]);
    const res = await hasActiveProductionForQuote("COT-X", db);
    expect(res.hasActive).toBe(true);
    expect(res.activeLogIds).toEqual(["LOG-1"]);
    expect(res.allLogs).toHaveLength(1);
  });

  it("solo logs VOIDED -> hasActive false, pero allLogs los conserva", async () => {
    const { db } = makeDb([log("LOG-1", "VOIDED"), log("LOG-2", "VOIDED")]);
    const res = await hasActiveProductionForQuote("COT-X", db);
    expect(res.hasActive).toBe(false);
    expect(res.activeLogIds).toEqual([]);
    expect(res.allLogs).toHaveLength(2);
  });

  it("mezcla -> activeLogIds trae SOLO los ACTIVE, en orden", async () => {
    const { db } = makeDb([
      log("LOG-VOID", "VOIDED"),
      log("LOG-A", "ACTIVE"),
      log("LOG-B", "ACTIVE"),
    ]);
    const res = await hasActiveProductionForQuote("COT-X", db);
    expect(res.hasActive).toBe(true);
    expect(res.activeLogIds).toEqual(["LOG-A", "LOG-B"]);
    expect(res.allLogs).toHaveLength(3);
  });

  it("quoteId vacío -> no consulta y devuelve resultado neutro (fail-safe, no bloquea)", async () => {
    const { db, collection } = makeDb([log("LOG-1", "ACTIVE")]);
    const res = await hasActiveProductionForQuote("", db);
    expect(collection).not.toHaveBeenCalled();
    expect(res).toEqual({ hasActive: false, activeLogIds: [], allLogs: [] });
  });

  it("quoteId solo-espacios -> mismo trato que vacío", async () => {
    const { db, collection } = makeDb([log("LOG-1", "ACTIVE")]);
    const res = await hasActiveProductionForQuote("   ", db);
    expect(collection).not.toHaveBeenCalled();
    expect(res.hasActive).toBe(false);
  });
});
