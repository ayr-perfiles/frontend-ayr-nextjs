#!/usr/bin/env node
/**
 * check-tsc.cjs — corre `tsc --noEmit` de forma que el exit code REAL no se
 * pueda perder y el veredicto no se pueda ocultar detrás de un pipe.
 *
 * POR QUÉ EXISTE (frente [CHECK-TSC-SCRIPT], COLA #46):
 * La regla "todo gate que dependa del exit code real corre SIN pipe" vive en
 * CLAUDE.md §11 desde v6.74.0 y falló DOS veces igual:
 *   - v6.74.0: se reportó `EXIT_TSC:0` que era el exit de `tail`, no de `tsc`.
 *   - v6.81.0: se reportó `tsc` verde estando en ROJO con 6 TS2345.
 * Una regla que falló dos veces es un script pendiente.
 *
 * LAS DOS DEFENSAS, y por qué hacen falta LAS DOS:
 *
 * 1. EXIT CODE REAL. Mismo molde que scripts/with-emulator.cjs, cuya única
 *    responsabilidad crítica ya es exactamente ésta: el exit final sale del
 *    comando interno, nunca de la limpieza ni del reporte.
 *
 * 2. VEREDICTO AL FINAL DE LA SALIDA. Un pipe (`| tail -5`) SIEMPRE devuelve
 *    el status del último comando de la tubería — eso no se puede impedir desde
 *    acá, es semántica de la shell. Lo que sí se puede es hacer que el pipe deje
 *    de ser necesario y, si alguien lo usa igual, que la verdad siga estando
 *    visible: el bloque de veredicto se imprime ÚLTIMO, así que un `| tail -5`
 *    muestra `TSC_ERRORS`/`TSC_EXIT`, no las últimas líneas de un diagnóstico.
 *    Las dos fallas históricas fueron exactamente eso: un `tail` que mostró
 *    cualquier cosa menos el veredicto.
 *
 * SIN SHELL: el output se captura por buffer y se escribe a archivo desde Node.
 * Eso elimina por construcción la otra mitad de la trampa — la redirección
 * invertida (`2>&1 > archivo`, que manda stdout al archivo y stderr al canal
 * viejo). Acá no hay orden de redirección que equivocar.
 */
const { spawnSync } = require("child_process");
const { writeFileSync } = require("fs");
const path = require("path");
const os = require("os");

/** Línea de diagnóstico real de tsc: `archivo(l,c): error TS1234: msg`. */
const TSC_ERROR_LINE = /:\s*error\s+TS\d+:/;

/**
 * Cuenta los diagnósticos de error de una corrida de tsc.
 *
 * Cuenta LÍNEAS DE DIAGNÓSTICO, no la línea resumen "Found N errors": con 0
 * errores tsc no imprime resumen alguno, así que parsear el resumen deja el
 * caso verde sin señal. El conteo por diagnóstico funciona en los dos casos.
 *
 * @param {string} raw salida cruda de tsc (stdout + stderr concatenados)
 * @returns {{ errorLines: string[], count: number }}
 */
function parseTscOutput(raw) {
  if (typeof raw !== "string" || raw.length === 0) {
    return { errorLines: [], count: 0 };
  }
  const errorLines = raw
    .split(/\r?\n/)
    .filter((line) => TSC_ERROR_LINE.test(line));
  return { errorLines, count: errorLines.length };
}

/**
 * Arma el bloque de veredicto. Va SIEMPRE al final de la salida, para que
 * sobreviva a un `| tail -N` (ver defensa 2 del docblock).
 *
 * @param {{ count: number, exitCode: number, logPath: string }} input
 * @returns {string[]} líneas a imprimir, en orden
 */
function buildVerdict({ count, exitCode, logPath }) {
  const verde = exitCode === 0 && count === 0;
  return [
    "========================================",
    `TSC_ERRORS: ${count}`,
    `TSC_EXIT: ${exitCode}`,
    `TSC_LOG: ${logPath}`,
    `TSC_VEREDICTO: ${verde ? "VERDE" : "ROJO"}`,
    "========================================",
  ];
}

/**
 * Discrepancia entre el exit code y el conteo de diagnósticos. Cualquiera de
 * las dos direcciones significa que la salida no se parseó como se creía, y
 * en ese caso el exit code manda — pero el desacuerdo se DENUNCIA, no se tapa.
 *
 * @param {{ count: number, exitCode: number }} input
 * @returns {string|null} mensaje de advertencia, o null si son coherentes
 */
function detectMismatch({ count, exitCode }) {
  if (exitCode !== 0 && count === 0) {
    return "[check-tsc] ADVERTENCIA: tsc salió con código != 0 pero no se parseó ningún diagnóstico. Revisá el log crudo: el fallo puede ser de config/arranque, no de tipos.";
  }
  if (exitCode === 0 && count > 0) {
    return "[check-tsc] ADVERTENCIA: se parsearon diagnósticos pero tsc salió 0. El exit code manda, pero esto no debería pasar — revisá el log crudo.";
  }
  return null;
}

function main() {
  const logPath = path.join(os.tmpdir(), "ayr-check-tsc.log");

  // `shell: true` es obligatorio en Windows: npx es un batch file, no un
  // ejecutable — spawnSync sin shell falla con EINVAL (medido en v6.63.0).
  // El shell se usa SOLO para resolver el binario; la salida NO pasa por
  // ninguna redirección de shell, se captura por buffer acá abajo.
  const result = spawnSync("npx", ["tsc", "--noEmit"], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.error) {
    console.error(`[check-tsc] no se pudo ejecutar tsc: ${result.error.message}`);
    process.exit(1);
  }

  const raw = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const exitCode = typeof result.status === "number" ? result.status : 1;
  const { errorLines, count } = parseTscOutput(raw);

  try {
    writeFileSync(logPath, raw, "utf8");
  } catch (err) {
    console.error(`[check-tsc] no se pudo escribir el log en ${logPath}: ${err.message}`);
  }

  // Los diagnósticos primero, el veredicto último.
  if (raw.trim().length > 0) console.log(raw.trimEnd());

  const mismatch = detectMismatch({ count, exitCode });
  if (mismatch) console.error(mismatch);

  for (const line of buildVerdict({ count, exitCode, logPath })) {
    console.log(line);
  }

  process.exit(exitCode);
}

module.exports = { parseTscOutput, buildVerdict, detectMismatch, TSC_ERROR_LINE };

if (require.main === module) main();
