# Handoff — AYR Steel ERP (Siguiente Sesión)

> Subir SIEMPRE al inicio: este HANDOFF + CLAUDE.md (v6.42).
> Preferencias: Prompts Claude Code por defecto. Caveman mode. PASO 0 read-only en cada prompt.
> Preguntar ante duda de negocio. NUNCA cerrar en verde sin RUNTIME (lo corre el USUARIO, no Claude).
> npm run build LOCAL antes de merge a master. Un frente a la vez, confirmar cierre antes de seguir.
> backend en prod antes que master.

## DEUDAS
- **@types/jest/vi faltante** rompe tsc --noEmit en stockDisplayLogic.test.ts / finishService.test.ts / reportFunctions.test.ts (pre-existente, no A3). Frente chico de config.
- **getPeriodDates exportado** de reportFunctions.ts (para reuso en el hook A3).
- **Fuera-de-calibre en grupos multi-espesor REALES** (modo COLOR con ≥2 espesores): hoy se omite (thicknessMm='VARIOS' escapa el guard). Si se quiere flaggear, evaluar por-log antes de consolidar (booleano hasCalibreWarning). Diferido, no hay data que lo ejercite (todo 0.30).
- **Fallback de monto dispara con ===0:** una venta legítima de monto 0 (NC, muestra) se auto-corregiría a baseCost×qty+profit. Improbable en aluzinc, vigilar.
- **functions-sunat/package-lock.json** modificado externo, sin commitear (arrastrado toda la sesión).
- **isFulfilled se DESINCRONIZA** si se EDITA una cotización ya cumplida sin pasar por produce/void (el forward solo recalcula en produce/void). Forward-fix: recomputar isFulfilled on-edit. Mismo patrón que la deuda 'Editar Cotización desincroniza'.
- **Data de TEST sin backfill de isFulfilled** → badge test da 0 hasta que se produzca ahí. ACEPTADO (sandbox); paridad es de código/índice/functions, no de data de negocio.
- **DEUDA NUEVA:** test-prod.ts (gitignoreado) rompe el type-check del worker de Next cada vez que se toca — limpiar aparte (frente chico).
- **Nota proceso:** el ejecutor entregó resumen de tests, no los 16 nombres 1x1; se aceptó por conteo (15+1) + verificación manual por vuelta + runtime real. Reforzar 'pegar corrida con nombres' la próxima.
- **COB030ROJO:** PT en stock NEGATIVO en prod (-2,116.94 m / S/ -16,916.97). Corrupcion preexistente (no la introduce este merge; el fix inventario la MUESTRA en rojo, correcto). Backfill/ajuste manual pendiente — frente aparte.
- **Bobina REPRES-ALZ-AZUL-5002-028-2568-00041:** currentWeight -39.09, PROCESSED. Misma familia de corrupcion (bug multicorte). Excluida del stock, avisada en el reporte.
- **BOM (U+FEFF) en commits 271a2819 y 96017cff** (PowerShell Set-Content). Decision Opcion A: NO corregido (inofensivo, solo rompe matcheo estricto de conventional-commits). De e92c396c en adelante limpios.
- **functions-sunat/package-lock.json** con CRLF sin commitear (dejar asi).
- **MetallicProductionHistory.test.tsx** sin trackear — decidir si entra al repo.
- **Backups de prod sueltos en el working tree** (sales_full_prod_backup_*.json, backup_recon_*.json, scripts/ids_to_purge.json): gitignoreados pero AUN en disco dentro del repo — mover a ~/ayr-backups/ a mano (tarea del duenio).
- **guard avgCost>0 puede existir en inventarios de otras líneas — verificar/unificar:** (trading catalog L295, roofing catalog L342, roofing inventory L156/L166).
- **getProducedForQuoteLine:** indexa por SKU → duplica en `/production/new` y `SaleDetailsModal` (la cola ya lo resuelve).
- **BUG SOMBRA ROUTE_PERMISSIONS:** `/admin/lines` sombrea rutas OPERATOR (`Object.keys().find()`). Decisión: acceso actual OK (OPERATOR fuera) → fix = limpiar declaración muerta, NO reordenar.
- **production_log:** no graba perfil TR4/TR5.
- **SalesHistoryTable (perfil de cliente):** estado BINARIO, pinta VOIDED como "Cotización". El perfil de 3AAMSEQ aparenta S/357k cotizados con 2 anuladas.
- **fetchSales param customerDoc:** mismo bug de semántica, código muerto (0 callers).
- **reportFunctions.ts:381:** muestra documentNumber como "Doc" (vacío en ventas POS).
- **CustomersReportTab.tsx** huérfano.
- **La regla "sin costo → profit 0"** ya NO la garantiza el builder para quien pasa totales (consecuencia aceptada de separar forma/valor). Hoy funciona porque el POS no los pasa y el importador tiene guard propio.
- **Query legacy de crmService:** borrable post-backfill.
- **confirmQuotationForProduction** sin guard de rol interno (defensa = UI + isStaff, que incluye OPERATOR). Se cierra en Frente 2.
- **`(input as any).length = deleteField()`** escapa el tipado en ProductModal.
- **`crmService.ts:147`** (`getCustomerProfile`) + líneas `159`/`170` conservan el spread viejo `{id, ...data}` (id parásito posible) — NO se tocaron en el fix de mapeos defensivos de esta sesión.
- **`crmService.ts`/`kardexService.ts` sin tests propios** — se tocaron (fix de mapeo `id`) sin red de seguridad de tests.
- **guard isClosed solo client-side** en `consumeCoil`/`sendToCut` (hermético solo en `produceFromCoils`).
- **Importador de ventas sigue client-side directo** (`src/app/admin/sales/import/page.tsx`, `runTransaction`/`writeBatch` sin pasar por callable). Migra en WRITE 9 (`salesService`).
- **Menú de cotización importada** aún ofrece "Editar Cotización" y "Duplicar Operación" — editar desincroniza la percha (`COT-{documentNumber}`) de la boleta real ya facturada. Frente chico, mismo helper que `isImportedQuotation` (`src/core/import/salesImportLogic.ts:8`).
- **Forms de bobina duplicados huérfanos:** `src/components/forms/AddCoilForm.tsx`, `src/components/purchases/PurchaseCoilFromXml.tsx`, `src/components/inventory/EditCoilModal.tsx` — sin imports en todo el repo (confirmado por grep en la sesión combo UI #7+#8), solo mencionados en `ROADMAP.md`. Mismo patrón que el barrel muerto `BulkUploadCoils.tsx` ya documentado. No reciben los fixes #7/#8 (viven solo en las rutas LIVE bajo `src/core/coils/components/`). Limpieza aparte, frente chico.
- **Registro de bobina con VALOR 0 bloqueado por `coilEntryFormSchema` (`z.coerce.number().positive()`)** — verificado en la sesión combo UI, es comportamiento correcto (bloquea en submit con mensaje claro), no requiere fix, descartado de este frente.
- **DEUDA NUEVA — `cutOrderService.ts:172-175` doble-conversión de moneda:** `materialCostPEN = sentWeight * coil.pricePerKg; if (coil.metadata?.currency==='USD') materialCostPEN *= coil.metadata.exchangeRate;`. `coil.pricePerKg` YA está en PEN (Mundo A, confirmado en el recon de frente #1) — multiplicarlo otra vez por `exchangeRate` infla el costo de material ×TC para toda bobina USD que pase por una orden de corte, alimentando el WAC de `strips_stock`. **NO es teórica: `receiveStrips` (donde vive el bug) está importada y en uso real desde `ReceiveStripsModal.tsx`.** Prod hoy: **54 bobinas con `metadata.currency==='USD'`** (28 AVAILABLE, 20 IN_PROGRESS, 6 PROCESSED) — cualquiera de las 48 no-PROCESSED que pase por recepción de flejes dispara el bug. Documentado también (sin flaggear como bug) en `docs/05-formulas/costeo-drywall.md` F-D5. Arreglar ANTES de WRITE 8 (`cutOrder`, "el monstruo") — no meter el fix a mitad de ese frente, es un bug independiente y anterior.
- **DEUDA NUEVA — fetch de TC duplicado e inline:** `AddCoilForm.tsx` y `PurchaseCoilFromXml.tsx` siguen con su propio `useEffect`+`fetch('/api/tipo-cambio?fecha=...')` inline (con pequeñas diferencias de comportamiento entre ambos ante `fallback`). El frente #1 creó `src/core/coils/services/tipoCambio.ts` (`fetchTipoCambio`, con tests) para el modal de edición pero A PROPÓSITO no tocó los 2 forms de alta (para no re-testear el alta en ese frente). Frente chico: migrar ambos a `fetchTipoCambio` y unificar el comportamiento ante fallback.
- **DEUDA NUEVA — `request as any` en 4 tests nuevos de `coilManagement.integration.test.ts`:** mismo patrón que las 13 pruebas preexistentes del archivo (mock de `CallableRequest` incompleto). Micro-deuda, consistente con el resto del archivo, no aislada.

## PENDIENTE INMEDIATO
- **Combo UI #7+#8 CERRADO EN PROD** (develop 5fca6ed6 / master 2995e0b3). Spinner+wheel muerto y paste numérico sanitizado en Peso/Ancho/Espesor/Valor de los 3 forms LIVE de bobina (`AddCoilForm.tsx`, `PurchaseCoilFromXml.tsx`, `EditCoilModal.tsx`). Helper puro `src/core/coils/utils/numericInput.ts` con 8 tests Vitest (RED→GREEN documentado). Frontend-puro, sin backend/índice tocado.
- **Frente #1 (editar bobina USD→SOLES) CERRADO EN PROD** (master `d086344d`; callable `updateCoil` ya deployado a prod+test con paridad y smoke OK antes del merge). `updatePayload` ahora persiste `metadata.currency`/`exchangeRate`/`originalCurrencyValue` (antes los ignoraba en silencio pese a que el cliente ya los mandaba). Autofill de TC por fecha de factura en el modal de edición, disparado solo por acción de usuario (nunca en mount). `pricePerKg` recomputado con el helper canónico `coilPricing.ts` en los 3 puntos que lo tocan (Valor Total, toggle moneda, autofill). Detalle completo en CLAUDE.md v6.42.

## FIXEAR PENDIENTES (próximos frentes, sin recon hecho aún)
- **#2** Ver cotización (detalle a definir al iniciar el frente).
- **#3** Negativos → "rindió de más" (ojo: hay una trampa de corrupción real de datos detrás, no es solo UI — investigar antes de codear).
- **#4** Excel: mostrar peso real (no el declarado/teórico).
- **#9** Separar ventas de cotizaciones (hoy conviven en la misma vista/colección, confundibles).
- **#10** Separar bobinas (criterio de separación a definir al iniciar el frente).
- **A1/A2/fix reporte (Coherencia de costo)**: CERRADOS y en prod.
  - A1 write-back de costo forward operando.
  - A2 backfill ejecutado. Backup histórico: `~/ayr-backups/A2-20260811.json`.
  - Fix reporte aluzinc-resumen activo.
- **Pendientes no bloqueantes:** Runtime real del reporte de usuario final; fix A1.5 (void re-sync) gap conocido forward-fix.
- **A3 CERRADO EN PROD** (merge 58709805, hashes develop 6cb1c1d1 / master 58709805). Reporte aluzinc-detalle finalizado y documentado.
- **v6.40 CERRADO EN PROD:** Override peso anómalo + paréntesis operativo purga Mar/Abr/May finalizados.
- **PrintableTicket:** Frente chico CERRADO en prod (botón UI removido, componente preservado).
- **PRÓXIMO FRENTE (CANDIDATO):** Elegir del HORIZONTE (Slice 3, VENDEDOR, Reporte RAL).
## HORIZONTE (candidatos próximo frente)
- **Slice 3 DIFERIDO:** capa de costo variable/conversión.
- **Frente 2 rol VENDEDOR:** recon hecho (isStaff, ROUTE_PERMISSIONS único guard vivo, isRoleAllowed/mod.routes.roles son código muerto, sellerId en prod es NOMBRE no email → hace falta sellerUid forward-only, agregados scopeados).
- **Reporte por RAL** (frente aparte).
- **PT inflado** por producciones contra cotizaciones importadas (venta histórica no descuenta stock, producción sí suma) → ajuste manual al cerrar el período. Ver `docs/modules/ventas.md` §9.
- **forward-fix** `coilWeightConsumedKg` en `consumeCoil` (drywall, mata `approximateWeight` de logs nuevos).
- **WRITE 8 cutOrder** (monstruo prorrateo, modelo flejes real + lote-por-bobina).
- **WRITE 9 salesService**.
- **Drawer piezas/bobina en PLANCHA — forward-fix del writer:** `produceFromCoils` hoy graba `piecesCount`/`pieceLengthM` en `perCoilBreakdown` solo para COBERTURA. Plancha muestra '—' en esas 2 columnas. Si se quiere desglose en plancha, es cambio de backend + backfill opcional (frente aparte).

## PENDIENTES OPERATIVOS

- **Smoke check Algolia en prod:** `/admin/sales` con búsqueda de texto activa → verificar que las 3 tarjetas de dinero se ocultan y el pie de tabla queda coherente (mensaje "Totales no disponibles en búsqueda por texto"). Test (`ayrsteel-test`) no tiene Algolia, solo verificable en prod.

## ESTADO FRENTE B (Cola fase 2)
**CERRADO.** Fase 1 + Fase 2 isFulfilled terminados. (Commits 3f5adb2f, 0ea8eb85, 4b7a17de, fbfc5b1a).

## PENDIENTES DIFERIDOS
- Componente `PrintableTicket` (src/components/sales/) queda en repo sin importadores; cablear ruta `/admin/sales/[id]/print` si aparece use case POS térmico. Botón en UI removido el 2026-08-14.

## REGLAS GRABADAS (aprendidas)
- **Meta-nota de arranque de sesión:** primero `git fetch --all && git log origin/develop --since="1 day ago"` para detectar commits externos (GitHub Web u otro ejecutor) ANTES de codear. Aprendido cuando dos fixes idénticos (Update weight constants x2, fix Factura Desconocida) generaron trabajo duplicado + un force-push --force-with-lease.
- **Meta-nota de proceso:** Todo el código pasa por el ejecutor. GitHub Web ya NO se usa para tocar código directo (decisión del dueño 2026-08-14).
- **PARIDAD DE ENTORNOS:** ayrsteel-test y ayrsteel-2026 (prod) se mantienen A LA PAR siempre — índices Firestore, Cloud Functions, y ramas git (develop==master==origin). Todo deploy a prod (índice/función) o push se replica/verifica en test en la MISMA tanda. Verificar paridad al inicio de cada frente.
- **Scripts en Prod:** Todo script que lea/escriba prod imprime y ASSERTEA el projectId al arrancar (`if (projectId !== 'ayrsteel-2026') process.exit(1)`). Sin eso no corre.
- Ejecutor **PARA y espera OK** antes de tocar prod (no ejecutar-y-reportar).
- **NUNCA script que reimplemente callable** saltándose guards contra prod.
- **Guard laterSales NO se toca.**
- Verificar auth Antigravity a ambos proyectos al inicio.
- Sincronizar `develop` con `master` al arrancar.
- "compila/type-check" ≠ GREEN (los tests DEBEN correr con emulador).
- Densidad de `coil_finishes` **nunca** hardcodeada.
- **Deploy de Functions:** Usar el prefijo `functions:` explícito en todos los targets del `--only` para evitar omisiones silenciosas. Validar con `functions:list` post-deploy.
- **Lotes y Operaciones Destructivas:** Usar siempre un GATE entre lotes. Correr 1 lote, reportar, esperar OK. NUNCA correr de corrido.
- **Backups de purgas:** Hacer el backup fuera de workspace, y obligatoriamente probar restaurarlo en `test` mapeando `_id -> doc.id` antes de purgar en `prod`.
- **La colección `quotations` NO existe:** cotizaciones viven en `sales` con prefijo COT- en doc.id (dedup por existencia de doc). Consecuencia: recon de sales+quotations es una sola query filtrada por prefijo.
- **voidProductionFromCoils es fuego-y-olvido** con la cotización source: `if quoteSnap.exists` la protege — se puede voidear un log cuya cotización ya fue borrada sin fallar (solo pierde el reset de isFulfilled, que igual desaparece con el doc).
- **Timestamp de production_log = fecha del día**, no editable. Producciones contra cotizaciones con timestamp histórico quedan con fechas divergentes (venta Mar, log Ago). NO es bug, es UX.
- **Kardex es partida doble append-only** — ningún consumidor filtra por status/voided. Anulaciones se reflejan por movimientos compensatorios con `reference: logId`. Historial ruidoso pero contablemente correcto.
