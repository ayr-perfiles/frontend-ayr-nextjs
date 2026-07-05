# Handoff — AYR Steel ERP (Siguiente Sesión)

> Subir SIEMPRE al inicio: este HANDOFF + CLAUDE.md (v6.20).
> Preferencias: Prompts Claude Code por defecto. Caveman mode. PASO 0 read-only en cada prompt.
> Preguntar ante duda de negocio. NUNCA cerrar en verde sin RUNTIME (lo corre el USUARIO, no Claude).
> npm run build LOCAL antes de merge a master. Un frente a la vez, confirmar cierre antes de seguir.
> backend en prod antes que master.

## ✅ Cerrado esta sesión — TC 3.75 fallback muerto + relabel kardex (v6.20)

- **CERRADO ESTA SESIÓN:** fallback TC 3.75 MUERTO (`/api/tipo-cambio` en fallback ya no emite `venta`/`compra` numérico; PurchaseCoilFromXml + BulkUpload dejan TC vacío + warning + submit guard USD compartido `isValidUsdExchangeRate` [2,7]).
- **CERRADO ESTA SESIÓN:** `/admin/kardex` mal rotulado como global → relabel "Kardex de Productos (Drywall)" + sidebar "Kardex productos" + breadcrumb, sin mover el item de nav ni tocar la query.
- ⚠️ **ATENCIÓN:** El push de master PENDIENTE de Giancarlo.

## ✅ Cerrado sesión previa — `reverseCoilSplit` (v6.19)

- `reverseCoilSplit` (callable + ui) EN PROD, runtime test verde. PurchaseCoilFromXml finish POR-FILA.

## 🔴 ARRANCAR PRÓXIMA SESIÓN — opciones (decidir al inicio)

1. **Fix KardexTab normalización** (type→signo/color). Chico, cierra deuda visual que afecta SCRAP/AJUSTE/SCRAP_REVERSAL (type ≠ "IN" sale rojo). Reco ALTA.
2. **Importación REAL de abril a PROD** (operación de curación §14, sesión dedicada, backup coils prod primero, pre-filtrar CSV, finishes a mano, líneas UNIDAD manual).
4. **Drenar writes** 7/8/9.
5. **Saneamiento infra test↔prod** (SUNAT solo test, Algolia solo prod, metadata codebase test rota).

- **MANTENER:** las reglas de oro (runtime lo corre el usuario; números crudos no conclusiones; npm run build local antes de merge; deploy por función específica leyendo el plan; PASO 0 read-only; un frente a la vez; backend en prod antes que master).
- **Recordatorio de disciplina:** contra PROD, revisar uid del ADMIN + guard de proyecto ANTES de correr el script.

## Deudas vivas (detalle en CLAUDE.md §11)

