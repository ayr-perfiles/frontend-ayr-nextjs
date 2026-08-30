#!/usr/bin/env node
const { spawnSync } = require("child_process");
const {
  readFirebaseJson,
  readEmulatorPorts,
  getPortHoldersOutput,
  parsePortHolders,
  getCommandLine,
  isEmulatorProcess,
  killPid,
} = require("./emuPortGuard.cjs");
const {
  isLibStale,
  startsFunctionsEmulator,
  readNpmScript,
  readFunctionsMtimes,
} = require("./emuStaleGuard.cjs");

function holdersFor(port) {
  const output = getPortHoldersOutput(port);
  return parsePortHolders(output, port, process.platform);
}

function preCheck(ports) {
  let occupied = false;
  for (const port of ports) {
    for (const pid of holdersFor(port)) {
      occupied = true;
      const cmd = getCommandLine(pid);
      console.error(
        `[with-emulator] puerto ${port} ya ocupado por PID ${pid} (CommandLine: ${cmd ?? "no se pudo leer"}).`,
      );
    }
  }
  if (occupied) {
    console.error("[with-emulator] Abortando ANTES de arrancar. Matá el/los PID de arriba y reintentá.");
    process.exit(1);
  }
}

/**
 * Aborta si `functions/lib` está desactualizado respecto de `functions/src`
 * Y el comando interno arranca el emulador de functions (frente
 * [EMU-STALE-LIB]). `emulators:exec` NO corre el `predeploy` build de
 * `functions/`, así que sin este guard una corrida contra un callable con
 * cambios sin recompilar mide código VIEJO en silencio.
 *
 * NO auto-compila a propósito: denuncia en vez de esconder.
 */
function staleCheck(scriptName) {
  if (!startsFunctionsEmulator(readNpmScript(scriptName))) return;

  const { srcMtimes, libMtimes } = readFunctionsMtimes();
  if (!isLibStale(srcMtimes, libMtimes)) return;

  const motivo =
    libMtimes.length === 0
      ? "functions/lib no existe o está vacío (nunca se compiló)."
      : "functions/src tiene cambios más nuevos que functions/lib.";

  console.error(`[with-emulator] ${motivo}`);
  console.error(
    "[with-emulator] El emulador de Functions carga functions/lib/*.js YA COMPILADO,",
  );
  console.error(
    "[with-emulator] y `emulators:exec` NO corre el build. Correr esta suite ahora mediría",
  );
  console.error("[with-emulator] código VIEJO en silencio (falso verde).");
  console.error("[with-emulator] Corré esto y reintentá:");
  console.error("[with-emulator]     cd functions && npm run build");
  process.exit(1);
}

function reap(ports) {
  for (const port of ports) {
    for (const pid of holdersFor(port)) {
      const cmd = getCommandLine(pid);
      if (isEmulatorProcess(cmd)) {
        try {
          killPid(pid);
          console.log(`[with-emulator] puerto ${port}: matado PID ${pid} (huérfano del emulador).`);
        } catch (err) {
          console.error(`[with-emulator] puerto ${port}: no se pudo matar PID ${pid}: ${err.message}`);
        }
      } else {
        console.warn(
          `[with-emulator] puerto ${port} ocupado por PID ${pid} que NO es el emulador, no lo mato.`,
        );
      }
    }
  }
}

function main() {
  const scriptName = process.argv[2];
  if (!scriptName) {
    console.error("[with-emulator] uso: node scripts/with-emulator.cjs <npm-script-interno>");
    process.exit(1);
  }

  const ports = readEmulatorPorts(readFirebaseJson());

  // Primero el guard de staleness: es más barato que el de puertos y su
  // remedio (`cd functions && npm run build`) no depende de nada externo.
  staleCheck(scriptName);
  preCheck(ports);

  // `shell: true` es obligatorio en Windows: `npm`/`npm.cmd` es un batch file,
  // no un ejecutable — spawnSync sin shell falla con EINVAL al intentar
  // invocarlo directo (medido en el PASO 4 de este frente).
  let result;
  try {
    result = spawnSync("npm", ["run", scriptName], { stdio: "inherit", shell: true });
  } finally {
    // REAP incondicional: pase lo que pase con `npm run` (verde, rojo, o
    // spawn fallido), el huérfano se limpia igual. El exit code de acá abajo
    // sigue siendo el de `npm run`, nunca el de este bloque.
    reap(ports);
  }

  if (result.error) {
    console.error(`[with-emulator] no se pudo ejecutar npm run ${scriptName}: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(typeof result.status === "number" ? result.status : 1);
}

main();
