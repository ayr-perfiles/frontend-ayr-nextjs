# MÓDULO: ventas (sales) — verdad de arquitectura
> ÚLTIMA VERIFICACIÓN CÓDIGO+PROD: 2026-07-29 (importador detalle).
> ⚠️ SE PUDRE. Antes de tocar lógica/costeo/writes de ventas: verificá (checklist §7). No confíes si la fecha está vieja.

## 1. Escritores vivos de `sales` (5)
1. `src/app/admin/sales/import/page.tsx` — importador masivo. **Client-side directo** (`runTransaction`/`writeBatch`), NO pasa por callable. WRITE 9 pendiente (§9 roadmap CLAUDE.md) migrará esto.
2. `src/core/sales/services/salesService.ts:40` `processSale` — venta normal (POS).
3. `src/core/sales/services/salesService.ts:161` `createQuotation` — cotización comercial.
4. `src/app/admin/patch-sales/page.tsx` — parche manual admin.
5. `functions-sunat/src/sunat/callables.ts` — SOLO metadata fiscal (no toca montos/items).

`salesService.ts` también tiene `approveQuotation` (:219), `annulSale` (:344), `updateQuotation` (:629), `cancelQuotation` (:683) — mutan `sales` existentes, no son altas nuevas.

## 2. Cotización vive en la MISMA colección `sales`
- `status: 'QUOTATION'` es el discriminante de cotización, no una colección aparte.
- Dos formatos de ID:
  - `C-xxxxxx` — cotización comercial normal, consume `nextQuotationNumber`.
  - `COT-{documentNumber}` — cotización IMPORTADA (creada por el importador para facturas con línea aluzinc), **NO consume correlativo**, timestamp histórico (fecha real de la factura, no de hoy).

## 3. `approveQuotation` duplica plata en CONVERTED (`salesService.ts:219-332`)
- Lee la cotización (`quoteRef`), crea un doc **NUEVO** `V-xxxxxx` con `status:'COMPLETED'` (línea 318, `transaction.set(newSaleRef, {...quoteData, ...})` — copia íntegra de `quoteData`, montos completos).
- El doc **original** de la cotización queda `status:'CONVERTED'` (línea 327-331) — **conserva sus montos originales intactos**, no se ponen a cero.
- Consecuencia: sumar por `sales` sin excluir `CONVERTED` cuenta la plata DOS VECES (la cotización original + la venta nueva que nació de ella).
- Punteros de trazabilidad: `originQuoteId` (en la venta nueva, apunta a la cotización) / `convertedToId` (en la cotización, apunta a la venta nueva).
- Guard anti-aprobación de cotizaciones importadas: línea 231-233, `if (quoteData.relatedSaleId || quoteData.metadata?.isQuotation || quoteData.metadata?.isHistorical) throw`. Ver §5.

## 4. Agregados en `/admin/sales`: dos constraints SEPARADAS
- **Tarjetas de dinero** (`aggregateCount` + montos) → filtran solo `status:'COMPLETED'`. Esto excluye tanto `QUOTATION` como `CONVERTED` — evita la doble-plata de §3.
- **Pie de tabla / contador de lista** (`listTotalCount`) → cuenta `COMPLETED + QUOTATION + CONVERTED` (todo lo visible en la lista, independiente de si suma plata).
- Rótulos de las tarjetas son dinámicos según el filtro de estado activo (no hardcodeados a "Ventas").
- Guard de array vacío: si `statuses.length === 0` NO se dispara la query (`salesService.ts:556,564` — Firestore `where(field,'in',[])` explota en runtime si se le pasa un array vacío).
- `dashboardService.ts` y `reportFunctions.ts` **ya filtraban `COMPLETED` estricto** antes de esta sesión — no tenían el bug de doble-conteo, solo `/admin/sales` lo tenía.

## 5. Regla de negocio: cotización importada NUNCA se aprueba
- Motivo: la venta real (factura) YA EXISTE (fue importada como `COMPLETED`). La cotización `COT-{documentNumber}` es solo una **percha de producción** — el vehículo para que aluzinc pueda producir contra ella (§6), no una venta pendiente de cerrar.
- Discriminante: `relatedSaleId` presente en el doc de la cotización.
- Guard backend: `approveQuotation` línea 231-233 (throw, ver §3).
- Guard UI: `isImportedQuotation()` en `src/core/import/salesImportLogic.ts:8` oculta el botón "Aprobar Venta" (`SalesTable.tsx`) y muestra badge **"PRODUCCIÓN"** (gris) en vez de **"COT. PENDIENTE"**.

## 6. Ciclo correcto de una factura importada con línea aluzinc
```
importar factura → nace venta COMPLETED + cotización COT-{documentNumber}
                 → producir contra la COT- (selector de cotizaciones de producción)
                 → bobina baja peso + kardex OUT
                 → línea cumplida desaparece del selector
                 → FIN
```
- El importador saca el `weight` de cada ítem desde el catálogo. `metallic_roofing_catalog` (`src/modules/metallic-roofing/services/catalogService.ts`) **no tiene** `standardWeight`/`weight` propio — es un campo derivado en otros contextos, no un dato sembrado en el catálogo. Resultado: ítems metallic importados con `weight: 0` + flag `"sin peso"`. **No es un bug del importador**, es un hueco de datos del catálogo aluzinc.
- Profit por ítem calculado con `baseCost` real (no placeholder).

