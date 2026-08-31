const { isBannerLine, protectedSkips, computeSkipBodyStart } = require("./check-docs.cjs");

// Lineas VERBATIM de los 5 banners reales del corpus (medidas 2026-08-31, truncadas al
// fragmento que importa). Si el hardening rompe alguna de estas, deja de saltar un archivo
// que SI debe saltarse y el ROTO sube por un motivo falso.
const BANNERS_REALES = {
  "coils.md":
    "> ÚLTIMA VERIFICACIÓN CÓDIGO+PROD: **§4 → 2026-08-28, ALCANCE ACOTADO** (solo el agregado de `coilTypeKey` al shape — el resto de §4 y §1-§5 NO se re-verificó en esta pasada).",
  "annulment.md":
    "> ÚLTIMA VERIFICACIÓN CÓDIGO+PROD: 2026-08-22 (v6.56.0). Resto del doc sin re-verificar en esa fecha.",
  "metallic.md":
    "> ⚠️ **BANNER DE ESTADO (2026-08-27, alcance: solo este banner) — EL MÓDULO ESTÁ VACÍO.**",
  "roofing.md":
    '> ⚠️ **Corrección puntual 2026-08-28 (`[DOCS-STALE-SWEEP]` PASO 3):** solo las secciones "Stock" y "Strategy de venta". Resto del doc SIN re-verificar desde Sprint 3.',
  "firestore-rules-explicadas.md":
    "> ⚠️ **ESTE DOCUMENTO NO CORRESPONDE AL `firestore.rules` REAL (verificado 2026-08-26, v6.66.0).**",
};

describe("isBannerLine — [CHECKDOCS-BANNER] endurecido", () => {
  for (const [archivo, linea] of Object.entries(BANNERS_REALES)) {
    it(`SIGUE reconociendo el banner deliberado de ${archivo}`, () => {
      expect(isBannerLine(linea)).toBe(true);
    });
  }

  // El falso positivo real: prosa normal del changelog de CLAUDE.md. Es la linea que en
  // v6.76.0 apago la verificacion del 47% del archivo sin emitir ningun error.
  it("NO matchea prosa normal del changelog (el falso positivo de v6.76.0)", () => {
    const prosa =
      "> **Estado:** Build 🟢 (52 páginas/rutas, exit 0) | tsc limpio (0 errores, raíz, no re-verificado en esta tanda) | 4 comandos custodios.";
    expect(isBannerLine(prosa)).toBe(false);
  });

  it("NO matchea prosa de staleness sin marca de banner", () => {
    expect(isBannerLine("> el resto del archivo quedo sin re-verificar en esta tanda")).toBe(false);
  });

  it("NO matchea una linea que no sea blockquote, aunque traiga marca y prosa", () => {
    expect(isBannerLine("⚠️ ÚLTIMA VERIFICACIÓN: sin re-verificar")).toBe(false);
  });

  it("una marca SIN prosa de staleness tampoco dispara (hacen falta las dos)", () => {
    expect(isBannerLine("> ⚠️ **OJO: esto es peligroso.**")).toBe(false);
  });
});

describe("computeSkipBodyStart", () => {
  it("no saltea nada si el banner no tiene marca", () => {
    const lines = ["# Doc", "> tsc no re-verificado en esta tanda", "", "cuerpo"];
    expect(computeSkipBodyStart(lines)).toBe(null);
  });

  it("saltea desde despues del bloque cuando el banner SI tiene marca", () => {
    const lines = ["> ⚠️ **BANNER (alcance: solo este banner)**", "> sigue el banner", "", "cuerpo"];
    expect(computeSkipBodyStart(lines)).toBe(3);
  });
});

describe("protectedSkips — [CHECKDOCS-BANNER] error duro", () => {
  it("CLAUDE.md saltado -> lo reporta (hoy salia exit 0, en silencio)", () => {
    expect(protectedSkips([{ file: "CLAUDE.md", reason: "banner" }])).toEqual(["CLAUDE.md"]);
  });

  it("HANDOFF.md y GEMINI.md tambien estan protegidos", () => {
    const r = protectedSkips([{ file: "HANDOFF.md" }, { file: "GEMINI.md" }]);
    expect(r.sort()).toEqual(["GEMINI.md", "HANDOFF.md"]);
  });

  it("los 5 saltados legitimos NO son protegidos -> lista vacia", () => {
    const r = protectedSkips([
      { file: "docs/modules/coils.md" },
      { file: "docs/modules/metallic.md" },
      { file: "docs/modules/annulment.md" },
      { file: "docs/04-dominio/lineas-negocio/roofing.md" },
      { file: "docs/09-seguridad/firestore-rules-explicadas.md" },
    ]);
    expect(r).toEqual([]);
  });

  it("matchea por basename, no por path exacto (separador Windows incluido)", () => {
    expect(protectedSkips([{ file: "some\\dir\\CLAUDE.md" }])).toEqual(["CLAUDE.md"]);
  });

  it("lista vacia -> vacia", () => {
    expect(protectedSkips([])).toEqual([]);
  });
});
