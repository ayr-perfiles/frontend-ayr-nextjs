# MÓDULO: coils (bobinas) — verdad de arquitectura
> ÚLTIMA VERIFICACIÓN CÓDIGO+PROD: **§6 → 2026-08-25** (cierre del bug de Algolia, v6.61.0: filtros medidos 8/8 contra prod + código en `5c83f7bb`; el resto de §6 viene del recon de #10 del 2026-08-24, no re-verificado). **§1-§5 → 2026-07-29** (Frente B, runtime prod, finishes) — NO re-verificadas desde entonces.
> ⚠️ SE PUDRE. Antes de tocar lógica/writes de bobinas: verificá (checklist). No confíes si la fecha está vieja.

## 1. Estado isClosed (regla de negocio verificada)
- Bobinas NACEN CERRADAS (isClosed:true default en registerCoil + registerCoilsBulk). Supervisor abre para producir.
- CERRADA = NO producir, SÍ vender (incluso a medio producir), SÍ split, SÍ merma.
- Guard producción: BLOQUEA en produceFromCoils (aluzinc), consumeCoil (drywall), sendToCut. NO bloquea venta/split/scrap.
- ⚠️ Guard HERMÉTICO solo en produceFromCoils (backend callable, lee isClosed del doc en transaction.get, inmune a inyección de request).
  consumeCoil (drywall) y sendToCut son CLIENT-side → guard solo en cliente = DEUDA DE SEGURIDAD hasta que drywall/corte migren a callable.
- Toggle abrir/cerrar: setCoilClosed (coilClose.ts).

## 2. Fórmula ML (metros lineales) — tabla InventoryTable
- ML = weight / (masterWidth_mm × thickness_mm × densityFactor). masterWidth en mm DIRECTO (NO /1000 — ese bug infló ML x1000).
- ML restante = currentWeight/... · ML total teórico = initialWeight/...
- Densidad SIEMPRE de coil_finishes (0.00785 galv/aluzinc natural, 0.008 aluzinc prepintado). NUNCA hardcodeada. Si falta → "s/densidad", no inventar.
- ML total inflado en bobinas splitteadas (split.ts baja masterWidth, NO initialWeight) → marcar aproximado ("≈≈").

## 3. Catálogo de Acabados (`coil_finishes`)
- **Estructura unificada:** `coil_finishes` opera como FUENTE ÚNICA de acabados. Los documentos cuentan con los campos `tipo` (`Natural`|`Prepintado`|`Galvanizado`) y `color` (`Rojo`|`Azul`|`Blanco`|`Gris`|`Verde`|`'-'`). 
- **Helpers:** `getFinishMeta` lee los campos de BD y `formatFinishChip` inyecta los estilos visuales consistentes (badge colors, etc).
- **Tipado:** Tipado estricto con uniones `FinishType` y `FinishColor`.

## 3. Tabla InventoryTable (8 columnas)
checkbox · Serie(id+proveedor truncado) · Acabado(FinishBadge legible) · Material(dims+originalDescription truncado+tooltip) · Valorización(PEN+USD) · Stock/peso(restante/total kg + ML restante/total + barra) · Estado(StatusBadge+CERRADA) · Acciones. Responsable y Fecha Ingreso → modal, no tabla. Server-side (cursores useCoils.ts) — cambiar filtros toca queries+índices.

## 4. Shape coil (doc real prod): id, initialWeight, currentWeight, masterWidth, thickness, pricePerKg, status, isClosed, isDraft, registeredBy, finish, densityFactor, metadata{provider, invoiceNumber, invoiceDate, originalDescription...}

## 6. Scoping por línea de negocio (drywall vs aluzinc) — verificado 2026-08-24
- **Discriminante: `coil.finish`.** Presente en **168/168** docs de prod (cero ausentes, cero backfill). Reparto: `GALV` 38 / `ALZ-*` 130. ⚠️ El prefijo real de prod es **`ALZ-`** (test legacy tenía `ALU-`).
- **El mapeo finish→línea vive en `coil_finishes.lines`** (array de `BusinessLine`), NO en el coil. 9 docs; `GALV.lines = ["drywall"]` exacto, ningún `ALZ-*` incluye `drywall`, cero finishes sin `lines`, cero `coils.finish` huérfano (todo finish de un coil existe en `coil_finishes`).
- **Patrón de resolución:** `listAvailableCoils(line)` (`coilService.ts:319`) lee `coil_finishes`, filtra `f.lines.includes(line)` y consulta `coils` con `where('finish','in', ids.slice(0,30))`. 9 finishes < 30 → el `slice` no trunca hoy. El helper puro `getFinishIdsForLine(finishes, line)` (`src/core/coils/domain/finishCompat.ts`, `c337fc0e`, 5 tests) encapsula la misma regla (activos + `lines` incluye la línea) — **todavía sin consumidor**: `listAvailableCoils` conserva el filtro inline hasta el frente #10.
- **Límite de Firestore que condiciona el diseño de #10:** `finish in [8]` × `status in [4]` = 32 disyunciones > 30 → `INVALID_ARGUMENT`. El único índice con `finish` es `{status, finish, createdAt}` (status líder). Decisión tomada: para vista por línea, traer el universo completo de la línea (sin `limit`/cursores) y paginar en memoria — payload medido 114.89 KB para 167 docs (techo ~1488 docs/1MB). Detalle en CLAUDE.md v6.60.0.
- ~~⚠️ **Bug vivo:** la rama Algolia de `fetchInventory` filtra `finish:<id>` pero `coils_index` NO tiene `finish` → búsqueda de texto + filtro de acabado = 0 resultados siempre.~~ ✅ **CERRADO (v6.61.0, verificado 2026-08-25):** `coils_index` tiene `finish` en 168/168 records y `attributesForFaceting` declarado (`filterOnly` × 4: `status`/`finish`/`metadata.currency`/`metadata.provider` — config aplicada en dashboard de Algolia + `FIELDS` de la extensión, FUERA del repo). Los filtros de la rama Algolia se arman en el helper puro `buildCoilAlgoliaFilters` (`src/core/coils/coilAlgoliaFilters.ts`, `5c83f7bb`) — fuente única de `fetchInventory` (modo `inventory`) y `fetchCoilsForExport` (modo `export`), con el valor de provider citado (los 13 proveedores de prod tienen espacios). Arquitectura de la búsqueda: `docs/03-arquitectura/busqueda-algolia.md`.

## 5. VERIFICAR antes de cambio grande: grep escritor vivo · leer 1 doc real de prod · ¿guard backend o solo client? · densidad de coil_finishes nunca hardcodeada.
