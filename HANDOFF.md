# Handoff — AYR Steel ERP (Siguiente Sesión)

> Subir SIEMPRE al inicio: este HANDOFF + CLAUDE.md (v6.29).
> Preferencias: Prompts Claude Code por defecto. Caveman mode. PASO 0 read-only en cada prompt.
> Preguntar ante duda de negocio. NUNCA cerrar en verde sin RUNTIME (lo corre el USUARIO, no Claude).
> npm run build LOCAL antes de merge a master. Un frente a la vez, confirmar cierre antes de seguir.
> backend en prod antes que master.

## DEUDAS
- **guard avgCost>0 puede existir en inventarios de otras líneas — verificar/unificar:** (trading catalog L295, roofing catalog L342, roofing inventory L156/L166).
- **getProducedForQuoteLine:** indexa por SKU → duplica en `/production/new` y `SaleDetailsModal` (la cola ya lo resuelve).
- **BUG SOMBRA ROUTE_PERMISSIONS:** `/admin/lines` sombrea rutas OPERATOR (`Object.keys().find()`). Decisión: acceso actual OK (OPERATOR fuera) → fix = limpiar declaración muerta, NO reordenar.
- **production_log:** no graba perfil TR4/TR5.
- **SalesHistoryTable (perfil de cliente):** estado BINARIO, pinta VOIDED como "Cotización". El perfil de 3AAMSEQ aparenta S/357k cotizados con 2 anuladas.
- **PrintableTicket HUÉRFANO** (cero importadores) + botón "Imprimir Ticket" en `/admin/sales:201` abre `/admin/sales/{id}/print` → ruta INEXISTENTE → 404 en prod. El fix de RUC que se le hizo está sin ejercitar.
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

## PENDIENTE INMEDIATO
- **Fix inventario metallic** (`d56f9a9c` en develop): pendiente merge a master y validación runtime del usuario (prod aún muestra COB030ROJO S/7.86 hasta mergear).
- **Validar runtime prod del merge e67b29d:** (acabados 9 chips + importador accordion/banner).
- **(CERRADOS Y MERGEADOS 29-jul):** Drawer de detalle por bobina metallic, Fix chip cotización drawer, Inventario bobinas (InventoryTable, nueva col 'Fecha Factura'), Prefill bobinas /production/new, MetallicProductionHistory.

## HORIZONTE (candidatos próximo frente)
- **Slice 2 (reporte costeo) primero:** reporte de costeo read-only (group-WAC + margen por tipo/color/espesor).
- **Slice 3 DIFERIDO:** capa de costo variable/conversión.
- **Frente 2 rol VENDEDOR:** recon hecho (isStaff, ROUTE_PERMISSIONS único guard vivo, isRoleAllowed/mod.routes.roles son código muerto, sellerId en prod es NOMBRE no email → hace falta sellerUid forward-only, agregados scopeados).
- **Reporte por RAL** (frente aparte).
- **PT inflado** por producciones contra cotizaciones importadas (venta histórica no descuenta stock, producción sí suma) → ajuste manual al cerrar el período. Ver `docs/modules/ventas.md` §9.
- **Reporte supervisor bobinas** (agrupado Abiertas/Stock/Cerradas, peso+metraje por grupo — ver foto usuario).
- **forward-fix** `coilWeightConsumedKg` en `consumeCoil` (drywall, mata `approximateWeight` de logs nuevos).
- **WRITE 8 cutOrder** (monstruo prorrateo, modelo flejes real + lote-por-bobina).
- **WRITE 9 salesService**.
- **Drawer piezas/bobina en PLANCHA — forward-fix del writer:** `produceFromCoils` hoy graba `piecesCount`/`pieceLengthM` en `perCoilBreakdown` solo para COBERTURA. Plancha muestra '—' en esas 2 columnas. Si se quiere desglose en plancha, es cambio de backend + backfill opcional (frente aparte).

## PENDIENTES OPERATIVOS
- **Smoke check Algolia en prod:** `/admin/sales` con búsqueda de texto activa → verificar que las 3 tarjetas de dinero se ocultan y el pie de tabla queda coherente (mensaje "Totales no disponibles en búsqueda por texto"). Test (`ayrsteel-test`) no tiene Algolia, solo verificable en prod.

## REGLAS GRABADAS (aprendidas)
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
