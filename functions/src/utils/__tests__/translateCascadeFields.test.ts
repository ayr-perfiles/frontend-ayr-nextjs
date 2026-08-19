import { describe, it, expect, vi } from "vitest";
import { translateCascadeFields } from "../translateCascadeFields";

function makeMockFieldValue() {
  const SERVER_TS_SENTINEL = { __type: "SERVER_TIMESTAMP_SENTINEL" };
  const DELETE_SENTINEL = { __type: "DELETE_SENTINEL" };
  return {
    serverTimestamp: vi.fn(() => SERVER_TS_SENTINEL),
    delete: vi.fn(() => DELETE_SENTINEL),
    arrayUnion: vi.fn((...elements: unknown[]) => ({ __type: "ARRAY_UNION_SENTINEL", elements })),
    SERVER_TS_SENTINEL,
    DELETE_SENTINEL,
  };
}

describe("translateCascadeFields", () => {
  it("passthrough de escalares (string normal, number, boolean, null)", () => {
    const FieldValue = makeMockFieldValue();
    const result = translateCascadeFields(
      { a: "hola", b: 42, c: true, d: null },
      FieldValue as any,
    );
    expect(result).toEqual({ a: "hola", b: 42, c: true, d: null });
    expect(FieldValue.serverTimestamp).not.toHaveBeenCalled();
    expect(FieldValue.delete).not.toHaveBeenCalled();
    expect(FieldValue.arrayUnion).not.toHaveBeenCalled();
  });

  it("SERVER_TIMESTAMP se traduce a FieldValue.serverTimestamp()", () => {
    const FieldValue = makeMockFieldValue();
    const result = translateCascadeFields({ voidedAt: "SERVER_TIMESTAMP" }, FieldValue as any);
    expect(FieldValue.serverTimestamp).toHaveBeenCalledTimes(1);
    expect(result.voidedAt).toBe(FieldValue.SERVER_TS_SENTINEL);
  });

  it("DELETE_FIELD se traduce a FieldValue.delete()", () => {
    const FieldValue = makeMockFieldValue();
    const result = translateCascadeFields({ convertedToId: "DELETE_FIELD" }, FieldValue as any);
    expect(FieldValue.delete).toHaveBeenCalledTimes(1);
    expect(result.convertedToId).toBe(FieldValue.DELETE_SENTINEL);
  });

  it("ARRAY_UNION:{json} se traduce con JSON.parse correcto", () => {
    const FieldValue = makeMockFieldValue();
    const ref = { saleId: "V-1", saleNumber: "F001-1", annulledAt: "SERVER_TIMESTAMP", annulledBy: "a@b.com" };
    const result = translateCascadeFields(
      { annulledSaleRefs: `ARRAY_UNION:${JSON.stringify(ref)}` },
      FieldValue as any,
    );
    expect(FieldValue.arrayUnion).toHaveBeenCalledTimes(1);
    expect(FieldValue.arrayUnion).toHaveBeenCalledWith(ref);
    expect((result.annulledSaleRefs as any).elements).toEqual([ref]);
  });

  it("objeto anidado con SERVER_TIMESTAMP adentro se traduce recursivamente (ej. annulledSaleRef)", () => {
    const FieldValue = makeMockFieldValue();
    const result = translateCascadeFields(
      {
        status: "QUOTATION",
        annulledSaleRef: {
          saleId: "V-1",
          annulledAt: "SERVER_TIMESTAMP",
          annulledBy: "a@b.com",
        },
      },
      FieldValue as any,
    );
    expect(FieldValue.serverTimestamp).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("QUOTATION");
    const nested = result.annulledSaleRef as Record<string, unknown>;
    expect(nested.saleId).toBe("V-1");
    expect(nested.annulledAt).toBe(FieldValue.SERVER_TS_SENTINEL);
    expect(nested.annulledBy).toBe("a@b.com");
  });

  it("array NO se recursea (passthrough tal cual)", () => {
    const FieldValue = makeMockFieldValue();
    const arr = ["SERVER_TIMESTAMP", "DELETE_FIELD", { x: 1 }];
    const result = translateCascadeFields({ items: arr }, FieldValue as any);
    expect(result.items).toBe(arr);
    expect(FieldValue.serverTimestamp).not.toHaveBeenCalled();
    expect(FieldValue.delete).not.toHaveBeenCalled();
  });

  it("multiples placeholders en el mismo objeto, todos traducidos independientemente", () => {
    const FieldValue = makeMockFieldValue();
    const result = translateCascadeFields(
      {
        status: "VOIDED",
        voidedAt: "SERVER_TIMESTAMP",
        voidedBy: "tester@ayr.com",
        convertedToId: "DELETE_FIELD",
        approvedAt: "DELETE_FIELD",
      },
      FieldValue as any,
    );
    expect(FieldValue.serverTimestamp).toHaveBeenCalledTimes(1);
    expect(FieldValue.delete).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("VOIDED");
    expect(result.voidedBy).toBe("tester@ayr.com");
    expect(result.convertedToId).toBe(FieldValue.DELETE_SENTINEL);
    expect(result.approvedAt).toBe(FieldValue.DELETE_SENTINEL);
  });

  it("objeto vacio -> devuelve objeto vacio, cero llamadas a FieldValue", () => {
    const FieldValue = makeMockFieldValue();
    const result = translateCascadeFields({}, FieldValue as any);
    expect(result).toEqual({});
    expect(FieldValue.serverTimestamp).not.toHaveBeenCalled();
  });

  it("string que NO matchea ningun placeholder pasa tal cual (no confundir con ARRAY_UNION parcial)", () => {
    const FieldValue = makeMockFieldValue();
    const result = translateCascadeFields({ note: "ARRAY_UNION sin dos puntos" }, FieldValue as any);
    expect(result.note).toBe("ARRAY_UNION sin dos puntos");
    expect(FieldValue.arrayUnion).not.toHaveBeenCalled();
  });
});
