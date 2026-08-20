import { describe, it, expect } from "vitest";
import { isTestEnvironment, PROD_PROJECT_ID } from "./isTestEnvironment";

describe("isTestEnvironment", () => {
  // El lado PROD se valida acá y no en runtime: en un build de producción el helper
  // devuelve false y la franja ni se monta, así que este test ES la verificación de
  // que no aparece en prod.
  it("projectId de PRODUCCIÓN -> false (la franja NO se muestra)", () => {
    expect(isTestEnvironment("ayrsteel-2026")).toBe(false);
    expect(isTestEnvironment(PROD_PROJECT_ID)).toBe(false);
  });

  it("projectId de TEST -> true", () => {
    expect(isTestEnvironment("ayrsteel-test")).toBe(true);
  });

  it("cualquier otro proyecto -> true", () => {
    expect(isTestEnvironment("demo-ayrsteel-test")).toBe(true);
    expect(isTestEnvironment("ayrsteel-staging")).toBe(true);
  });

  // Fail-loud: entorno mal configurado se trata como NO-prod.
  it("undefined / null / vacío -> true (fail-loud)", () => {
    expect(isTestEnvironment(undefined)).toBe(true);
    expect(isTestEnvironment(null)).toBe(true);
    expect(isTestEnvironment("")).toBe(true);
    expect(isTestEnvironment("   ")).toBe(true);
  });

  it("tolera espacios alrededor del id de prod", () => {
    expect(isTestEnvironment("  ayrsteel-2026  ")).toBe(false);
    expect(isTestEnvironment("\nayrsteel-2026\t")).toBe(false);
  });

  // Un id que difiere en mayúsculas es OTRO proyecto de Firebase, no el mismo.
  it("es sensible a mayúsculas: 'AYRSTEEL-2026' NO es prod", () => {
    expect(isTestEnvironment("AYRSTEEL-2026")).toBe(true);
    expect(isTestEnvironment("Ayrsteel-2026")).toBe(true);
  });

  // Guard anti-substring: nada que apenas contenga el id de prod debe pasar por prod.
  it("no confunde ids que contienen al de prod", () => {
    expect(isTestEnvironment("ayrsteel-2026-test")).toBe(true);
    expect(isTestEnvironment("copy-ayrsteel-2026")).toBe(true);
  });
});
