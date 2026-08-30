import { describe, it, expect } from "vitest";
import {
  collectFailedRefs,
  buildRefFailureMessage,
  toRefsWithId,
  type DocLike,
  type SettledLike,
} from "@/core/import/referenceRefs";
import type { CatalogRef } from "@/core/import/parseImportRows";

const NAMES = [
  "products",
  "inventory_stock",
  "roofing_catalog",
  "roofing_stock",
  "metallic_roofing_catalog",
  "metallic_roofing_stock",
  "trading_catalog",
  "trading_stock",
  "services_catalog",
  "coil_finishes",
] as const;

const ok: SettledLike = { status: "fulfilled" };
const ko: SettledLike = { status: "rejected" };

describe("collectFailedRefs — [IMPORT-FETCH-ALLORNOTHING]", () => {
  it("ningun ref caido -> lista vacia (la importacion procede)", () => {
    expect(collectFailedRefs(NAMES, NAMES.map(() => ok))).toEqual([]);
  });

  it("metallic_roofing_catalog caido -> lo nombra (alimenta el peso metallic)", () => {
    const settled = NAMES.map((n) => (n === "metallic_roofing_catalog" ? ko : ok));
    expect(collectFailedRefs(NAMES, settled)).toEqual(["metallic_roofing_catalog"]);
  });

  it("coil_finishes caido -> lo nombra (es el UNICO que degrada sin ningun flag)", () => {
    const settled = NAMES.map((n) => (n === "coil_finishes" ? ko : ok));
    expect(collectFailedRefs(NAMES, settled)).toEqual(["coil_finishes"]);
  });

  it("un stock caido -> lo nombra (alimenta baseCost)", () => {
    const settled = NAMES.map((n) => (n === "metallic_roofing_stock" ? ko : ok));
    expect(collectFailedRefs(NAMES, settled)).toEqual(["metallic_roofing_stock"]);
  });

  it("varios caidos -> los nombra a TODOS, en el orden pedido", () => {
    const caidos = new Set(["products", "metallic_roofing_catalog", "coil_finishes"]);
    const settled = NAMES.map((n) => (caidos.has(n) ? ko : ok));
    expect(collectFailedRefs(NAMES, settled)).toEqual([
      "products",
      "metallic_roofing_catalog",
      "coil_finishes",
    ]);
  });
});

describe("buildRefFailureMessage", () => {
  it("nombra cada coleccion caida y el conteo sobre el total", () => {
    const msg = buildRefFailureMessage(["metallic_roofing_catalog", "coil_finishes"], 10);
    expect(msg).toContain("2 de 10");
    expect(msg).toContain("• metallic_roofing_catalog");
    expect(msg).toContain("• coil_finishes");
    // El mensaje generico viejo ("Error cargando catalogos de productos") no
    // decia QUE se habia caido: ese es justo el defecto que este frente cierra.
    expect(msg).toContain("BLOQUEADA");
  });
});

describe("toRefsWithId — [CATALOGREF-ANY]", () => {
  it("un `sku` denormalizado DENTRO del doc NO pisa al doc.id", () => {
    const docs: DocLike[] = [
      {
        id: "COB030ROJO",
        // Campo denormalizado que no coincide con su propio id: el bug que el
        // spread al final permitia.
        data: () => ({ sku: "SKU-VIEJO-DESINCRONIZADO", displayName: "Cobertura roja" }),
      },
    ];
    const refs = toRefsWithId<CatalogRef>(docs, "metallic-roofing");
    expect(refs[0].sku).toBe("COB030ROJO");
  });

  it("doc sin `sku` propio -> toma el doc.id", () => {
    const docs: DocLike[] = [{ id: "PL030AZ6MT", data: () => ({ displayName: "Plancha azul" }) }];
    const refs = toRefsWithId<CatalogRef>(docs, "metallic-roofing");
    expect(refs[0].sku).toBe("PL030AZ6MT");
  });

  it("una `businessLine` denormalizada DENTRO del doc NO pisa a la de la coleccion de origen", () => {
    const docs: DocLike[] = [
      { id: "X1", data: () => ({ businessLine: "drywall", displayName: "X" }) },
    ];
    const refs = toRefsWithId<CatalogRef>(docs, "trading");
    expect(refs[0].businessLine).toBe("trading");
  });

  it("preserva el resto de los campos del doc (thickness/widthMm/finish)", () => {
    const docs: DocLike[] = [
      {
        id: "COB030ROJO",
        data: () => ({
          displayName: "Cobertura roja",
          family: "COBERTURA",
          unit: "METRO",
          thickness: 0.3,
          widthMm: 1220,
          finish: "ALZ-ROJO-3002",
        }),
      },
    ];
    const refs = toRefsWithId<CatalogRef>(docs, "metallic-roofing");
    expect(refs[0]).toMatchObject({
      sku: "COB030ROJO",
      businessLine: "metallic-roofing",
      family: "COBERTURA",
      unit: "METRO",
      thickness: 0.3,
      widthMm: 1220,
      finish: "ALZ-ROJO-3002",
    });
  });
});
