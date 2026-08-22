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

function makeMockTimestamp() {
  const FAKE_TS = { __type: "FAKE_TIMESTAMP_NOW" };
  return {
    now: vi.fn(() => FAKE_TS),
    FAKE_TS,
  };
}

describe("translateCascadeFields", () => {
  it("passthrough de escalares (string normal, number, boolean, null)", () => {
    const FieldValue = makeMockFieldValue();
    const Timestamp = makeMockTimestamp();
    const result = translateCascadeFields(
      { a: "hola", b: 42, c: true, d: null },
      FieldValue as any,
      Timestamp as any,
    );
    expect(result).toEqual({ a: "hola", b: 42, c: true, d: null });
    expect(FieldValue.serverTimestamp).not.toHaveBeenCalled();
    expect(FieldValue.delete).not.toHaveBeenCalled();
    expect(FieldValue.arrayUnion).not.toHaveBeenCalled();
  });

  it("SERVER_TIMESTAMP se traduce a FieldValue.serverTimestamp()", () => {
    const FieldValue = makeMockFieldValue();
    const Timestamp = makeMockTimestamp();
    const result = translateCascadeFields(
      { voidedAt: "SERVER_TIMESTAMP" },
      FieldValue as any,
      Timestamp as any,
    );
    expect(FieldValue.serverTimestamp).toHaveBeenCalledTimes(1);
    expect(result.voidedAt).toBe(FieldValue.SERVER_TS_SENTINEL);
  });

  it("DELETE_FIELD se traduce a FieldValue.delete()", () => {
    const FieldValue = makeMockFieldValue();
    const Timestamp = makeMockTimestamp();
    const result = translateCascadeFields(
      { convertedToId: "DELETE_FIELD" },
      FieldValue as any,
      Timestamp as any,
    );
    expect(FieldValue.delete).toHaveBeenCalledTimes(1);
    expect(result.convertedToId).toBe(FieldValue.DELETE_SENTINEL);
  });

  it("ARRAY_UNION:{json} con SERVER_TIMESTAMP anidado se traduce a un Timestamp CONCRETO, nunca al string ni al sentinel de FieldValue", () => {
    // INVERTIDO (deuda #3): esta prueba antes exigia que `annulledAt` llegara SIN traducir
    // (`toHaveBeenCalledWith(ref)` con el string "SERVER_TIMESTAMP" intacto adentro),
    // codificando el bug como comportamiento esperado. Firestore RECHAZA un sentinel real
    // de FieldValue.serverTimestamp() anidado dentro de un elemento de arrayUnion (probado
    // empiricamente contra el emulador: "FieldValue.serverTimestamp() cannot be used inside
    // of an array"), asi que la traduccion correcta ADENTRO de un ARRAY_UNION tiene que ser
    // un Timestamp CONCRETO (Timestamp.now()), no el sentinel.
    const FieldValue = makeMockFieldValue();
    const Timestamp = makeMockTimestamp();
    const ref = { saleId: "V-1", saleNumber: "F001-1", annulledAt: "SERVER_TIMESTAMP", annulledBy: "a@b.com" };
    const result = translateCascadeFields(
      { annulledSaleRefs: `ARRAY_UNION:${JSON.stringify(ref)}` },
      FieldValue as any,
      Timestamp as any,
    );
    expect(FieldValue.arrayUnion).toHaveBeenCalledTimes(1);
    const calledWith = (FieldValue.arrayUnion as any).mock.calls[0][0];
    expect(calledWith.saleId).toBe("V-1");
    expect(calledWith.saleNumber).toBe("F001-1");
    expect(calledWith.annulledBy).toBe("a@b.com");
    // el corazon del fix: annulledAt NUNCA debe llegar como el string placeholder
    expect(calledWith.annulledAt).not.toBe("SERVER_TIMESTAMP");
    expect(typeof calledWith.annulledAt).not.toBe("string");
    expect(calledWith.annulledAt).toBe(Timestamp.FAKE_TS);
    expect((result.annulledSaleRefs as any).elements[0].annulledAt).toBe(Timestamp.FAKE_TS);
  });

  it("MECANISMO: el annulledAt anidado dentro de un elemento de arrayUnion viene de Timestamp.now() inyectado, no del sentinel de FieldValue.serverTimestamp()", () => {
    const FieldValue = makeMockFieldValue();
    const Timestamp = makeMockTimestamp();
    const ref = { annulledAt: "SERVER_TIMESTAMP" };
    translateCascadeFields(
      { annulledSaleRefs: `ARRAY_UNION:${JSON.stringify(ref)}` },
      FieldValue as any,
      Timestamp as any,
    );
    expect(Timestamp.now).toHaveBeenCalledTimes(1);
    const calledWith = (FieldValue.arrayUnion as any).mock.calls[0][0];
    expect(calledWith.annulledAt).toBe(Timestamp.FAKE_TS);
    expect(calledWith.annulledAt).not.toBe(FieldValue.SERVER_TS_SENTINEL);
  });

  it("objeto anidado con SERVER_TIMESTAMP adentro se traduce recursivamente (ej. annulledSaleRef)", () => {
    const FieldValue = makeMockFieldValue();
    const Timestamp = makeMockTimestamp();
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
      Timestamp as any,
    );
    expect(FieldValue.serverTimestamp).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("QUOTATION");
    const nested = result.annulledSaleRef as Record<string, unknown>;
    expect(nested.saleId).toBe("V-1");
    expect(nested.annulledAt).toBe(FieldValue.SERVER_TS_SENTINEL);
    expect(nested.annulledBy).toBe("a@b.com");
  });

  it("NO-REGRESION (path native/map): SERVER_TIMESTAMP dentro de un objeto anidado NO-array sigue traduciendose al sentinel de FieldValue, NUNCA al Timestamp inyectado", () => {
    // Este par (con la prueba de arriba) es el que prueba que el fix distingue
    // array de map -- el corazon del bug original.
    const FieldValue = makeMockFieldValue();
    const Timestamp = makeMockTimestamp();
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
      Timestamp as any,
    );
    expect(FieldValue.serverTimestamp).toHaveBeenCalledTimes(1);
    expect(Timestamp.now).not.toHaveBeenCalled();
    const nested = result.annulledSaleRef as Record<string, unknown>;
    expect(nested.annulledAt).toBe(FieldValue.SERVER_TS_SENTINEL);
    expect(nested.annulledAt).not.toBe(Timestamp.FAKE_TS);
  });

  it("array NO se recursea a nivel top-level (passthrough tal cual, no pasa por la rama ARRAY_UNION)", () => {
    const FieldValue = makeMockFieldValue();
    const Timestamp = makeMockTimestamp();
    const arr = ["SERVER_TIMESTAMP", "DELETE_FIELD", { x: 1 }];
    const result = translateCascadeFields({ items: arr }, FieldValue as any, Timestamp as any);
    expect(result.items).toBe(arr);
    expect(FieldValue.serverTimestamp).not.toHaveBeenCalled();
    expect(FieldValue.delete).not.toHaveBeenCalled();
  });

  it("multiples placeholders en el mismo objeto, todos traducidos independientemente", () => {
    const FieldValue = makeMockFieldValue();
    const Timestamp = makeMockTimestamp();
    const result = translateCascadeFields(
      {
        status: "VOIDED",
        voidedAt: "SERVER_TIMESTAMP",
        voidedBy: "tester@ayr.com",
        convertedToId: "DELETE_FIELD",
        approvedAt: "DELETE_FIELD",
      },
      FieldValue as any,
      Timestamp as any,
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
    const Timestamp = makeMockTimestamp();
    const result = translateCascadeFields({}, FieldValue as any, Timestamp as any);
    expect(result).toEqual({});
    expect(FieldValue.serverTimestamp).not.toHaveBeenCalled();
  });

  it("string que NO matchea ningun placeholder pasa tal cual (no confundir con ARRAY_UNION parcial)", () => {
    const FieldValue = makeMockFieldValue();
    const Timestamp = makeMockTimestamp();
    const result = translateCascadeFields(
      { note: "ARRAY_UNION sin dos puntos" },
      FieldValue as any,
      Timestamp as any,
    );
    expect(result.note).toBe("ARRAY_UNION sin dos puntos");
    expect(FieldValue.arrayUnion).not.toHaveBeenCalled();
  });
});
