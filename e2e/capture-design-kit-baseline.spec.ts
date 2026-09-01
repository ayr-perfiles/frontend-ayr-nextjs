/**
 * TANDA 17/18 — custodio VISUAL para la adopción del design-kit. No hay assert
 * unitario posible sobre color/spacing/radius en este stack (jsdom+Vitest no
 * renderiza CSS real) — la única foto fiable es una página real contra
 * `ayrsteel-test`, reusando la MISMA sesión/entorno que el harness del
 * importador ya valida (`B22`, `global-setup.ts`).
 *
 * TANDA 18 — reemplaza la captura única de la 17 (que cayó sobre un empty
 * state real, "0 productos") por un SET de 6 pantallas, todas elegidas por
 * tener datos REALES ya existentes en `ayrsteel-test` (recon previo, sin
 * sembrar nada) y por cubrir superficies visuales distintas — no páginas
 * parecidas entre sí:
 *
 *   1. sales-table       — tabla con filas + TablePagination (10 filas reales)
 *   2. quotations-badges — tabla con filas + badges de estado (27 filas, "VIGENTE")
 *   3. drywall-kpis      — KPI cards + tabla (3 filas, valores de stock)
 *   4. dashboard-sidebar — sidebar expandido con sus 6 grupos + puntos LOB
 *   5. sale-detail-modal — modal abierto (SaleDetailsModal sobre una venta real)
 *   6. purchase-form     — formulario con inputs y selects (página dedicada)
 *
 * NO incluye el diálogo de confirmación (useConfirm): no se encontró un
 * trigger inequívocamente seguro de disparar sin arriesgar ejecutar una
 * acción destructiva real contra el entorno compartido `ayrsteel-test` —
 * decisión explícita, no descuido.
 *
 * Corre por comando propio (`AYR_CAPTURE_OUT_DIR=<dir> npx playwright test
 * --config e2e/playwright.config.ts e2e/capture-design-kit-baseline.spec.ts`),
 * excluido de `npm run test:e2e` por `testIgnore` en `playwright.config.ts`
 * (Tanda 18 — reemplaza el `test.skip()` silencioso de la Tanda 17).
 */
import { test, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const OUT_DIR = process.env.AYR_CAPTURE_OUT_DIR || "";

async function settle(page: Page) {
  await page.waitForSelector("table, [class*='empty']", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1200); // asentar fuentes/íconos tras el primer paint
}

async function capture(page: Page, name: string) {
  const heightPx = await page.evaluate(() => document.documentElement.scrollHeight);
  fs.writeFileSync(path.join(OUT_DIR, `${name}.height.txt`), String(heightPx));
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
}

test("captura de 6 pantallas con datos reales", async ({ page }) => {
  if (!OUT_DIR) throw new Error("AYR_CAPTURE_OUT_DIR no seteado.");
  fs.mkdirSync(OUT_DIR, { recursive: true });

  await page.goto("/admin/sales", { waitUntil: "domcontentloaded" });
  await settle(page);
  await capture(page, "1-sales-table");

  // Modal de detalle: sobre la primera fila visible.
  await page.locator('button[title="Ver Detalles"]').first().click();
  await page.waitForTimeout(1000);
  await capture(page, "5-sale-detail-modal");
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300);

  await page.goto("/admin/quotations", { waitUntil: "domcontentloaded" });
  await settle(page);
  await capture(page, "2-quotations-badges");

  await page.goto("/admin/lines/drywall/inventory", { waitUntil: "domcontentloaded" });
  await settle(page);
  await capture(page, "3-drywall-kpis");

  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await settle(page);
  await capture(page, "4-dashboard-sidebar");

  await page.goto("/admin/purchases/new", { waitUntil: "domcontentloaded" });
  await settle(page);
  await capture(page, "6-purchase-form");
});
