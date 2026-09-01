/**
 * TANDA 11 — [E2E-HARNESS] · los 6 escenarios del importador de ventas.
 * Fila de COLA `#6`. Corre con `npm run test:e2e`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DOBLE ASSERT, Y EL DE FIRESTORE MANDA
 * ─────────────────────────────────────────────────────────────────────────────
 * El modal es la AFIRMACIÓN de la UI, no la prueba de que la transacción hizo
 * algo. Cada escenario mide las dos cosas y, si discrepan, gana Firestore y se
 * reporta como HALLAZGO.
 *
 * `B16` — el mensaje de aborto NO se transcribe. Es un template literal con el
 * id de percha interpolado (medido: 184 chars, `é`=233 en idx 151), así que el
 * esperado se OBTIENE DEL FUENTE en tiempo de corrida (`./abortMessage`). Cero
 * transcripción, ni de este archivo ni de ningún doc. Ver ese módulo para por
 * qué se lee el fuente en vez de importar la clase.
 *
 * `D5` — todo doc lleva serie dedicada `E2E1-*` y muere en el teardown de su
 * propia corrida. El harness nunca lee ni borra un doc que no creó él.
 */
import { test, expect } from "@playwright/test";
import * as path from "path";
import { execFileSync } from "child_process";
import { createRequire } from "module";
import { mensajeDeAborto } from "./abortMessage";

const SCRATCH = process.env.AYR_E2E_SCRATCH as string;
const XLSX_DIR = path.join(SCRATCH, "xlsx");

// `createRequire`: Playwright carga los specs como ESM, donde `require` no
// existe (medido: `ReferenceError: require is not defined in ES module scope`).
// `dump.cjs` vive FUERA del repo (D4) y usa `firebase-admin`, así que se carga
// por ruta absoluta y no como dependencia del harness.
const requireCjs = createRequire(import.meta.url);
const dump = requireCjs(path.join(SCRATCH, "dump.cjs"));

