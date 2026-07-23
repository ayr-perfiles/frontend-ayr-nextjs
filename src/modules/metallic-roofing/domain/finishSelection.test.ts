import { describe, it, expect } from "vitest";
import { toggleFinish } from "./finishSelection";

describe("toggleFinish", () => {
  it("agrega a array vacío", () => {
    expect(toggleFinish([], "ALU-ROJO")).toEqual(["ALU-ROJO"]);
  });

  it("agrega segundo elemento", () => {
    expect(toggleFinish(["ALU-ROJO"], "ALU-VERDE")).toEqual(["ALU-ROJO", "ALU-VERDE"]);
  });

  it("quita uno si ya existe", () => {
    expect(toggleFinish(["ALU-ROJO", "ALU-VERDE"], "ALU-ROJO")).toEqual(["ALU-VERDE"]);
  });

  it("quita el último y queda vacío", () => {
    expect(toggleFinish(["ALU-ROJO"], "ALU-ROJO")).toEqual([]);
  });

  it("no duplica si ya está (comportamiento base aunque sea imposible si hace toggle)", () => {
    // Si toggleFinish se implementa de manera pura, no debería agregar de nuevo.
    // Aunque en toggle lo quitaría, pero para la prueba de concepto, agregar 2 veces = no duplicar no tiene sentido con toggle.
    // toggle quita si está, agrega si no está.
    expect(toggleFinish(["ALU-ROJO"], "ALU-ROJO")).toEqual([]);
  });
});
