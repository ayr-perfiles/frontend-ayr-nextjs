import { describe, it, expect } from "vitest";
import { filterSearchableOptions } from "./searchableSelectLogic";

interface Fixture {
  id: string;
  customerName?: string;
  documentNumber?: string;
  finish?: string;
}

describe("filterSearchableOptions", () => {
  it("query vacia -> devuelve todas las opciones", () => {
    const options: Fixture[] = [{ id: "A" }, { id: "B" }];
    const result = filterSearchableOptions(options, "", (o) => [o.id]);
    expect(result).toEqual(options);
  });

  it("query solo-espacios -> devuelve todas las opciones", () => {
    const options: Fixture[] = [{ id: "A" }, { id: "B" }];
    const result = filterSearchableOptions(options, "   ", (o) => [o.id]);
    expect(result).toEqual(options);
  });

  it("match por un campo (cliente) -> devuelve solo la que matchea", () => {
    const options: Fixture[] = [
      { id: "1", customerName: "Juan Perez" },
      { id: "2", customerName: "Pedro Lopez" },
    ];
    const result = filterSearchableOptions(options, "juan", (o) => [o.id, o.customerName ?? ""]);
    expect(result).toEqual([{ id: "1", customerName: "Juan Perez" }]);
  });

  it("match cross-field: una matchea por id, otra por customerName -> ambas", () => {
    const options: Fixture[] = [
      { id: "X99", customerName: "Ana" },
      { id: "Y1", customerName: "X99 Store" },
    ];
    const result = filterSearchableOptions(options, "x99", (o) => [o.id, o.customerName ?? ""]);
    expect(result).toEqual(options);
  });

  it("case-insensitive: AZUL matchea alz-azul", () => {
    const options: Fixture[] = [{ id: "1", finish: "ALZ-AZUL" }];
    const result = filterSearchableOptions(options, "AZUL", (o) => [o.id, o.finish ?? ""]);
    expect(result).toEqual(options);
  });

  it("prefijo COT-: 'FFA1-102' matchea documentNumber y 'COT-FFA1-102' matchea id", () => {
    const options: Fixture[] = [{ id: "COT-FFA1-102", documentNumber: "FFA1-102" }];
    const getSearchText = (o: Fixture) => [o.id, o.documentNumber ?? ""];

    expect(filterSearchableOptions(options, "FFA1-102", getSearchText)).toEqual(options);
    expect(filterSearchableOptions(options, "COT-FFA1-102", getSearchText)).toEqual(options);
  });

  it("sin match -> array vacio", () => {
    const options: Fixture[] = [{ id: "A" }];
    const result = filterSearchableOptions(options, "zzz", (o) => [o.id]);
    expect(result).toEqual([]);
  });

  it("campo undefined en getSearchText -> no explota, no matchea por ese campo", () => {
    const options: Fixture[] = [{ id: "A", finish: undefined }];
    const result = filterSearchableOptions(
      options,
      "azul",
      (o) => [o.id, o.finish as unknown as string],
    );
    expect(result).toEqual([]);
  });
});