/** Corre un script de scratch (seed/teardown) y devuelve su stdout. */
function runScratch(script: string, ...args: string[]): string {
  return execFileSync("node", [path.join(SCRATCH, script), ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

/** Los 5 contadores del modal, leídos de las tarjetas reales. */
type Stats = { total: number; imported: number; replaced: number; skipped: number; errors: number };

/**
 * Sube un .xlsx, procesa, y devuelve lo que la UI AFIRMA.
 * Los labels salen de `import/page.tsx` (Total/Importadas/Reimportadas/
 * Omitidas/Errores) y el estado del union `ImportStatus`, medidos — no supuestos.
 */
async function importar(page: import("@playwright/test").Page, escenario: string) {
  // `domcontentloaded`, NO `networkidle`: el canal `Listen` de Firestore es
  // long-polling y la red nunca queda idle — medido, `networkidle` expira.
  await page.goto("/admin/sales/import", { waitUntil: "domcontentloaded" });

  // Guarda de SESIÓN. Sin esto, una sesión no restaurada se manifiesta como un
  // timeout opaco de locator (medido: `input[type="file"] not found`) cuando la
  // causa real es que el `AuthGuard` redirigió a `/login`. Un harness tiene que
  // nombrar por qué falló, no dejar el diagnóstico para el screenshot.
  await expect(
    page,
    "la sesión no se restauró: el AuthGuard redirigió a /login. Revisá el storageState del globalSetup (Firebase Auth persiste en IndexedDB).",
  ).not.toHaveURL(/\/login/, { timeout: 30_000 });

  // El catálogo se carga al montar (10 `getDocs` en paralelo) y sin él
  // `handleFileUpload` corta con un toast. Se espera el hecho, no un timeout.
  await expect(page.locator('input[type="file"]')).toBeAttached({ timeout: 60_000 });
  await page.waitForTimeout(8_000); // margen para que `fetchReferences` resuelva
  await page.setInputFiles('input[type="file"]', path.join(XLSX_DIR, `${escenario}.xlsx`));

  const procesar = page.getByRole("button", { name: /Procesar Todo/i });
  await expect(procesar).toBeEnabled({ timeout: 60_000 });
  await procesar.click();

  const modal = page.getByRole("heading", { name: /Resultado de Importación/i });
  await expect(modal).toBeVisible({ timeout: 90_000 });

  // Cada tarjeta es `<div><p>LABEL</p><p>N</p></div>`. Se ancla en el `<p>` del
  // label y se lee su HERMANO siguiente — un filtro por `hasText` sobre el div
  // matchea también los contenedores anidados y devuelve `NaN` (medido).
  // Ninguna cabecera de la tabla del modal se llama como estos labels
  // (verificado: Doc. Número / Tipo / Estado / Motivo / Peso (KG) / Monto (S/)),
  // así que `exact: true` no puede colisionar.
  const num = async (label: string) => {
    const valor = page
      .getByText(label, { exact: true })
      .last()
      .locator("xpath=following-sibling::p[1]");
    const txt = (await valor.innerText()).trim();
    const n = Number(txt);
    if (!Number.isFinite(n)) {
      throw new Error(
        `[E2E-HARNESS] la tarjeta "${label}" no devolvió un número: ${JSON.stringify(txt)}`,
      );
    }
    return n;
  };

  const stats: Stats = {
    total: await num("Total"),
    imported: await num("Importadas"),
    replaced: await num("Reimportadas"),
    skipped: await num("Omitidas"),
    errors: await num("Errores"),
  };

  const filas = await page.locator("tbody tr").allInnerTexts();
  return { stats, filas };
}

test.describe.configure({ mode: "serial" });

test.describe("[E2E-HARNESS] importador de ventas — 6 escenarios", () => {
  test.beforeAll(() => {
    // Idempotencia: se limpia ANTES y DESPUÉS. Una corrida previa muerta a mitad
    // no puede contaminar ésta.
    runScratch("teardown.cjs");
    runScratch("seed.cjs");
  });

  test.afterAll(() => {
    runScratch("teardown.cjs");
  });

  // ── E-A ────────────────────────────────────────────────────────────────────
  test("E-A · percha COT-* en CANCELLED -> ERROR y CERO escritura", async ({ page }) => {
    const antes = await dump.snapshot("E2E1-1001");

    const { stats, filas } = await importar(page, "E-A");

    // (1) assert de UI
    expect(stats, `filas: ${filas.join(" || ")}`).toEqual({ total: 1, imported: 0, replaced: 0, skipped: 0, errors: 1 });
    // B16: el esperado se LEE del fuente, no se transcribe.
    expect(filas.join("\n")).toContain(mensajeDeAborto("COT-E2E1-1001", "CANCELLED"));

    // (2) assert de Firestore — MANDA
    const despues = await dump.snapshot("E2E1-1001");
    expect(despues.sale.exists).toBe(false); // no se creó la venta
    expect(despues.quote.status).toBe("CANCELLED"); // la percha no se tocó
    expect(despues.quoteHistory.size).toBe(0); // no se archivó nada
    expect(despues.stock).toEqual(antes.stock); // stock intacto
    expect(despues.movements).toEqual(antes.movements); // cero movimientos
  });

  // ── E-B ────────────────────────────────────────────────────────────────────
  test("E-B · venta ya existente COMPLETED -> omitida, sin tocar nada", async ({ page }) => {
    const antes = await dump.snapshot("E2E1-1002");
    expect(antes.sale.status).toBe("COMPLETED"); // precondición del escenario

    const { stats, filas } = await importar(page, "E-B");

    // Estado y motivo MEDIDOS, no asumidos (P4: no están en ningún doc).
    expect(stats, `filas: ${filas.join(" || ")}`).toEqual({ total: 1, imported: 0, replaced: 0, skipped: 1, errors: 0 });
    expect(filas.join("\n")).toContain("SKIPPED_ACTIVE");
    expect(filas.join("\n")).toContain("Omitida: ya existe activa");

    // Esta rama sale ANTES del bloque de percha: nada de percha debe aparecer.
    const despues = await dump.snapshot("E2E1-1002");
    expect(despues.sale.status).toBe("COMPLETED");
    expect(despues.quote.exists).toBe(false);
    expect(despues.stock).toEqual(antes.stock);
    expect(despues.movements).toEqual(antes.movements);
  });

  // ── E-C ────────────────────────────────────────────────────────────────────
  test("E-C · comprobante inexistente -> IMPORTED con escritura efectiva", async ({ page }) => {
    const antes = await dump.snapshot("E2E1-1003");
    expect(antes.sale.exists).toBe(false);
    expect(antes.quote.exists).toBe(false);

    const { stats, filas } = await importar(page, "E-C");

    expect(stats, `filas: ${filas.join(" || ")}`).toEqual({ total: 1, imported: 1, replaced: 0, skipped: 0, errors: 0 });
    expect(filas.join("\n")).toContain("IMPORTED");

    // La escritura tiene que ser REAL, no solo afirmada por el modal.
    const despues = await dump.snapshot("E2E1-1003");
    expect(despues.sale.exists).toBe(true);
    expect(despues.sale.status).toBe("COMPLETED");
    expect(despues.quote.exists).toBe(true); // percha COT-* creada (ítem metallic + FACTURA)
    expect(despues.quote.status).toBe("QUOTATION");
    expect(despues.movements.size).toBeGreaterThan(antes.movements.size);
  });

  // ── E-D ────────────────────────────────────────────────────────────────────
  test("E-D · E-A dos veces -> resultado idéntico, sin efecto acumulado", async ({ page }) => {
    const antes = await dump.snapshot("E2E1-1001");

    const r1 = await importar(page, "E-D");
    const medio = await dump.snapshot("E2E1-1001");
    const r2 = await importar(page, "E-D");
    const despues = await dump.snapshot("E2E1-1001");

    // Mismo veredicto las dos veces.
    expect(r1.stats).toEqual({ total: 1, imported: 0, replaced: 0, skipped: 0, errors: 1 });
    expect(r2.stats).toEqual(r1.stats);

    // Y sobre todo: CERO efecto acumulado entre corridas.
    expect(medio).toEqual(antes);
    expect(despues).toEqual(antes);
  });

  // ── E-E ────────────────────────────────────────────────────────────────────
  test("E-E · percha COT-* con producción ACTIVA -> ERROR y CERO escritura", async ({ page }) => {
    // Mismo motivo que E-F: la precondición se siembra justo antes de usarla.
    // Acá el guard tira antes de escribir, así que hoy no cambiaría el
    // resultado — se hace igual para que los dos escenarios de percha tengan la
    // misma forma y ninguno dependa del orden en que corran.
    runScratch("seed.cjs", "E");

    const antes = await dump.snapshot("E2E1-1005");
    expect(antes.quote.status).toBe("QUOTATION"); // precondición: NO es el caso CANCELLED

    const { stats, filas } = await importar(page, "E-E");

    expect(stats, `filas: ${filas.join(" || ")}`).toEqual({ total: 1, imported: 0, replaced: 0, skipped: 0, errors: 1 });
    // La OTRA rama del OR del guard. Hasta hoy sin ninguna evidencia de runtime.
    expect(filas.join("\n")).toContain(mensajeDeAborto("COT-E2E1-1005", "ACTIVE_PRODUCTION"));

    const despues = await dump.snapshot("E2E1-1005");
    expect(despues.sale.exists).toBe(false);
    expect(despues.quote.status).toBe("QUOTATION");
    expect(despues.quoteHistory.size).toBe(0);
    expect(despues.stock).toEqual(antes.stock);
    expect(despues.movements).toEqual(antes.movements);
  });

  // ── E-F ────────────────────────────────────────────────────────────────────
  // P5: esto NO es cobertura nueva de la transacción — `salesImportPerchaArchive
  // .integration.test.ts:140-154` ya assertea history/archivedReason/audit contra
  // la función REAL. Lo que agrega es la capa de UI/runtime sobre esa cobertura.
  test("E-F · percha QUOTATION sin producción -> IMPORTED y la percha se ARCHIVA", async ({
    page,
  }) => {
    // Precondición sembrada ACÁ, no en el `beforeAll`: E-C importa y CREA el doc
    // de stock del SKU, y `parseImportRows` resuelve `baseCost` desde ese stock
    // VIVO — así que una percha sembrada antes de E-C queda con `items` que ya
    // no coinciden con los que E-F escribe, y `firestore.rules:102` rechaza el
    // update por `fieldsUnchanged`. Medido: E-F pasa AISLADO y falla DENTRO de
    // la suite, con el mismo código. Ver el comentario largo en `seed.cjs`.
    runScratch("seed.cjs", "F");

    const antes = await dump.snapshot("E2E1-1006");
    expect(antes.quote.status).toBe("QUOTATION");
    expect(antes.quoteHistory.size).toBe(0);
    expect(antes.sale.exists).toBe(false);

    const { stats, filas } = await importar(page, "E-F");

    expect(stats, `filas: ${filas.join(" || ")}`).toEqual({ total: 1, imported: 1, replaced: 0, skipped: 0, errors: 0 });
    expect(filas.join("\n")).toContain("IMPORTED");

    // El camino completo percha -> venta, el único que lo ejercita entero.
    const despues = await dump.snapshot("E2E1-1006");
    expect(despues.sale.exists).toBe(true);
    expect(despues.sale.status).toBe("COMPLETED");
    expect(despues.quote.exists).toBe(true); // pisada por la percha nueva
    expect(despues.quoteHistory.size).toBe(1); // la vieja quedó archivada

    // El audit de reemplazo. Se ancla en `documentNumber` (leído del fuente,
    // `runSaleImportTransaction.ts:214`) — buscarlo por `entityId` devuelve solo
    // los `SALE_CREATED` del trigger `onSaleCreated` y el assert falla por la
    // clave equivocada, no porque el importador no lo haya escrito (medido).
    // `audit_logs` es APPEND-ONLY por regla de la casa: el teardown no los borra
    // (precedente T6, v6.79.0), así que se acumulan los `QUOTATION_REPLACED` de
    // TODAS las corridas previas. Buscar "el primero" toma uno viejo y el assert
    // pasa —o falla— por la razón equivocada (medido: `historyPath` apuntando a
    // un doc de history de otra corrida). Se exige el que apunta al history de
    // ESTA corrida: eso sí prueba que la escritura ocurrió ahora.
    const historyId = despues.quoteHistory.docs[0].id;
    const audit = await dump.auditFor("E2E1-1006");
    const reemplazo = audit.find(
      (a: { action: string; historyPath: string | null }) =>
        a.action === "QUOTATION_REPLACED" && a.historyPath?.includes(historyId),
    );
    expect(
      reemplazo,
      `ningún QUOTATION_REPLACED apunta al history de esta corrida (${historyId}). Audit visto: ${JSON.stringify(audit)}`,
    ).toBeDefined();
    expect(reemplazo.previousStatus).toBe("QUOTATION");
  });
});
