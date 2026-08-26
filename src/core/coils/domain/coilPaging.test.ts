import { describe, it, expect } from "vitest";
import { Coil } from "@/types";
import { scopeCoilsByFinishIds, sliceCoilsForPage } from "./coilPaging";

const mk = (id: string, finish?: string | null): Coil =>
  ({ id, finish: finish as string | undefined, initialWeight: 1000, currentWeight: 1000 }) as Coil;

describe("scopeCoilsByFinishIds", () => {
  const coils = [mk("a", "GALV"), mk("b", "ALZ-NATURAL"), mk("c", "GALV"), mk("d", "ALZ-ROJO-3020")];

  it("devuelve solo las bobinas cuyo finish está en la lista", () => {
    expect(scopeCoilsByFinishIds(coils, ["GALV"]).map((c) => c.id)).toEqual(["a", "c"]);
    expect(
      scopeCoilsByFinishIds(coils, ["ALZ-NATURAL", "ALZ-ROJO-3020"]).map((c) => c.id),
    ).toEqual(["b", "d"]);
  });

  it("finishIds vacío → [] (vacío significa ninguna línea, NO todas)", () => {
    expect(scopeCoilsByFinishIds(coils, [])).toEqual([]);
  });

  it("no muta el array de entrada", () => {
    const input = [mk("a", "GALV"), mk("b", "ALZ-NATURAL")];
    const snapshot = input.map((c) => c.id);
    scopeCoilsByFinishIds(input, ["GALV"]);
    expect(input.map((c) => c.id)).toEqual(snapshot);
    expect(input).toHaveLength(2);
  });

  it("bobina con finish undefined/null queda excluida", () => {
    const input = [mk("u", undefined), mk("n", null), mk("g", "GALV")];
    expect(scopeCoilsByFinishIds(input, ["GALV"]).map((c) => c.id)).toEqual(["g"]);
  });
});

describe("sliceCoilsForPage (page 1-indexed)", () => {
  const items = ["i1", "i2", "i3", "i4", "i5", "i6", "i7"];

  it("page 1 devuelve los primeros pageSize", () => {
    expect(sliceCoilsForPage(items, 1, 3)).toEqual(["i1", "i2", "i3"]);
  });

  it("page 2 devuelve el segundo bloque", () => {
    expect(sliceCoilsForPage(items, 2, 3)).toEqual(["i4", "i5", "i6"]);
  });

  it("última página parcial devuelve el resto", () => {
    expect(sliceCoilsForPage(items, 3, 3)).toEqual(["i7"]);
  });

  it("page fuera de rango → []", () => {
    expect(sliceCoilsForPage(items, 4, 3)).toEqual([]);
    expect(sliceCoilsForPage(items, 0, 3)).toEqual([]);
  });

  it("page = -1 → [] (el slice naive con índices negativos devolvería elementos reales)", () => {
    expect(sliceCoilsForPage(items, -1, 3)).toEqual([]);
  });

  it("pageSize mayor al total → devuelve todo", () => {
    expect(sliceCoilsForPage(items, 1, 50)).toEqual(items);
  });
});
