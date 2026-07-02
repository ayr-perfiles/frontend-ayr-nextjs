# Handoff — AYR Steel ERP (Siguiente Sesión)

> Subir SIEMPRE al inicio: este HANDOFF + CLAUDE.md (v6.15).
> Preferencias: Prompts Claude Code por defecto. Caveman mode. PASO 0 read-only en cada prompt.
> Preguntar ante duda de negocio. NUNCA cerrar en verde sin RUNTIME (lo corre el USUARIO, no Claude).
> npm run build LOCAL antes de merge a master. Un frente a la vez, confirmar cierre antes de seguir.
> backend en prod antes que master.

## ✅ Cerrado esta sesión — `voidCoilScrap` (v6.15)

- **CERRADO ESTA SESIÓN:** `voidCoilScrap` (callable + reporte) EN PROD, runtime test verde. Helper `determineCoilStatusAfterReversal`. Filtro `totalMermaSoles`. `develop`=`master` synced (merge `85387553`).
- **ESTADO:** `voidCoilScrap` resuelve en backend el reverso de mermas mal registradas.
- ⚠️ **ATENCIÓN:** El push de master PENDIENTE de Giancarlo (el merge 85387553 está local, pero falta `git push origin master`).

## 🔴 ARRANCAR PRÓXIMA SESIÓN — opciones (decidir al inicio)

1. **Fix KardexTab normalización** (type→signo/color). Chico, cierra deuda visual que afecta SCRAP/AJUSTE/SCRAP_REVERSAL (type ≠ "IN" sale rojo). Reco ALTA.
2. **Importación REAL de abril a PROD** (operación de curación §14, sesión dedicada, backup coils prod primero, pre-filtrar CSV, finishes a mano, líneas UNIDAD manual).
3. **`PurchaseCoilFromXml` finish por-fila** (deuda preexistente).
4. **Drenar writes** 7/8/9.
5. **Saneamiento infra test↔prod** (SUNAT solo test, Algolia solo prod, metadata codebase test rota).

- **MANTENER:** las reglas de oro (runtime lo corre el usuario; números crudos no conclusiones; npm run build local antes de merge; deploy por función específica leyendo el plan; PASO 0 read-only; un frente a la vez; backend en prod antes que master).
- **Recordatorio de disciplina:** contra PROD, revisar uid del ADMIN + guard de proyecto ANTES de correr el script.

## Deudas vivas (detalle en CLAUDE.md §11)

- **DEUDA KardexTab binario IN/OUT.**
- **Fecha T12:00:00Z (mediodía UTC)** en single + bulk. Funciona Perú, frágil timezones.
- **registerCoil single SIN guards de fecha ni dimensiones** (el bulk sí). Bug latente. Portar guards.
- **migrateFinishDensityFactors + scripts backfill esperan naming MUERTO** (GALVANIZADO/NATURAL vs vivo GALV/ALU-NATURAL).
- **Barrel muerto** src/components/purchases/BulkUploadCoils.tsx (re-export no montado).
- **ADMIN de test = demo@cliente.com** (uid 1e3aV7XEmvdLjMally7g1zQJ6Fu1, claim ADMIN real). Naming engañoso.
- **OPERATOR de test = operator@cliente.com** (uid e2you9u7IPX9CA6qIe2x9U4DjqD3, claim OPERATOR real). Usuario no-admin PERMANENTE de QA en test. No borrar.

## Llaves coil_finishes VIVAS (test = prod, NO divergen)

GALV (0.00785), ALU-NATURAL (0.00785), ALU-AZUL/BLANCO/ROJO/VERDE/GRIS (0.008 c/u). ALU-GRIS SÍ existe.
TOKEN_TO_FINISH (parser→llave, solo preselección): GALV→GALV, NATURAL→ALU-NATURAL, AZUL→ALU-AZUL, etc.
El dropdown se puebla de coil_finishes VIVO (single source of truth).

## 🔴 DEUDA DE INFRAESTRUCTURA — divergencia test↔prod (sin resolver)

- SUNAT (comunicarBaja, emitirComprobante, validarCpeSunat, importSireRce, parsePurchaseXml, confirmPurchaseStaging, consultarRuc/Dni) SOLO en ayrsteel-test, NO en prod.
- Algolia (ext-firestore-algolia-search-\*) SOLO en prod, NO en test.
- Metadata codebase roto en test: deploy --only functions:default propone BORRAR las 9 legacy/SUNAT.
- ⚠️ REGLA: deploy a test SIEMPRE por función específica (--only functions:NOMBRE --project ayrsteel-test). NUNCA --only functions:default. NUNCA --force.
- Sanear esto = deuda multi-sprint; riesgo de borrado accidental alto.

## Scripts locales (gitignored, en scripts/local/)

- `invoke_void_scrap_test.cjs` — invoca voidCoilScrap en test-nube.
- `invoke_bulk_test.cjs` — invoca registerCoilsBulk en test-nube.
- `read_finishes.cjs` — lee coil_finishes de un proyecto.
- `cleanup_test_coils.cjs` — BORRADO FÍSICO de coils de prueba en TEST por prefijo. NO existe variante prod.
- ⚠️ Scripts node NO cargan dotenv → van a nube directo vía serviceAccountKey. serviceAccountKey\*.json gitignored.

## Convenciones clave (resto en CLAUDE.md)

Caveman. PASO 0 read-only. develop=fuente, master solo merges. Backend en prod ANTES que frontend a master.
npm run build LOCAL antes de merge. Runtime lo hace el USUARIO (Claude no tiene URL Vercel/login/navegador).
Runtime local: npm run dev con NEXT_PUBLIC_USE_EMULATOR="false" → apunta a TEST-nube (consola dice "☁️ TEST-nube").
Deploy a test/prod por función específica. densityFactor de coil_finishes lookup. Cliente solo metadata física.

## Suggested skills

tdd (deleteCoilDraft red-green), diagnose (si runtime prod falla), grill-me, handoff.

## Arranque

Decidir entre las opciones. Subir CLAUDE.md v6.15 + este HANDOFF.
