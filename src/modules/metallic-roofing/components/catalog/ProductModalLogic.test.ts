import { describe, it, expect } from "vitest";
import { buildProductInput, buildFinishesToRender, shouldShowLengthField } from "./ProductModal";
import { deleteField } from "firebase/firestore";

describe("buildProductInput", () => {
  const dummyForm: any = {
    family: "COBERTURA",
    finish: "GRIS",
    finishes: ["GRIS"],
    thickness: "0.35",
    width: "1.0",
    length: "",
    unit: "METRO",
    sku: "COB035GRIS",
    displayName: "Cobertura Aluzinc Gris 0.35mm",
    widthMm: "1000",
  };

  it("isCreate=false -> el objeto NO contiene la clave sku", () => {
    const input = buildProductInput(dummyForm, false);
    expect("sku" in input).toBe(false);
    expect(input.family).toBe("COBERTURA");
    expect(input.unit).toBe("METRO");
    expect(input.thickness).toBe(0.35);
    expect(input.width).toBe(1.0);
    expect(input.widthMm).toBe(1000);
    expect(input.metaSource).toBe("manual");
  });

  it("isCreate=true -> SÍ la contiene", () => {
    const input = buildProductInput(dummyForm, true);
    expect("sku" in input).toBe(true);
    expect(input.sku).toBe("COB035GRIS");
  });

  it("manda finish escalar consistente con finishes[0] - ya en schema/form, probamos que manda ambos", () => {
    const input = buildProductInput(dummyForm, false);
    expect(input.finish).toBe("GRIS");
    expect(input.finishes).toEqual(["GRIS"]);
  });

  it("family COBERTURA + length vacio o cero -> deleteField() siempre", () => {
    // Caso 1: string vacío
    const formEmpty = { ...dummyForm, family: "COBERTURA", length: "" };
    expect((buildProductInput(formEmpty, false) as any).length).toEqual(deleteField());

    // Caso 2: string "0" (el fantasma real)
    const formZero = { ...dummyForm, family: "COBERTURA", length: "0" };
    expect((buildProductInput(formZero, false) as any).length).toEqual(deleteField());

    // Caso 3: string "0.00"
    const formZeroDec = { ...dummyForm, family: "COBERTURA", length: "0.00" };
    expect((buildProductInput(formZeroDec, false) as any).length).toEqual(deleteField());
  });

  it("family PLANCHA + length con valor -> manda normal", () => {
    const form = { ...dummyForm, family: "PLANCHA", length: "6.5" };
    const input = buildProductInput(form, false);
    expect(input.length).toBe(6.5);
  });
});

describe("shouldShowLengthField", () => {
  it("muestra para PLANCHA, oculta para COBERTURA", () => {
    expect(shouldShowLengthField("PLANCHA")).toBe(true);
    expect(shouldShowLengthField("COBERTURA")).toBe(false);
  });
});

describe("buildFinishesToRender", () => {
  const allFinishes: any[] = [
    { id: "ACTIVO1", label: "Activo 1", active: true, lines: ["metallic-roofing"] },
    { id: "ACTIVO2", label: "Activo 2", active: true, lines: ["metallic-roofing"] },
    { id: "OBSOLETO", label: "Obsoleto", active: false, lines: ["metallic-roofing"] },
    { id: "OTRA_LINEA", label: "Otra", active: true, lines: ["drywall"] },
  ];

  it("acabado obsoleto seleccionado aparece en la lista", () => {
    const render = buildFinishesToRender(allFinishes, ["OBSOLETO"]);
    expect(render.find(f => f.id === "OBSOLETO")).toBeDefined();
    expect(render.find(f => f.id === "OBSOLETO")?.active).toBe(false);
  });

  it("activo normal aparece, incluso si no esta seleccionado", () => {
    const render = buildFinishesToRender(allFinishes, []);
    expect(render.find(f => f.id === "ACTIVO1")).toBeDefined();
    expect(render.find(f => f.id === "ACTIVO2")).toBeDefined();
  });

  it("sin duplicados si un acabado esta activo Y seleccionado", () => {
    const render = buildFinishesToRender(allFinishes, ["ACTIVO1"]);
    const activos1 = render.filter(f => f.id === "ACTIVO1");
    expect(activos1.length).toBe(1);
  });
});