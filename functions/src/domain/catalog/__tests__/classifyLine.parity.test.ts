import { describe, it, expect } from "vitest";
// Cross-boundary permitido: este es un .test.ts (excluido del build de functions/ por
// `exclude: ["src/**/*.test.ts"]`), mismo patrón que los parity tests de
// src/domain/annulment/__tests__/ y src/domain/__tests__/fulfillmentLogic.parity.test.ts.
import { classifyLine as classifyClient } from "../../../../../src/core/import/catalogImport";
import { classifyLine as classifyBackend } from "../classifyLine";

/**
 * `classifyLine` vive en `src/core/import/catalogImport.ts`, un módulo que importa `xlsx`
 * a nivel raíz — por eso la copia server no puede importarla ni aunque el alias `@/` y el
 * `rootDir` lo permitieran (arrastraría el paquete entero al bundle de functions).
 * Se duplica SOLO esta función; el resto de `catalogImport` queda fuera.
 */
describe("Parity Test: classifyLine (client vs functions)", () => {
  const cases: Array<{ name: string; sku: string; productName: string }> = [
    // 1. skip
    { name: "ANTI* -> skip", sku: "ANTI001", productName: "Adelanto" },
    { name: "nombre con ANTICIPO -> skip", sku: "XYZ", productName: "ANTICIPO DE OBRA" },
    // 2. policarbonato (ANTES que la regla COB*, es el orden lo que decide)
    { name: "COBPOLI* -> trading, NO metallic", sku: "COBPOLI10", productName: "Cobertura poli" },
    { name: "nombre con POLICARBONATO -> trading", sku: "ZZZ", productName: "PLANCHA DE POLICARBONATO" },
    // 3. coil
    { name: "BOB* -> coil", sku: "BOB-ALZ-001", productName: "Bobina aluzinc" },
    // 4. drywall
    { name: "P*GALV -> drywall", sku: "P64GALV045", productName: "Parante" },
    { name: "R*GALV -> drywall", sku: "R39GALV045", productName: "Riel" },
    { name: "OMEGA* -> drywall", sku: "OMEGA20", productName: "Omega" },
    { name: "ESQ* -> drywall", sku: "ESQ25", productName: "Esquinero" },
    { name: "P* sin GALV -> NO drywall", sku: "PL030ROJO", productName: "Plancha" },
    // 5. metallic-roofing
    { name: "COB* -> metallic-roofing", sku: "COB030ROJO", productName: "Cobertura" },
    { name: "PL* -> metallic-roofing", sku: "PL035AZUL", productName: "Plancha" },
    { name: "ACCES* -> metallic-roofing", sku: "ACCESCUMBRE", productName: "Cumbrera" },
    // 6. roofing
    { name: "UPVC* -> roofing", sku: "UPVC3MT", productName: "Cobertura UPVC" },
    { name: "nombre con TC5 -> roofing", sku: "QQQ", productName: "COBERTURA TC5 GRIS" },
    // 7. trading
    { name: "POLI* -> trading", sku: "POLI10", productName: "Poli" },
    { name: "TUBO* -> trading", sku: "TUBO2", productName: "Tubo" },
    { name: "AUTOP* -> trading", sku: "AUTOP12", productName: "Autoperforante" },
    // 8. services
    { name: "CONFORM* -> services", sku: "CONFORM01", productName: "Conformado" },
    { name: "SERV* -> services", sku: "SERV-CORTE", productName: "Servicio de corte" },
    // 9. sin match
    { name: "nada matchea -> unclassified", sku: "ZZZZ999", productName: "Producto raro" },
    // bordes
    { name: "strings vacios", sku: "", productName: "" },
    { name: "minusculas (la fn hace toUpperCase)", sku: "cob030rojo", productName: "cobertura" },
    { name: "minusculas en el nombre para TC5", sku: "qqq", productName: "cobertura tc5" },
  ];

  for (const { name, sku, productName } of cases) {
    it(`paridad: ${name}`, () => {
      expect(classifyBackend(sku, productName)).toBe(classifyClient(sku, productName));
    });
  }

  it("los casos cubren los 8 targets posibles", () => {
    const targets = new Set(cases.map((c) => classifyBackend(c.sku, c.productName)));
    expect([...targets].sort()).toEqual(
      ["coil", "drywall", "metallic-roofing", "roofing", "services", "skip", "trading", "unclassified"],
    );
  });
});
