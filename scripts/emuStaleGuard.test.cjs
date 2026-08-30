const { isLibStale, startsFunctionsEmulator } = require("./emuStaleGuard.cjs");

describe("isLibStale — comparador puro de mtimes", () => {
  it("lib FRESCO (max lib > max src) -> false", () => {
    expect(isLibStale([100, 200], [300])).toBe(false);
  });

  it("lib VIEJO (max src > max lib) -> true", () => {
    expect(isLibStale([100, 500], [300])).toBe(true);
  });

  it("lib VACIO (nunca se compiló) -> true, sin importar src", () => {
    expect(isLibStale([100], [])).toBe(true);
  });

  it("src VACIO con lib presente -> false (no hay nada que pueda estar stale)", () => {
    expect(isLibStale([], [300])).toBe(false);
  });

  // Ancla de borde: la comparación es ESTRICTAMENTE mayor. Un src y un lib
  // escritos en el mismo ms NO es staleness — es el caso normal de un build
  // recién corrido, y tratarlo como stale abortaría toda corrida limpia.
  it("max(src) === max(lib) -> false (comparación estricta, no >=)", () => {
    expect(isLibStale([300], [300])).toBe(false);
  });
});

describe("startsFunctionsEmulator — deriva del --only del comando interno", () => {
  it("--only con functions en la lista -> true", () => {
    const cmd =
      'firebase emulators:exec --project ayrsteel-test "vitest run" --only auth,firestore,storage,functions';
    expect(startsFunctionsEmulator(cmd)).toBe(true);
  });

  it("--only firestore (test:emu:rules) -> false, no carga functions/lib", () => {
    const cmd = 'firebase emulators:exec --project ayrsteel-test "npx vitest run" --only firestore';
    expect(startsFunctionsEmulator(cmd)).toBe(false);
  });

  it("sin --only -> true (firebase arranca TODOS los emuladores; se asume el caro)", () => {
    const cmd = 'firebase emulators:exec --project ayrsteel-test "vitest run"';
    expect(startsFunctionsEmulator(cmd)).toBe(true);
  });
});
