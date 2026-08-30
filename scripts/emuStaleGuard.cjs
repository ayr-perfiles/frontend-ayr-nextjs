const fs = require("fs");
const path = require("path");

/**
 * Guard de staleness de `functions/lib` (frente [EMU-STALE-LIB]).
 *
 * El emulador de Functions carga `functions/lib/*.js` YA COMPILADO, y
 * `firebase emulators:exec` NO corre el `predeploy` build de `functions/`.
 * Un `test:emu` contra un callable con cambios sin recompilar mide código
 * VIEJO **en silencio** — un falso verde indistinguible de uno real.
 *
 * La decisión pura vive en `isLibStale`. El I/O (caminar el árbol, leer
 * mtimes) va en la sección "I/O" de más abajo, thin wrappers sin decisión
 * propia y SIN test.
 *
 * DISEÑO: se ABORTA con mensaje accionable, NUNCA se auto-compila. Un build
 * incondicional agrega ~20s a cada corrida de las 3 suites de emulador y
 * esconde el problema en vez de denunciarlo.
 */

/**
 * true si `functions/lib` está desactualizado respecto de `functions/src`.
 *
 * - `libMtimes` vacío  -> true (nunca se compiló; nada que cargar).
 * - `srcMtimes` vacío  -> false (no hay fuente que pueda estar stale).
 * - si no, true sii `max(srcMtimes) > max(libMtimes)`.
 *
 * La comparación es ESTRICTAMENTE mayor: un src y un lib escritos en el mismo
 * ms es el caso normal de un build recién corrido, y tratarlo como stale
 * abortaría toda corrida limpia.
 *
 * @param {number[]} srcMtimes mtimes (ms) de los `.ts` compilables de `functions/src`.
 * @param {number[]} libMtimes mtimes (ms) de los `.js` de `functions/lib`.
 * @returns {boolean}
 */
function isLibStale(srcMtimes, libMtimes) {
  if (!Array.isArray(libMtimes) || libMtimes.length === 0) return true;
  if (!Array.isArray(srcMtimes) || srcMtimes.length === 0) return false;
  return Math.max(...srcMtimes) > Math.max(...libMtimes);
}

/**
 * true si el comando interno arranca el emulador de FUNCTIONS — el único que
 * carga `functions/lib`. Se deriva del `--only` que ya vive en el script de
 * `package.json` (fuente única), NUNCA de una lista de scripts hardcodeada
 * acá: `test:emu:rules` corre `--only firestore` y abortarlo por staleness de
 * `lib` sería un falso positivo.
 *
 * Sin `--only`, `firebase emulators:exec` arranca TODOS los emuladores -> se
 * asume el caso caro (true).
 *
 * @param {string} innerCommand
 * @returns {boolean}
 */
function startsFunctionsEmulator(innerCommand) {
  const match = /--only\s+(\S+)/.exec(innerCommand || "");
  if (!match) return true;
  return match[1]
    .split(",")
    .map((s) => s.trim())
    .includes("functions");
}

// ---------------------------------------------------------------------------
// I/O — thin wrappers, sin decisión propia, SIN test.
// ---------------------------------------------------------------------------

/** mtimes (ms) de todos los archivos bajo `dir` que pasen `accept(filename)`. */
function collectMtimes(dir, accept) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    // Directorio inexistente (ej. `lib` antes del primer build) -> sin mtimes.
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out.push(...collectMtimes(full, accept));
    } else if (entry.isFile() && accept(entry.name)) {
      try {
        out.push(fs.statSync(full).mtimeMs);
      } catch {
        // Archivo que desapareció entre readdir y stat: se ignora.
      }
    }
  }
  return out;
}

/**
 * Los `.ts` que `tsc` REALMENTE compila, según `functions/tsconfig.json`
 * (`include: ["src"]`, `exclude: ["src/**\/*.test.ts", "src/**\/*.spec.ts"]`).
 * Los tests quedan fuera a propósito: tocarlos no invalida `lib`.
 */
function isCompilableSource(filename) {
  return (
    filename.endsWith(".ts") && !filename.endsWith(".test.ts") && !filename.endsWith(".spec.ts")
  );
}

/** Los `.js` emitidos (nunca los `.js.map`). */
function isEmittedOutput(filename) {
  return filename.endsWith(".js");
}

/** Lee del disco los mtimes de `functions/src` y `functions/lib`. */
function readFunctionsMtimes(functionsDir = path.join(__dirname, "..", "functions")) {
  return {
    srcMtimes: collectMtimes(path.join(functionsDir, "src"), isCompilableSource),
    libMtimes: collectMtimes(path.join(functionsDir, "lib"), isEmittedOutput),
  };
}

/** Lee `scripts[name]` de package.json (para derivar el `--only`). */
function readNpmScript(name, packageJsonPath = path.join(__dirname, "..", "package.json")) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    return (pkg.scripts && pkg.scripts[name]) || "";
  } catch {
    return "";
  }
}

module.exports = {
  isLibStale,
  startsFunctionsEmulator,
  readNpmScript,
  collectMtimes,
  isCompilableSource,
  isEmittedOutput,
  readFunctionsMtimes,
};
