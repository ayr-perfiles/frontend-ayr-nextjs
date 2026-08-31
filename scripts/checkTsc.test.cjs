const { parseTscOutput, buildVerdict, detectMismatch } = require("./check-tsc.cjs");

// Forma real de un diagnostico de tsc, medida contra el RED de este mismo frente
// (fixture descartable con un TS2322, corrido y borrado en el PASO E1.1):
//   src/__red_tsc_fixture.ts(2,14): error TS2322: Type 'string' is not assignable to type 'number'.
const DIAG_REAL =
  "src/__red_tsc_fixture.ts(2,14): error TS2322: Type 'string' is not assignable to type 'number'.";

// Seis diagnosticos con la FORMA de los TS2345 que en v6.81.0 se reportaron como
// verdes. NO son la salida historica verbatim (no quedo guardada) — reproducen el
// shape, que es lo que el parser tiene que contar.
const SEIS_TS2345 = Array.from(
  { length: 6 },
  (_, i) =>
    `src/hooks/useCoils.test.ts(${10 + i},5): error TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'.`,
).join("\n");

describe("parseTscOutput — conteo de diagnosticos", () => {
  it("salida vacia (corrida verde real de tsc) da 0", () => {
    expect(parseTscOutput("")).toEqual({ errorLines: [], count: 0 });
  });

  it("no tira con null/undefined y devuelve 0", () => {
    expect(parseTscOutput(null).count).toBe(0);
    expect(parseTscOutput(undefined).count).toBe(0);
  });

  it("cuenta 1 diagnostico real", () => {
    const res = parseTscOutput(DIAG_REAL);
    expect(res.count).toBe(1);
    expect(res.errorLines[0]).toBe(DIAG_REAL);
  });

  it("cuenta los 6 del shape de v6.81.0", () => {
    expect(parseTscOutput(SEIS_TS2345).count).toBe(6);
  });

  it("cuenta igual con CRLF (Windows)", () => {
    const crlf = SEIS_TS2345.split("\n").join("\r\n");
    expect(parseTscOutput(crlf).count).toBe(6);
  });

  it("NO cuenta la linea resumen 'Found N errors' como diagnostico", () => {
    // Es la razon por la que se cuenta por diagnostico y no parseando el resumen:
    // con 0 errores tsc no imprime resumen, y con N lo imprime ADEMAS de los N.
    const conResumen = `${SEIS_TS2345}\n\nFound 6 errors in 1 file.\n`;
    expect(parseTscOutput(conResumen).count).toBe(6);
  });

  it("NO cuenta prosa que mencione 'error' sin el patron TS<n>", () => {
    const prosa = "se produjo un error al leer el archivo\nerror: algo salio mal";
    expect(parseTscOutput(prosa).count).toBe(0);
  });

  it("cuenta solo los diagnosticos cuando vienen mezclados con ruido", () => {
    const mezcla = `Starting compilation...\n${DIAG_REAL}\nFound 1 error in 1 file.\n`;
    expect(parseTscOutput(mezcla).count).toBe(1);
  });
});

describe("buildVerdict — el veredicto sobrevive a un pipe", () => {
  it("VERDE solo si exit 0 Y 0 diagnosticos", () => {
    const lines = buildVerdict({ count: 0, exitCode: 0, logPath: "/tmp/x.log" });
    expect(lines).toContain("TSC_VEREDICTO: VERDE");
    expect(lines).toContain("TSC_ERRORS: 0");
    expect(lines).toContain("TSC_EXIT: 0");
  });

  it("ROJO con exit != 0", () => {
    const lines = buildVerdict({ count: 1, exitCode: 1, logPath: "/tmp/x.log" });
    expect(lines).toContain("TSC_VEREDICTO: ROJO");
  });

  it("ROJO con diagnosticos aunque el exit sea 0", () => {
    // Caso paranoico: si tsc alguna vez saliera 0 con diagnosticos parseados, el
    // veredicto NO debe decir VERDE.
    const lines = buildVerdict({ count: 6, exitCode: 0, logPath: "/tmp/x.log" });
    expect(lines).toContain("TSC_VEREDICTO: ROJO");
  });

  it("el veredicto queda al FINAL, para sobrevivir a `| tail -5`", () => {
    // Defensa 2 del script: un pipe siempre devuelve el status del ultimo comando
    // (eso no se puede impedir), pero el veredicto tiene que seguir VISIBLE. Las 2
    // fallas historicas fueron un `tail` que mostro cualquier cosa menos esto.
    const lines = buildVerdict({ count: 6, exitCode: 1, logPath: "/tmp/x.log" });
    const ultimas5 = lines.slice(-5);
    expect(ultimas5).toContain("TSC_VEREDICTO: ROJO");
    expect(ultimas5).toContain("TSC_ERRORS: 6");
    expect(ultimas5).toContain("TSC_EXIT: 1");
  });
});

describe("detectMismatch — denuncia el desacuerdo, no lo tapa", () => {
  it("verde coherente no advierte", () => {
    expect(detectMismatch({ count: 0, exitCode: 0 })).toBeNull();
  });

  it("rojo coherente no advierte", () => {
    expect(detectMismatch({ count: 6, exitCode: 1 })).toBeNull();
  });

  it("exit != 0 sin diagnosticos parseados advierte (fallo de config, no de tipos)", () => {
    const msg = detectMismatch({ count: 0, exitCode: 1 });
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/config|arranque/i);
  });

  it("diagnosticos con exit 0 advierte", () => {
    const msg = detectMismatch({ count: 6, exitCode: 0 });
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/exit code manda/i);
  });
});
