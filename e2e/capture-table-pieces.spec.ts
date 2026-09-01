/**
 * TANDA 20 — custodio visual de las 4 piezas compartidas
 * (`DataTable`, `TableFilters`, `TablePagination`, `RowActionsMenu`).
 *
 * Se concentran en `/admin/sales` porque esa pantalla monta las 4 a la vez
 * con datos reales, y en estados que las hacen VISIBLES: sin abrir el menú
 * de fila ni el panel de filtros, el custodio no ve dos de las cuatro piezas
 * que esta tanda cambia.
 *
 * Estados capturados:
 *   a-tabla-lista      — DataTable con filas + TablePagination al pie
 *   b-menu-fila-abierto— RowActionsMenu desplegado (portal)
 *   c-filtros-abierto  — TableFilters con su panel abierto
 *   d-busqueda-vacia   — DataTable en emptyState (búsqueda sin resultados),
 *                        que además ejercita el input de TableFilters
 *   e-filtro-aplicado  — (TANDA 21) TableFilters con un valor APLICADO: la
 *                        barra pasa al estilo "activo" y aparece el badge de
 *                        conteo, que es una rama de render que ninguno de los
 *                        4 estados anteriores alcanzaba.
 *
 * `isLoading` NO se captura: es un estado transitorio que depende del tiempo
 * de respuesta de Firestore y no hay forma estable de congelarlo desde acá
 * sin mockear la red. Declarado, no simulado.
 */
import { test, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const OUT_DIR = process.env.AYR_CAPTURE_OUT_DIR || "";

async function shot(page: Page, name: string) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  fs.writeFileSync(path.join(OUT_DIR, `${name}.height.txt`), String(h));
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
}

test("piezas de tabla en 5 estados", async ({ page }) => {
  if (!OUT_DIR) throw new Error("AYR_CAPTURE_OUT_DIR no seteado.");
  fs.mkdirSync(OUT_DIR, { recursive: true });

  await page.goto("/admin/sales", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("table tbody tr", { timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, "a-tabla-lista");

  // (b) menú de fila abierto — el trigger es el último botón de la 1ª fila.
  const firstRow = page.locator("table tbody tr").first();
  await firstRow.locator("button").last().click();
  await page.waitForTimeout(700);
  await shot(page, "b-menu-fila-abierto");
  await page.keyboard.press("Escape").catch(() => {});
  await page.mouse.click(5, 5); // cerrar por click-afuera
  await page.waitForTimeout(500);

  // (c) panel de filtros abierto
  await page.getByRole("button", { name: /Filtros/i }).first().click();
  await page.waitForTimeout(800);
  await shot(page, "c-filtros-abierto");
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(500);

  // (d) emptyState vía búsqueda sin resultados (ejercita el input de filtros)
  const search = page.locator('input[type="text"], input[placeholder*="Buscar" i]').first();
  await search.fill("ZZZZ-NO-EXISTE-ZZZZ");
  await page.waitForTimeout(2000);
  await shot(page, "d-busqueda-vacia");

  // (e) TANDA 21 — filtro APLICADO. Se limpia la búsqueda primero para que el
  // estado sea el del filtro y no el arrastre de (d). Se elige "Ventas
  // Cerradas", que NO es la primera opción del grupo: el conteo de activos
  // ignora la primera por diseño, así que la primera no encendería el badge.
  await search.fill("");
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Filtros/i }).first().click();
  await page.waitForTimeout(800);
  await page.getByText(/Ventas Cerradas/i).first().click();
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, "e-filtro-aplicado");
});