- **CERRADA v6.20 — /admin/kardex rotulado como global:** relabel honesto "Kardex de Productos (Drywall)" hecho (sidebar+header+breadcrumb). Selector global (products+coils) evaluado y descartado por ahora: 6 colecciones a mergear (no solo 2), selector actual es `<select>` plano sin búsqueda, y el caso de uso bobina ya está resuelto vía tab Movimientos (v6.17).
- **BACKLOG (diferido, no bug):** BulkUpload auto-suggest-on-load del TC (fetch automático por invoiceDate, paridad con PurchaseCoilFromXml) en vez de requerir click manual "Sugerir TC". Mejora opcional, no cierre de deuda.
- **BACKLOG (diferido):** mover el item "Kardex" de la sección "Administración" al `LineGroup` Drywall en el sidebar. Hacerlo en commit AISLADO (hay 2 fuentes de nav ligeramente desincronizadas — `sidebar.tsx` vs `navItems.ts` — evitar bundlear con otros cambios, riesgo de churn de nav ya visto en incidentes previos).
- **RESIDUAL MENOR v6.20:** runtime UI del fallback TC (PurchaseCoilFromXml: campo vacío + warning + submit bloqueado) NO se ojeó en browser (requiere login test-nube que Claude no tiene). Verificado sí: endpoint por curl (fallback sin número) + 32 unit tests + tsc + build. Guardas son aditivas y de bajo riesgo.
- **Nota:** el TC "3.5" visto antes en pruebas de BulkUpload era dato del Excel de prueba (columna "MONEDA TIPO DE CAMBIO"), NUNCA un default hardcodeado en código — confirmado por grep, no había nada que arreglar ahí.
- **strips_movements render de AJUSTE:** Revisar si tiene mismo bug binario que tenía el kardex (frente aparte).
- **kardex bobina 'Cantidad' siempre +1/-1:** Magnitud real = weightKg, no mostrada en la UI (mejora opcional en KardexTable compartido).
- **Fecha T12:00:00Z (mediodía UTC)** en single + bulk. Funciona Perú, frágil timezones.
- **registerCoil single SIN guards de fecha ni dimensiones** (el bulk sí). Bug latente. Portar guards.
- **Barrel muerto** src/components/purchases/BulkUploadCoils.tsx (re-export no montado).
- **ADMIN de test = demo@cliente.com** (uid 1e3aV7XEmvdLjMally7g1zQJ6Fu1, claim ADMIN real). Naming engañoso.
- **OPERATOR de test = operator@cliente.com** (uid e2you9u7IPX9CA6qIe2x9U4DjqD3, claim OPERATOR real). Usuario no-admin PERMANENTE de QA en test. No borrar.
- **Nota deuda divergencia test↔prod:** Índices divergentes, `coils(parentCoilId,status)` faltaba en test. Parte de saneamiento infra.

## Llaves coil_finishes VIVAS (test = prod, NO divergen)

GALV (0.00785), ALU-NATURAL (0.00785), ALU-AZUL/BLANCO/ROJO/VERDE/GRIS (0.008 c/u). ALU-GRIS SÍ existe.
TOKEN_TO_FINISH (parser→llave, solo preselección): GALV→GALV, NATURAL→ALU-NATURAL, AZUL→ALU-AZUL, etc.
El dropdown se puebla de coil_finishes VIVO (single source of truth).

## 🔴 DEUDA DE INFRAESTRUCTURA — divergencia test↔prod (sin resolver)

- SUNAT (comunicarBaja, emitirComprobante, validarCpeSunat, importSireRce, parsePurchaseXml, confirmPurchaseStaging, consultarRuc/Dni) SOLO en ayrsteel-test, NO en prod.
- Algolia (ext-firestore-algolia-search-*) SOLO en prod, NO en test.
- Metadata codebase roto en test: deploy --only functions:default propone BORRAR las 9 legacy/SUNAT.
- ⚠️ REGLA: deploy a test SIEMPRE por función específica (--only functions:NOMBRE --project ayrsteel-test). NUNCA --only functions:default. NUNCA --force.
- Sanear esto = deuda multi-sprint; riesgo de borrado accidental alto.

## Scripts locales (gitignored, en scripts/local/)

- `invoke_void_scrap_test.cjs` — invoca voidCoilScrap en test-nube.
- `invoke_bulk_test.cjs` — invoca registerCoilsBulk en test-nube.
- `read_finishes.cjs` — lee coil_finishes de un proyecto.
- `cleanup_test_coils.cjs` — BORRADO FÍSICO de coils de prueba en TEST por prefijo. NO existe variante prod.
- ⚠️ Scripts node NO cargan dotenv → van a nube directo vía serviceAccountKey. serviceAccountKey*.json gitignored.

## Convenciones clave (resto en CLAUDE.md)

Caveman. PASO 0 read-only. develop=fuente, master solo merges. Backend en prod ANTES que frontend a master.
npm run build LOCAL antes de merge. Runtime lo hace el USUARIO (Claude no tiene URL Vercel/login/navegador).
Runtime local: npm run dev con NEXT_PUBLIC_USE_EMULATOR="false" → apunta a TEST-nube (consola dice "☁️ TEST-nube").
Deploy a test/prod por función específica. densityFactor de coil_finishes lookup. Cliente solo metadata física.

## Suggested skills

tdd (deleteCoilDraft red-green), diagnose (si runtime prod falla), grill-me, handoff.

## Arranque

Decidir entre las opciones. Subir CLAUDE.md v6.20 + este HANDOFF.