## 7. Correlativos y dedup del importador
- El importador usa `documentNumber` (número de la factura real) como **doc ID** de la venta → dedup natural: re-importar la misma factura PISA el doc existente, no duplica.
- No toca `nextSaleNumber` ni `nextQuotationNumber` (por eso `COT-{documentNumber}` no consume el correlativo comercial `C-xxxxxx`).

## 8. Trampa `{id: doc.id, ...doc.data()}` (id parásito)
- Si el objeto pone `id` ANTES del spread de `doc.data()`, y el documento en Firestore tiene guardado un campo `id` en su payload (dato legado o duplicado), el spread lo **pisa** — el `id` final puede no ser el doc.id real. En React esto produce keys duplicadas/inestables en listas.
- Patrón correcto: `{ ...doc.data(), id: doc.id }` (id SIEMPRE al final, gana sobre cualquier campo `id` que traiga el documento).
- Corregido esta sesión en `salesService.ts`, `crmService.ts:66-67/113-114`, `kardexService.ts:88` (mapeos defensivos).
- **Deuda viva:** `crmService.ts:147` (`getCustomerProfile`, patrón `{id, name, address, ...data}` — el spread sigue pisando el id) y líneas `159`/`170` (`{id: d.id, ...d.data()}`, mismo orden viejo) **NO se tocaron** esta sesión. Ver HANDOFF.md.

## 9. PT se infla al producir contra cotización importada
- Una venta histórica importada **no descuenta stock** (la mercadería ya salió en la realidad, antes de que el sistema existiera).
- Pero producir contra su `COT-` **sí suma** al stock de producto terminado (flujo normal de producción).
- Resultado: el stock de PT en el sistema queda inflado respecto a la realidad física. Decisión tomada: aceptar el desfase, ajuste manual al cerrar el período contable. No hay fix de código pendiente para esto.

## 10. Algolia (solo prod)
- La extensión de sync Algolia cubre `delete` de docs `sales`, pero el trigger es **asíncrono**. Un conteo inmediato después de un delete puede mentir (todavía no propagó).
- Test (`ayrsteel-test`) NO tiene Algolia configurado — cualquier comportamiento de búsqueda por texto en `/admin/sales` solo es verificable en prod.

## 11. VERIFICAR antes de cambio grande (checklist)
1. `grep` del escritor VIVO de `sales` (§1) — no asumas cuál toca tu cambio.
2. ¿La query/agregado que vas a tocar filtra `COMPLETED` estricto, o necesita excluir `QUOTATION`/`CONVERTED` explícitamente (§3-4)?
3. Guard de array vacío en cualquier `where(...,'in', arr)` nuevo sobre `status`.
4. Cotización importada (`relatedSaleId` presente) → nunca debe ofrecer aprobar/editar como si fuera pendiente real (§5).
5. Mapeo de doc Firestore → objeto JS: `id` SIEMPRE al final del spread (§8).

## 12. Refactor v6.28 y Backfills (2026-07-23)
- **BUILDER CANÓNICO de sales** (`src/core/sales/domain/saleDocBuilder.ts`): `buildSaleDoc`/`buildQuotationDoc` consumidos por los 3 escritores. El builder normaliza la FORMA, no los VALORES (respeta totales del input cuando vienen, PROHIBIDO el spread dentro del builder).
- **SEMÁNTICA SEPARADA:** `documentNumber` = comprobante o `""` (NUNCA RUC); `customerDocument` = RUC/DNI. Fallback legacy con flag "documento reubicado".
- **BACKFILLS EN PROD:** 114 docs con `businessLines` derivado por `classifyLine`; 3 docs con RUC reubicado de `documentNumber` a `customerDocument`; 33 docs con `totalProfit` -> 0 con flag "sin costo".
- **crmService.getCustomerProfile:** DOBLE query (`documentNumber` legacy + `customerDocument`) deduplicada por id. Índice `sales[customerDocument, timestamp]` READY en prod y test.

## 13. Importador Masivo de Ventas (Detalle)
- **Vista de Detalle:** El importador masivo en `/admin/sales/import` fue enriquecido con una vista de detalle por comprobante (acordeón por boleta) en lugar de un mero total consolidado. También incluye un panel para las filas descartadas/ignoradas (`skipReasonLabel`).
- **Helper puro `parseImportRows`:** Función que procesa los datos del CSV (con tipado estricto `ParsedSaleItem`, sin `any`) devolviendo un objeto estructurado `{ parsedSales, skippedRows }`.
- **Typing fuerte:** El tipado `ParsedSaleItem` erradicó bugs silenciosos (como el campo fantasma `item.amount` que antes pasaba por `any`). La lección arquitectónica: tipar desde la capa de parsing para que falle en BUILD y no en runtime.
