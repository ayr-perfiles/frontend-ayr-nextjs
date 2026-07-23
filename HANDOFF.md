# Handoff — AYR Steel ERP (Siguiente Sesión)

> Subir SIEMPRE al inicio: este HANDOFF + CLAUDE.md (v6.24).
> Preferencias: Prompts Claude Code por defecto. Caveman mode. PASO 0 read-only en cada prompt.
> Preguntar ante duda de negocio. NUNCA cerrar en verde sin RUNTIME (lo corre el USUARIO, no Claude).
> npm run build LOCAL antes de merge a master. Un frente a la vez, confirmar cierre antes de seguir.
> backend en prod antes que master.

## DEUDAS
- **guard isClosed solo client-side** en `consumeCoil`/`sendToCut` (hermético solo en `produceFromCoils`).
- 4 preexistentes probados: sunat×2, coilRegistration requestId, metallic hard-gate v6.22.
- **Importador de ventas sigue client-side directo** (`src/app/admin/sales/import/page.tsx`, `runTransaction`/`writeBatch` sin pasar por callable). Migra en WRITE 9 (`salesService`).
- **Menú de cotización importada** aún ofrece "Editar Cotización" y "Duplicar Operación" — editar desincroniza la percha (`COT-{documentNumber}`) de la boleta real ya facturada. Frente chico, mismo helper que `isImportedQuotation` (`src/core/import/salesImportLogic.ts:8`).
- **`crmService.ts:147`** (`getCustomerProfile`) + líneas `159`/`170` conservan el spread viejo `{id, ...data}` (id parásito posible) — NO se tocaron en el fix de mapeos defensivos de esta sesión.
- **`crmService.ts`/`kardexService.ts` sin tests propios** — se tocaron (fix de mapeo `id`) sin red de seguridad de tests.
- **PT inflado** por producciones contra cotizaciones importadas (venta histórica no descuenta stock, producción sí suma) → ajuste manual al cerrar el período. Ver `docs/modules/ventas.md` §9.

## HORIZONTE (candidatos próximo frente)
- **Reporte supervisor bobinas** (agrupado Abiertas/Stock/Cerradas, peso+metraje por grupo — ver foto usuario).
- **forward-fix** `coilWeightConsumedKg` en `consumeCoil` (drywall, mata `approximateWeight` de logs nuevos).
- **WRITE 8 cutOrder** (monstruo prorrateo, modelo flejes real + lote-por-bobina).
- **WRITE 9 salesService**.

## PENDIENTES OPERATIVOS
- **Smoke check Algolia en prod:** `/admin/sales` con búsqueda de texto activa → verificar que las 3 tarjetas de dinero se ocultan y el pie de tabla queda coherente (mensaje "Totales no disponibles en búsqueda por texto"). Test (`ayrsteel-test`) no tiene Algolia, solo verificable en prod.
- **Importación real de ventas a prod:** operación de curación (§14 CLAUDE.md), sesión dedicada. Backup de `sales` prod ANTES de correrla.

## REGLAS GRABADAS (aprendidas)
- Ejecutor **PARA y espera OK** antes de tocar prod (no ejecutar-y-reportar).
- **NUNCA script que reimplemente callable** saltándose guards contra prod.
- **Guard laterSales NO se toca.**
- Verificar auth Antigravity a ambos proyectos al inicio.
- Sincronizar `develop` con `master` al arrancar.
- "compila/type-check" ≠ GREEN (los tests DEBEN correr con emulador).
- Densidad de `coil_finishes` **nunca** hardcodeada.
