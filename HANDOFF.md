# Handoff — AYR Steel ERP (Siguiente Sesión)

> Subir SIEMPRE al inicio: este HANDOFF + CLAUDE.md (v6.13).
> Preferencias: Prompts Claude Code por defecto. Caveman mode. PASO 0 read-only en cada prompt.
> Preguntar ante duda de negocio. NUNCA cerrar en verde sin RUNTIME (lo corre el USUARIO, no Claude).
> npm run build LOCAL antes de merge a master. Un frente a la vez, confirmar cierre antes de seguir.

## ✅ Cerrado esta sesión — WRITE 6 mini-ciclo 2 (`registerCoilsBulk`)

Bulk de alta masiva de bobinas, completo y desplegado. Detalle en CLAUDE.md §9 (HECHO v6.13) y §10.

- **Backend** `registerCoilsBulk` (coilBulkRegistration.ts): atómico por factura, fallo parcial tolerado,
  dedup por existencia (ciego a VOIDED), guards finish/TC[2,7]/fecha/dimensiones>0, reporte por factura,
  audit REGISTER_COIL_BULK. 12 tests int. ACTIVE en prod Y test.
- **Lógica pura:** parseCoilDescription (14 tests, token semántico) + bulkUploadLogic (32 tests:
  validateCoilRow, buildInvoicesPayload, parseWeightToKg, guard peso [2000-7000], value 2 dec).
- **UI:** BulkUploadCoils reescrito thin-client en página dedicada /admin/coils/bulk-import (no modal).
  Preview editable, dropdown finish vivo, peso kg editable, sugerir-TC (api tipo-cambio). Botón→href.
  Modal viejo extirpado. Breadcrumb registrado.
- **Config:** NEXT_PUBLIC_USE_EMULATOR opt-out (default emulador). testTimeout 15s. scripts/local/ gitignored.
- Commits en master: backend 31236045, lógica 38fe1df6, UI 2cac4082, infra 79ed7be2. develop=master synced.

## 🔴 CRÍTICO — Runtime PROD NO ejercitado

Validado a FONDO en test-nube (doc E001-6498-01 verificado: pricePerKg cuadra, TON→kg, value 2 dec).
Callable ACTIVE en prod, UI en master (Vercel). PERO **la UI en prod NO se ejercitó end-to-end con un
envío real**. La primera corrida prod = la importación de abril (abajo). NO asumir prod probado.

## 🔴 ARRANCAR PRÓXIMA SESIÓN — opciones (decidir al inicio)

Reco: **1 o 2 primero** (nacen de necesidad real, desbloquean operación), luego drenar writes.

1. **`deleteCoilDraft` (WRITE nuevo, reco alta):** borrado FÍSICO de bobina SOLO si cero movimientos
   (sin producción/split/venta/consumo). Resuelve "importé mal → anulé (VOIDED) → quiero re-importar
   pero el dedup me bloquea porque el doc existe". Distingue borrador inerte (borrable, libera ID) de
   bobina con efecto contable (solo VOIDED). Guard cero-movimientos estilo voidCoil. NO tocar dedup del
   bulk (bloquear VOIDED es correcto). Nació en runtime de esta sesión — el usuario chocó con esto.

2. **Importación REAL de abril a PROD (operación, NO código):** ver CLAUDE.md §14. Es curación fila por
   fila, NO un clic. Realidades: pre-filtrar CSV a coil-only; filas TREAM sin color → elegir finish a
   mano; filas JAVISAC en UNIDAD = líneas agrupadas (varias bobinas/línea) → fuera del bulk 1:1, desglose
   manual. Backup coils prod antes. Es también el runtime prod pendiente. Hacer con calma, sesión dedicada.

3. **`PurchaseCoilFromXml` finish por-fila:** hoy select global por factura (mismo acabado a todas,
   ignora colores mixtos). Fix a por-fila como BulkUpload. Deuda preexistente, no urgente.

4. **Drenar writes:** WRITE 7 (voidProductionFromCoils costo congelado), WRITE 8 (cutOrder monstruo
   WAC/prorrateo, 5 fns), WRITE 9 (salesService, desbloquea 3 tests salesReimport skipped).

5. **Saneamiento infra test↔prod** (deuda multi-sprint): SUNAT solo test, Algolia solo prod, voidCoil
   viejo en test, metadata codebase test rota. Riesgo de borrado accidental alto hasta resolver.

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
