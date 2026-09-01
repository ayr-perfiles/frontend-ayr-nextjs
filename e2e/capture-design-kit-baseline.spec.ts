/**
 * TANDA 17 — custodio VISUAL para la adopción del design-kit. No hay assert
 * unitario posible sobre color/spacing/radius en este stack (jsdom+Vitest no
 * renderiza CSS real) — la única foto fiable es una captura de página real
 * contra `ayrsteel-test`, con la MISMA sesión/entorno que el harness del
 * importador ya valida (`B22`, `global-setup.ts`).
 *
 * Página piloto: `/admin/lines/trading/inventory` — re-verificada en E1.1 de
 * esta tanda (usa las 5 piezas: useTableData/DataTable/TableFilters/
 * TablePagination/RowActionsMenu), NO la que el director había propuesto
 * originalmente (`trading/catalog`, que falló verificación en la Tanda 16).
 *
 * Corre por comando propio, apuntado (`npx playwright test --config
 * e2e/playwright.config.ts e2e/capture-design-kit-baseline.spec.ts`) — NO por
 * `npm run test:e2e`, que correría también los 6 escenarios del importador.
 */
import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const OUT_DIR = process.env.AYR_CAPTURE_OUT_DIR || "";

// Sin AYR_CAPTURE_OUT_DIR, este spec se SALTEA (no falla): así `npm run
// test:e2e` (que recoge TODO *.spec.ts) no reporta un rojo ajeno al
// importador cuando nadie pidió la captura explícitamente.
test.skip(!OUT_DIR, "AYR_CAPTURE_OUT_DIR no seteado — captura no solicitada en esta corrida.");

test("captura de /admin/lines/trading/inventory", async ({ page }) => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  await page.goto("/admin/lines/trading/inventory", { waitUntil: "domcontentloaded" });

  // Esperar HECHO, no estado de red (mismo criterio que global-setup.ts: esta
  // app nunca llega a networkidle por el canal long-polling de Firestore).
  // El hecho que importa acá: la tabla montó, con filas o con su empty state.
  await page.waitForSelector("table, [class*='empty']", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1500); // deja asentar fuentes/íconos tras el primer paint

  const rowCount = await page.locator("table tbody tr").count();
  fs.writeFileSync(path.join(OUT_DIR, "row-count.txt"), String(rowCount));

  await page.screenshot({
    path: path.join(OUT_DIR, "trading-inventory-full.png"),
    fullPage: true,
  });
});
