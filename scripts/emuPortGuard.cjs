const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * Lógica pura del guard de puertos de emulador (frente 4+5). El I/O real
 * (ejecutar netstat/lsof, leer firebase.json, matar el proceso) vive en las
 * funciones de la sección "I/O" más abajo, thin wrappers sin decisión propia
 * y SIN test — toda la decisión vive en los 3 puros de arriba.
 */

function parsePortHoldersWindows(output, port) {
  const portSuffix = ":" + port;
  const pids = new Set();
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const fields = trimmed.split(/\s+/);
    if (fields.length < 4) continue;
    // Match sobre la columna LOCAL (fields[1]), NUNCA sobre la línea entera —
    // un includes(":8080") sobre la línea completa matchearía tanto ":18080"
    // como una dirección REMOTA que termine en ":8080".
    const localAddress = fields[1];
    if (!localAddress || !localAddress.endsWith(portSuffix)) continue;
    if (!fields.includes("LISTENING")) continue;
    const pid = Number(fields[fields.length - 1]);
    if (Number.isFinite(pid)) pids.add(pid);
  }
  return Array.from(pids);
}

function parsePortHoldersLinux(output) {
  const pids = [];
  for (const rawLine of output.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const pid = Number(trimmed);
    if (Number.isFinite(pid)) pids.push(pid);
  }
  return pids;
}

/**
 * Extrae los PIDs únicos que están escuchando (LISTENING) en `port`, a partir
 * de la salida cruda de `netstat -ano` (Windows) o `lsof -ti :port` (Linux).
 * @param {string} output
 * @param {number} port
 * @param {"win32" | "linux" | string} platform
 * @returns {number[]}
 */
function parsePortHolders(output, port, platform) {
  if (platform === "win32") return parsePortHoldersWindows(output, port);
  return parsePortHoldersLinux(output);
}

/**
 * true si el CommandLine corresponde al emulador de Firestore (el .jar de
 * cloud-firestore-emulator). false ante cualquier duda (incl. commandLine
 * ausente/no legible) — la respuesta segura es NO matar.
 *
 * NO se matchea la versión del jar (`-v1.20.2`) a propósito: cambia con
 * cualquier update de la CLI de Firebase y el guard dejaría de reconocer el
 * proceso en silencio.
 * @param {string | null | undefined} commandLine
 * @returns {boolean}
 */
function isEmulatorProcess(commandLine) {
  if (!commandLine) return false;
  return commandLine.includes("cloud-firestore-emulator");
}

/**
 * Puertos declarados en el bloque `emulators` de firebase.json ya parseado
 * (no lee disco). Ignora entradas sin `port` (ej. `ui`, `singleProjectMode`).
 * @param {object} firebaseJson
 * @returns {number[]}
 */
function readEmulatorPorts(firebaseJson) {
  const emulators = firebaseJson && firebaseJson.emulators;
  if (!emulators || typeof emulators !== "object") return [];
  const ports = [];
  for (const key of Object.keys(emulators)) {
    const entry = emulators[key];
    if (
      entry &&
      typeof entry === "object" &&
      typeof entry.port === "number" &&
      Number.isFinite(entry.port)
    ) {
      ports.push(entry.port);
    }
  }
  return ports;
}

// ---------------------------------------------------------------------------
// I/O — thin wrappers, sin decisión propia, SIN test.
// ---------------------------------------------------------------------------

/** Salida cruda del comando de puertos para la plataforma actual. */
function getPortHoldersOutput(port, platform = process.platform) {
  if (platform === "win32") {
    return execSync(`netstat -ano`, { encoding: "utf8" });
  }
  try {
    return execSync(`lsof -ti :${port}`, { encoding: "utf8" });
  } catch (err) {
    // lsof sale con código != 0 cuando no hay nada escuchando en el puerto.
    if (err.stdout) return err.stdout.toString();
    return "";
  }
}

/** Lee y parsea firebase.json del disco. */
function readFirebaseJson(firebaseJsonPath = path.join(__dirname, "..", "firebase.json")) {
  const raw = fs.readFileSync(firebaseJsonPath, "utf8");
  return JSON.parse(raw);
}

/** CommandLine de un PID, o null si no se pudo leer. */
function getCommandLine(pid, platform = process.platform) {
  try {
    if (platform === "win32") {
      const out = execSync(
        `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine"`,
        { encoding: "utf8" },
      );
      const trimmed = out.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").replace(/\0/g, " ").trim() || null;
  } catch {
    return null;
  }
}

/** Mata un PID. */
function killPid(pid) {
  process.kill(pid);
}

module.exports = {
  parsePortHolders,
  isEmulatorProcess,
  readEmulatorPorts,
  getPortHoldersOutput,
  readFirebaseJson,
  getCommandLine,
  killPid,
};
