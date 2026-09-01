/**
 * TANDA 11 — [E2E-HARNESS] · GATE DE ARRANQUE. Aplica `B22` (ver `e2e/envGuard.ts`).
 *
 * Corre UNA vez, ANTES de que exista un solo spec. Si cualquiera de las 3
 * guardas falla, tira — y Playwright no ejecuta ningún escenario, así que nada
 * se escribe contra el backend equivocado.
 *
 * ORDEN, declarado sin maquillar:
 *   (a) y (b) son ESTRICTAMENTE pre-autenticación: puro string y un GET por HTTP.
 *   (c) necesita tráfico real a Firestore para tener evidencia POSITIVA, y la
 *       app no habla con Firestore hasta que hay sesión. Por eso (c) se mide en
 *       un login de SONDA aislado, cuyo único efecto es LEER. Ese login ocurre
 *       después de (a) y (b) — es decir, jamás contra un host remoto ni contra
 *       un bundle apuntado a producción — y antes de que corra cualquier
 *       escenario. Se declara así en vez de fingir que las 3 son pre-auth.
 */
import { chromium, type FullConfig } from "@playwright/test";
import { runAllGuards, hasBackendEvidence, EXPECTED_PROJECT } from "./envGuard";

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL;

  // ── (a) HOST ── puro string, antes de abrir un browser ─────────────────────
  const a = runAllGuards({ baseURL, bundleText: EXPECTED_PROJECT, requestUrls: [] });
  // `a` puede fallar por (b)/(c) con estos placeholders; solo nos importa (a) acá.
  if (!a.ok && a.reason.startsWith("[B22-a")) throw new Error(`B22 ABORTA — ${a.reason}`);

  const user = process.env.AYR_TEST_USER;
  const pass = process.env.AYR_TEST_PASS;
  if (!user || !pass) {
    throw new Error(
      "B22 ABORTA — faltan credenciales. Se esperan AYR_TEST_USER y AYR_TEST_PASS " +
        "(cargadas desde ~/ayr-scratch/.env.test por playwright.config.ts).",
    );
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const requestUrls: string[] = [];
  page.on("request", (r) => requestUrls.push(r.url()));

  try {
    await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });

    // ── (b) PROJECT ID ── grep del chunk JS realmente SERVIDO ────────────────
    // Mismo mecanismo de la capa 1 de T6 (v6.79.0): se lee lo que el dev server
    // entrega por HTTP, no lo que dice `.env.local`.
    const scriptUrls = await page.$$eval("script[src]", (els) =>
      els.map((e) => (e as HTMLScriptElement).src),
    );
    let bundleText = "";
    for (const src of scriptUrls) {
      const res = await page.request.get(src);
      if (res.ok()) bundleText += await res.text();
    }

    const b = runAllGuards({ baseURL, bundleText, requestUrls: [] });
    if (!b.ok && b.reason.startsWith("[B22-b")) throw new Error(`B22 ABORTA — ${b.reason}`);

    // ── login de SONDA (solo lee) ────────────────────────────────────────────
    await page.fill('input[type="email"]', user);
    await page.fill('input[type="password"]', pass);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 45_000 });

    // ── esperar EVIDENCIA de tráfico, no un estado de red ────────────────────
    // `networkidle` NO sirve en esta app: el canal `Listen` de Firestore es
    // long-polling y la red nunca queda idle (medido: `page.goto` con
    // `networkidle` sobre el importador expira a los 30s). Y evaluar (c) apenas
    // aterriza en /admin da un falso aborto: los primeros ~40 requests son el
    // bundle y `identitytoolkit`, Firestore recién aparece después (medido con
    // sonda: 0 hits en los primeros 40, 36 hits al esperar el dashboard).
    //
    // Se espera el HECHO que (c) necesita — al menos un request al backend —
    // en vez de un proxy de "ya cargó".
    const deadline = Date.now() + 60_000;
    while (!hasBackendEvidence(requestUrls) && Date.now() < deadline) {
      await page.waitForTimeout(500);
    }

    // ── (c) BACKEND EFECTIVO ── sobre el tráfico REAL ────────────────────────
    const c = runAllGuards({ baseURL, bundleText, requestUrls });
    if (!c.ok) throw new Error(`B22 ABORTA — ${c.reason}`);

    // Sesión reutilizable por los specs (evita 6 logins).
    //
    // `indexedDB: true` NO es opcional acá: Firebase Auth persiste la sesión en
    // IndexedDB, no en cookies ni en localStorage. Sin esa opción el
    // `storageState` sale vacío de sesión y los specs aterrizan en `/login` —
    // medido: la 1ª corrida de los 6 escenarios murió con
    // `locator('input[type="file"]') not found` y el snapshot de la página
    // mostrando el formulario de login, no el importador.
    await ctx.storageState({
      path: process.env.AYR_E2E_AUTH_STATE as string,
      indexedDB: true,
    });

    const firestoreHits = requestUrls.filter((u) => u.includes(EXPECTED_PROJECT)).length;
    console.log(
      `[B22] VERDE — host=localhost · projectId=${EXPECTED_PROJECT} en el bundle servido · ` +
        `${firestoreHits} request(s) al backend de ${EXPECTED_PROJECT} · 0 a producción · 0 al emulador.`,
    );
  } finally {
    await browser.close();
  }
}
