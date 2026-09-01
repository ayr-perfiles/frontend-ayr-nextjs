/**
 * TANDA 11 — [E2E-HARNESS] · config del harness. Fila de COLA `#6`.
 *
 * Se corre con `npm run test:e2e`. NO entra a `npm run test`, `test:emu` ni
 * `test:emu:rules`: es un custodio propio, con su propio comando.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DECISIONES QUE NO SON PREFERENCIA
 * ─────────────────────────────────────────────────────────────────────────────
 * · **Dev server PROPIO en 3101, `reuseExistingServer: false`.** Engancharse a
 *   `:3000`/`:3001` es el origen literal de `B12` (v6.79.0): esos son procesos
 *   del dueño, levantados con un código y un entorno que este harness no
 *   controla ni puede medir. Un server propio hace que "contra qué commit y qué
 *   entorno corrió" sea una propiedad del harness, no una suposición.
 *
 * · **Backend = nube `ayrsteel-test`, NO emulador.** `NEXT_PUBLIC_USE_EMULATOR`
 *   tiene default EMULADOR (`clientApp.ts`: `!== "false"`), así que se fuerza
 *   `"false"` EXPLÍCITO acá. Y `NEXT_PUBLIC_FIREBASE_PROJECT_ID` también se
 *   fuerza: `.env.local` tiene dos bloques de config (uno comentado apuntando a
 *   `ayrsteel-2026`) y el harness no puede depender de cuál esté descomentado.
 *
 * · **`workers: 1`.** Los 6 escenarios comparten los mismos docs sembrados en un
 *   backend REAL compartido; en paralelo se pisarían entre sí y la idempotencia
 *   dejaría de ser medible.
 *
 * · **`retries: 0`.** Un reintento que pinta de verde un escenario que falló la
 *   primera vez destruye justamente lo que la corrida doble mide.
 */
import { defineConfig } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Credenciales: FUERA del repo (D4), nunca versionadas.
const ENV_TEST = path.join(os.homedir(), "ayr-scratch", ".env.test");
if (fs.existsSync(ENV_TEST)) {
  for (const line of fs.readFileSync(ENV_TEST, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

// Scripts de seed/teardown/dump: FUERA del repo (D4). Override por env para que
// el repo no hardcodee una ruta de una máquina concreta.
const SCRATCH =
  process.env.AYR_E2E_SCRATCH ||
  path.join(os.homedir(), "ayr-scratch", "2026-08-31-tanda11");
process.env.AYR_E2E_SCRATCH = SCRATCH;

const PORT = Number(process.env.AYR_E2E_PORT || 3101);
const BASE_URL = process.env.AYR_E2E_BASE_URL || `http://localhost:${PORT}`;

// La raíz del repo. `webServer.command` corre desde el directorio del CONFIG
// (o sea `e2e/`), donde `next dev` no encuentra `app/` y muere con
// "Couldn't find any `pages` or `app` directory" — medido en la 1ª corrida.
//
// Se deriva de `process.cwd()` y NO de `__dirname`: Playwright carga este
// config como ESM, donde `__dirname` no existe (medido: `ReferenceError:
// __dirname is not defined in ES module scope`). `npm run test:e2e` siempre
// pone el cwd en el directorio del `package.json`, así que es determinista —
// y si alguien lo corre desde otro lado, el assert de abajo falla RUIDOSO en
// vez de arrancar un dev server en el directorio equivocado.
const REPO_ROOT = process.cwd();
if (!fs.existsSync(path.join(REPO_ROOT, "package.json"))) {
  throw new Error(
    `[E2E-HARNESS] cwd inesperado: ${REPO_ROOT} (no tiene package.json). ` +
      "Corré el harness con `npm run test:e2e` desde la raíz del repo.",
  );
}
const AUTH_STATE = path.join(REPO_ROOT, "e2e", ".auth", "state.json");
process.env.AYR_E2E_AUTH_STATE = AUTH_STATE;

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  globalSetup: "./global-setup.ts",
  reporter: [["list"], ["html", { outputFolder: path.join(SCRATCH, "report"), open: "never" }]],
  outputDir: path.join(SCRATCH, "traces"),
  use: {
    baseURL: BASE_URL,
    storageState: AUTH_STATE,
    trace: "on", // traza por escenario, persistida en SCRATCH (fuera del repo)
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    cwd: REPO_ROOT,
    url: BASE_URL,
    reuseExistingServer: false, // NUNCA engancharse a :3000/:3001 (B12)
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      NEXT_PUBLIC_USE_EMULATOR: "false",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "ayrsteel-test",
      // Dist dir PROPIO: `next dev` toma un lock exclusivo en
      // `<distDir>/dev/lock` y el dev server del dueño (vivo en :3000/:3001)
      // ya tiene el de `.next`. Ver el comentario en `next.config.ts`.
      AYR_E2E_DIST_DIR: ".next-e2e",
    },
  },
});
