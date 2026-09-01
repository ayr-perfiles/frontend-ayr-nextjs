/**
 * TANDA 19 — custodio visual del PILOTO de re-skin (`HeaderOptionsMenu`).
 *
 * Se eligió esa pieza porque tiene UN SOLO consumidor
 * (`admin/lines/metallic-roofing/catalog/page.tsx`, re-verificado en E3.1),
 * así que sirve para probar el MÉTODO de re-skin — conservar la API pública y
 * cambiar las tripas por primitivas del kit — sin arriesgar 22 pantallas.
 *
 * Captura la pantalla con el menú ABIERTO: sin abrirlo, el custodio no ve
 * justamente la pieza que se está cambiando.
 *
 * Corre por el proyecto `capture` (ver `playwright.config.ts`), nunca por
 * `npm run test:e2e`.
 */
import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const OUT_DIR = process.env.AYR_CAPTURE_OUT_DIR || "";
const URL = "/admin/lines/metallic-roofing/catalog";

test("piloto: HeaderOptionsMenu con el menu abierto", async ({ page }) => {
  if (!OUT_DIR) throw new Error("AYR_CAPTURE_OUT_DIR no seteado.");
  fs.mkdirSync(OUT_DIR, { recursive: true });

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("table, [class*='empty']", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1200);

  // Radio de medición extra: el radio computado, para poder atribuir un diff
  // a los tokens y no a "ruido" (la Tanda 18 se equivocó justamente en eso).
  const radii = await page.evaluate(() => {
    const pick = (sel: string) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).borderRadius : "n/a";
    };
    return { xl: pick(".rounded-xl"), lg: pick(".rounded-lg"), md: pick(".rounded-md") };
  });
  fs.writeFileSync(path.join(OUT_DIR, "radii.txt"), JSON.stringify(radii));

  // Abrir el menú: el trigger es el botón con el label por defecto "Opciones".
  await page.getByRole("button", { name: /Opciones/i }).first().click();
  await page.waitForTimeout(900); // deja terminar la animación de apertura

  const heightPx = await page.evaluate(() => document.documentElement.scrollHeight);
  fs.writeFileSync(path.join(OUT_DIR, "pilot.height.txt"), String(heightPx));
  await page.screenshot({ path: path.join(OUT_DIR, "pilot-menu-open.png"), fullPage: true });
});
