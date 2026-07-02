# Handoff — AYR Steel ERP (Siguiente Sesión)

> Subir SIEMPRE al inicio: este HANDOFF + CLAUDE.md (v6.14).
> Preferencias: Prompts Claude Code por defecto. Caveman mode. PASO 0 read-only en cada prompt.
> Preguntar ante duda de negocio. NUNCA cerrar en verde sin RUNTIME (lo corre el USUARIO, no Claude).
> npm run build LOCAL antes de merge a master. Un frente a la vez, confirmar cierre antes de seguir.

## ✅ Cerrado esta sesión — `deleteCoilDraft` (v6.14)

- **CERRADO ESTA SESIÓN:** `deleteCoilDraft` (callable + UI) EN PROD, runtime prod verde. Fix tsconfig functions-sunat (build local restaurado). `develop`=`master` synced (merge `cb9d11fc`).
- **ESTADO:** `deleteCoilDraft` cierra el caso "importé mal → anulé → re-importo". Abril DESBLOQUEADA.

## 🔴 ARRANCAR PRÓXIMA SESIÓN — opciones (decidir al inicio)

1. **`voidCoilScrap`** (recon+decisiones ya en CLAUDE.md §nuevo; arrancar PASO 0 del matiz timestamps P1(b) + molde `voidProductionFromCoils` + trazar UI de mermas). Reco media.
2. **Importación REAL de abril a PROD** (ahora desbloqueada; operación de curación §14, sesión dedicada, backup coils prod primero, pre-filtrar CSV, finishes a mano, líneas UNIDAD manual).
3. **`PurchaseCoilFromXml` finish por-fila** (deuda preexistente).
4. **Drenar writes** 7/8/9.
5. **Saneamiento infra test↔prod** (SUNAT solo test, Algolia solo prod, metadata codebase test rota).

- **MANTENER:** las reglas de oro (runtime lo corre el usuario; números crudos no conclusiones; npm run build local antes de merge; deploy por función específica leyendo el plan; PASO 0 read-only; un frente a la vez).
- **Recordatorio de disciplina (esta sesión):** contra PROD, revisar uid del ADMIN + guard de proyecto ANTES de correr el script, no correr directo. Esta vez los guards del script (proyecto==ayrsteel-2026 + prefijo TESTPROD-) aguantaron, pero es la última red antes de la BD real.


## Deudas vivas destapadas esta sesión (detalle en CLAUDE.md §11)

- **Fecha T12:00:00Z (mediodía UTC)** en single + bulk. Funciona Perú, frágil timezones. Artefacto, no decisión.
- **registerCoil single SIN guards de fecha ni dimensiones** (el bulk sí). Bug latente compartido. Portar guards.
- **migrateFinishDensityFactors + scripts backfill esperan naming MUERTO** (GALVANIZADO/NATURAL vs vivo
  GALV/ALU-NATURAL). Correrlos hoy crea basura o falla. Auditar/enterrar.
- **Barrel muerto** src/components/purchases/BulkUploadCoils.tsx (re-export no montado).
- **ADMIN de test = demo@cliente.com** (uid 1e3aV7XEmvdLjMally7g1zQJ6Fu1, claim ADMIN real). Naming engañoso.

## Llaves coil_finishes VIVAS (test = prod, confirmado leyendo Firestore, NO divergen)

GALV (0.00785), ALU-NATURAL (0.00785), ALU-AZUL/BLANCO/ROJO/VERDE/GRIS (0.008 c/u). ALU-GRIS SÍ existe.
TOKEN_TO_FINISH (parser→llave, solo preselección): GALV→GALV, NATURAL→ALU-NATURAL, AZUL→ALU-AZUL, etc.
El dropdown se puebla de coil_finishes VIVO (single source of truth), el token solo preselecciona.

## 🔴 DEUDA DE INFRAESTRUCTURA — divergencia test↔prod (sin resolver)

- SUNAT (comunicarBaja, emitirComprobante, validarCpeSunat, importSireRce, parsePurchaseXml,
  confirmPurchaseStaging, consultarRuc/Dni) SOLO en ayrsteel-test, NO en prod.
- Algolia (ext-firestore-algolia-search-\*) SOLO en prod, NO en test.
- Metadata codebase roto en test: deploy --only functions:default propone BORRAR las 9 legacy/SUNAT.
- ⚠️ REGLA: deploy a test SIEMPRE por función específica (--only functions:NOMBRE --project ayrsteel-test).
  NUNCA --only functions:default. NUNCA --force. (Aplicó igual a los deploys de registerCoilsBulk, sin incidente.)
- Sanear esto = deuda multi-sprint; riesgo de borrado accidental alto hasta resolver.

## Scripts locales (gitignored, en scripts/local/)

- invoke_bulk_test.cjs — invoca registerCoilsBulk vía idToken de ADMIN real de test (createCustomToken +
  signInWithCustomToken con web api key). Para runtime de callable sin UI.
- read_finishes.cjs — lee coil_finishes de un proyecto (admin SDK, read-only).
- cleanup_test_coils.cjs — BORRADO FÍSICO de coils de prueba en TEST por prefijo (guard "ELIMINAR",
  prefijo normalizado + longitud mín, batch chunked fresco). Solo test. NO existe variante prod (si se
  necesita, reforzar guards: hardcode ayrsteel-2026, prefijo TESTPROD obligatorio, frase larga de confirmación).
- ⚠️ Scripts node NO cargan dotenv → van a nube directo vía serviceAccountKey (por eso leen test/prod-nube
  aunque .env.local tenga EMULATOR_HOST). serviceAccountKey\*.json gitignored.

## Convenciones clave (resto en CLAUDE.md)

Caveman. PASO 0 read-only. develop=fuente, master solo merges. Backend en prod ANTES que frontend a master.
npm run build LOCAL antes de merge. Runtime lo hace el USUARIO (Claude no tiene URL Vercel/login/navegador).
Runtime local: npm run dev con NEXT_PUBLIC_USE_EMULATOR="false" → apunta a TEST-nube (consola dice "☁️ TEST-nube").
Deploy a test/prod por función específica. densityFactor de coil_finishes lookup. Cliente solo metadata física.
Dedup bulk por existencia de doc, ciego a VOIDED — INTENCIONAL, no cambiar. Value 2 dec. Peso [2000-7000].

## Suggested skills

tdd (deleteCoilDraft red-green), diagnose (si runtime prod falla), grill-me (stress-test deleteCoilDraft
guard cero-movimientos), handoff (cerrar próxima sesión).

## Arranque

Decidir entre las opciones. Si deleteCoilDraft: PASO 0 read-only de voidCoil (guard de movimientos a
espejar) + trazar qué cuenta como "movimiento" (producción/split/venta/consumo → grep consumidores del
coil). Si importación abril: backup coils prod primero, pre-filtrar CSV, sesión con calma. Subir CLAUDE.md
v6.13 + este HANDOFF.
