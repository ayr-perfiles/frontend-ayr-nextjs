# MÓDULO: ventas (sales) — verdad de arquitectura
> ÚLTIMA VERIFICACIÓN CÓDIGO+PROD: 2026-08-20 (frente EDITAR cerrado — callable `editQuotation`, §16).
> ⚠️ SE PUDRE. Antes de tocar lógica/costeo/writes de ventas: verificá (checklist §11). No confíes si la fecha está vieja.
> ⚠️ **§4 de este doc describe el modelo PRE-2026-08-18, hoy OBSOLETO en la parte de agregados de `/admin/sales`. Ver §14 antes de confiar en §4.**
> ⚠️ **§15 describe `annulSale` como client-side. Eso quedó OBSOLETO en v6.50.0 (swap a callable) y v6.52.1 (bloqueo `self` + gate de stock). La verdad viva de anulación es [`docs/modules/annulment.md`](annulment.md), no §15 — que se conserva por el contexto de #9-B.2b.**

## 1. Escritores vivos de `sales` (5)
1. `src/app/admin/sales/import/page.tsx` — importador masivo. **Client-side directo** (`runTransaction`/`writeBatch`), NO pasa por callable. WRITE 9 pendiente (§9 roadmap CLAUDE.md) migrará esto.
2. `src/core/sales/services/salesService.ts:43` `processSale` — venta normal (POS).
3. `src/core/sales/services/salesService.ts:159` `createQuotation` — cotización comercial.
4. `src/app/admin/patch-sales/page.tsx` — parche manual admin.
5. `functions-sunat/src/sunat/callables.ts` — SOLO metadata fiscal (no toca montos/items).

**Mutadores de `sales` ya existentes** (no son altas nuevas). ⚠️ Los offsets se corren con cada edición del archivo — `grep -n "export const"` antes de confiar:

| Mutador | Dónde | Naturaleza |
|---|---|---|
| `confirmQuotationForProduction` | `salesService.ts:221` | client-side |
| `approveQuotation` | `salesService.ts:249` | client-side |
| `annulSale` | `salesService.ts:379` | **wrapper thin** de callable (v6.50.0) — ver [`annulment.md`](annulment.md) |
| `editQuotation` | `salesService.ts:433` | **wrapper thin** de callable (v6.53.0) — ver §16 |
| `cancelQuotation` | `salesService.ts:697` | client-side |

⚠️ **`updateQuotation` YA NO EXISTE.** Borrada en v6.53.0 (D6): 0 consumidores, 0 tests, fuera del builder canónico v6.28 (no escribía `customerDocument`, no calculaba `profit` por ítem, no armaba `allFlags`), su único guard (`status !== 'QUOTATION'`) no distinguía origen, y su `totalProfit` usaba el monto **CON** IGV — fórmula distinta a la del builder. Si un doc viejo la menciona, ese doc está podrido. El reemplazo es el callable `editQuotation` (§16).

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
> ⚠️ **OBSOLETO desde 2026-08-18 — ver §14.** El bullet de "Pie de tabla" de abajo describe el modelo PRE-#9-A. Hoy `/admin/sales` NUNCA muestra `QUOTATION`/`CONVERTED`, ni en tarjetas ni en pie de tabla ni en búsqueda — las cotizaciones viven en `/admin/quotations`.
- **Tarjetas de dinero** (`aggregateCount` + montos) → filtran solo `status:'COMPLETED'`. Esto excluye tanto `QUOTATION` como `CONVERTED` — evita la doble-plata de §3. (Esto sigue vigente.)
- ~~**Pie de tabla / contador de lista** (`listTotalCount`) → cuenta `COMPLETED + QUOTATION + CONVERTED` (todo lo visible en la lista, independiente de si suma plata).~~ **YA NO. Ver §14: hoy `listTotalCount` = `COMPLETED + VOIDED`, misma whitelist que las tarjetas.**
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
6. ¿Tu cambio escribe sobre un doc de `sales` ya existente? Entonces revisá los invariantes T1/T2 de §16.3 — **nunca** `set()` del output del builder sobre un doc vivo, **nunca** totales que vengan del cliente.
7. ¿Distinguís nativa de importada? Usá `isImportedQuotation`, **NO** `resolveSaleQuotationLink` (clasifica toda cotización como `self`, §16.1).

## 12. Refactor v6.28 y Backfills (2026-07-23)
- **BUILDER CANÓNICO de sales** (`src/core/sales/domain/saleDocBuilder.ts`): `buildSaleDoc`/`buildQuotationDoc` consumidos por los 3 escritores. El builder normaliza la FORMA, no los VALORES (respeta totales del input cuando vienen, PROHIBIDO el spread dentro del builder).
- **SEMÁNTICA SEPARADA:** `documentNumber` = comprobante o `""` (NUNCA RUC); `customerDocument` = RUC/DNI. Fallback legacy con flag "documento reubicado".
- **BACKFILLS EN PROD:** 114 docs con `businessLines` derivado por `classifyLine`; 3 docs con RUC reubicado de `documentNumber` a `customerDocument`; 33 docs con `totalProfit` -> 0 con flag "sin costo".
- **crmService.getCustomerProfile:** DOBLE query (`documentNumber` legacy + `customerDocument`) deduplicada por id. Índice `sales[customerDocument, timestamp]` READY en prod y test.

## 13. Importador Masivo de Ventas (Detalle)
- **Vista de Detalle:** El importador masivo en `/admin/sales/import` fue enriquecido con una vista de detalle por comprobante (acordeón por boleta) en lugar de un mero total consolidado. También incluye un panel para las filas descartadas/ignoradas (`skipReasonLabel`).
- **Helper puro `parseImportRows`:** Función que procesa los datos del CSV (con tipado estricto `ParsedSaleItem`, sin `any`) devolviendo un objeto estructurado `{ parsedSales, skippedRows }`.
- **Typing fuerte:** El tipado `ParsedSaleItem` erradicó bugs silenciosos (como el campo fantasma `item.amount` que antes pasaba por `any`). La lección arquitectónica: tipar desde la capa de parsing para que falle en BUILD y no en runtime.

## 14. Separación TOTAL ventas/cotizaciones — Frentes #9-A / #9-B.1 (2026-08-18)

Antes de esta sesión, `/admin/sales` mezclaba TODO en una sola vista: ventas reales + las ~130 perchas importadas `COT-*` + cotizaciones nativas `C-*` pendientes. Reemplaza el modelo descrito en §4 (marcado obsoleto arriba).

**Modelo nuevo — dos vistas, un solo campo `status` como discriminante:**
- **`/admin/sales`** = SOLO venta real. `status in ['COMPLETED','VOIDED']`. Fuente de verdad única: `buildListStatusFilter('ALL')` (`src/core/sales/salesAggregateLogic.ts`). Aplicado en las **3 vías de lectura**, no solo la principal:
  1. Query Firestore (rama sin búsqueda de texto) — `where('status','in',[...])`.
  2. Dropdown de filtro (`SalesFilters.tsx`) — las opciones "Cot. Pendientes"/"Cot. Aprobadas" fueron ELIMINADAS del select, solo quedan "Todas"/"Ventas Cerradas".
  3. Búsqueda de texto (Algolia) — filtro **CLIENT-SIDE** (`filterSalesExcludingQuotations`, misma fuente `buildListStatusFilter`) sobre los docs Firestore reales ya traídos, NO sobre los hits crudos de Algolia (que el código solo usa para extraer `objectID`, ver §10). Detalle del porqué client-side y no server-side, abajo.
- **`/admin/quotations`** (ruta nueva, antes un stub `InDevelopment` sin linkear desde Sprint 6B) = TODAS las cotizaciones: perchas importadas `COT-*` (range-query sobre `documentId()`, `>='COT-'` `<'COT-'`, índice automático `__name__`) + nativas `C-*` con `status in ['QUOTATION','CANCELLED']` — `fetchAllQuotations()` en `salesService.ts`, 2 queries dedupeadas por doc.id (sin `limit`, trae todas). Columnas: Documento · Cliente · Fecha · Estado de Cotización (Vigente/Cancelada) · Estado de Producción (derivado, ver abajo) · Origen (Importada/Nativa) · Comprobante Vinculado. **SIN acciones** — editar/anular/cascada es #9-B.2, no implementado.

**Estado de producción de una cotización NO es un campo simple.** `isFulfilled` (booleano persistido en el doc) solo da 2 estados (true/false) — comprobado con datos reales de prod: dos perchas con `isFulfilled:false` idéntico, una sin ninguna producción y otra con producción parcial real, indistinguibles por el campo solo. El estado real (PENDIENTE/PARCIAL/CUMPLIDA/SOBRE_PRODUCIDA) se DERIVA cruzando `items` (lo pedido) contra `production_logs` filtrados por `source.id` — helper `buildQueueRow` (`src/core/production/queueLogic.ts`), REUSADO TAL CUAL (no reimplementado) entre la cola de producción metallic y `/admin/quotations`.

**Origen (Importada/Nativa)** se determina con `isImportedQuotation(sale)` = `Boolean(sale.relatedSaleId || sale.metadata?.isQuotation)` (`src/core/import/salesImportLogic.ts`) — **NUNCA por el prefijo del id**. Confirmado 100% consistente en prod: las 130 `COT-*` dan `isImportedQuotation()===true`, cero excepciones.

**`cancelQuotation` (`salesService.ts`) bloquea perchas importadas.** Guard dentro de la transacción, tras el check de status:
```ts
if (data.relatedSaleId || data.metadata?.isQuotation) {
  throw new Error('No se puede cancelar una cotización importada: proviene de una venta ya facturada. Para revertir, anule la venta.');
}
```
Antes de este guard, se podía cancelar una percha ya con producción real (`isFulfilled:true`, 74/130 en prod al momento de la sesión) sin avisar ni tocar la producción ni la venta gemela — dato inconsistente silencioso. Solo cotizaciones NATIVAS se pueden cancelar hoy.

**"Editar Cotización" y "Duplicar Operación" ocultos en `/admin/sales`** (`SalesTable.tsx`, `hidden:true`) — eran botones muertos, no arreglados, solo tapados: Editar apunta a `/admin/sales/[id]/edit`, ruta INEXISTENTE (404); Duplicar tiene un mismatch de query param (`?from=` que manda `page.tsx`, vs `?duplicateId=` que lee `new/page.tsx`) — abría un formulario vacío, no duplicaba nada. `onEdit`/`onDuplicate` quedan cableados sin ruta/reglas reales hasta #9-B.2.

**DEUDA VIVA — `status` no es atributo facetable en el índice Algolia `sales_index`.** Intentar filtrar server-side por status ahí (helper `buildAlgoliaStatusFilter`, escrito y testeado pero marcado `⚠️ NO USAR` en su docstring) **rompió la búsqueda de texto ENTERA en prod una vez** — con el filtro (aunque fuera un simple `status:COMPLETED`), Algolia respondía error de filtro inválido, el `catch` de `algoliaClient.ts` caía a `hits:[]`, y la búsqueda devolvía 0 resultados para CUALQUIER término, no solo para cotizaciones. Se revirtió el intento server-side y se resolvió filtrando client-side (ver arriba). Si algún día se configura `attributesForFaceting:['status',...]` en el dashboard de Algolia + se reindexa, `buildAlgoliaStatusFilter` queda lista para reemplazar el filtro client-side sin tocar la lógica de whitelist (misma fuente `buildListStatusFilter`).

**Ampliación al §11 (checklist antes de cambio grande):** agregar — 6. ¿Tu cambio toca `/admin/sales` o `/admin/quotations`? Confirmá que sigue siendo imposible traer una cotización a `/admin/sales` por CUALQUIER vía (query/dropdown/búsqueda) antes de mergear.

## 15. `annulSale` bloquea anulación con producción viva + limpia twin nativo — #9-B.2b (2026-08-19, commit `a7e06d9c`)

`annulSale` (`salesService.ts`, client-side) antes anulaba una venta sin mirar si su percha de cotización gemela tenía producción activa — podía dejar el sistema en un estado inconsistente (venta VOIDED, pero bobinas ya consumidas / stock de PT ya movido contra esa cotización, sin ningún rastro de la inconsistencia).

**D1 — bloquear, no cascadear.** Antes de anular, `annulSale` resuelve la percha vinculada con `resolveSaleQuotationLink` (§ ver `saleProductionLink.ts` — cubre AMBOS campos: `relatedQuotationId` para importadas Y `originQuoteId` para nativas, ya usado desde #9-B.1b). Si hay percha, corre una query PRE-transacción sobre `production_logs` (`source.id == perchaId`) y evalúa el helper puro `hasActiveProduction(logs)` (`src/core/production/fulfillmentLogic.ts`) — `true` si ALGÚN log tiene `status==='ACTIVE'`, incluida producción parcial (no exige que esté cumplida). Si `true`, `annulSale` hace `throw` con el `perchaId` en el mensaje y **nunca abre la transacción** — no hay cascada automática, no llama a `voidProductionFromCoils`, no toca el guard `laterSales`.

**Por qué la query va PRE-transacción, no dentro:** una transacción de Firestore no puede correr queries arbitrarias (solo `get()` de documentos puntuales), y no existe un flag denormalizado de "producción viva" en la percha — `isFulfilled` no sirve para esto: distingue cumplida/no-cumplida, pero NO distingue "sin ninguna producción" de "con producción parcial en curso" (mismo hallazgo que ya documentó §14 para el estado de producción de una cotización). Consecuencia aceptada: existe una mini-race teórica entre la query y la escritura (alguien podría iniciar producción justo en el medio) — ver deuda "hardening futuro" en HANDOFF.md/CLAUDE.md v6.48.6 para el plan de cerrarla (denormalizar el flag y mover el check dentro de la txn).

**D2 — la gemela es asimétrica, cada camino según su semántica real:**
- **Nativa (`originQuoteId`):** al anular, además del revert existente (la cotización vuelve a `status:'QUOTATION'`), ahora también se limpia `convertedToId` con `deleteField()` — antes quedaba un puntero fantasma a una venta ya anulada.
- **Importada (`relatedQuotationId`):** 100% intacta, sin cambios. El campo `annulledSaleRef` que se había planeado en el recon se DROPEÓ del plan final — habría sido write-only (nada lo lee), y el link forward `relatedQuotationId` ya sobrevive naturalmente cuando la venta pasa a `VOIDED` (no hace falta un puntero nuevo).

**D3 — el costo sincronizado por A1 (`costSyncedAt`/`costSource:'PRODUCTION'`) NO se revierte.** Si la cascada de write-back de costo (v6.34, A1) ya sincronizó el costo de producción a la venta antes de que esta se anule, ese costo queda como dato histórico válido — anular la venta no lo deshace. Decisión consciente, no un gap.

**UI:** sin frente propio — el `throw` de `annulSale` lo captura el catch ya existente del modal de anulación (mismo patrón que cualquier otro error de negocio de este flujo), confirmado en runtime. No hubo que tocar componentes de UI.

**Tests:** 10+ nuevos RED→GREEN — unit de `hasActiveProduction` (`fulfillmentLogic.test.ts`) + 5 escenarios de integración contra emulador real (`annulSaleCascade.integration.test.ts`, `src/test/integration/`). Runtime end-to-end validado por el dueño: bloqueo en vivo (intentar anular con producción activa → rechazado) y release (anular producción primero vía void → luego SÍ se puede anular la venta).

**Relación con el fix void 500 (§ ver `docs/modules/metallic.md` §4):** el smoke de cierre de #9-B.2b en prod quedó parcialmente tapado por un bug AJENO — el guard `laterSales` de `voidProductionFromCoils` crasheaba con 500 crudo ante un `timestamp` corrupto en una venta de TEST, lo que bloqueaba poder re-anular producción para probar el release. Ambos frentes se cerraron en la misma sesión; el bug del void NO es de `annulSale` ni de este §15.

## 16. EDITAR una cotización nativa — callable `editQuotation` (2026-08-20, v6.53.0, commits `f80b423d`+`2ccb5643`+`46cb5ba8`)

Editar el carrito de una cotización deja de ser imposible desde la UI y pasa a ser una operación real, **server-side**. Reemplaza a la huérfana `updateQuotation`, que fue borrada (§1).

**Por qué tenía que ser callable y no un `updateDoc` del cliente:** `firestore.rules:78` ya protege `['totalAmount','subtotal','igv','exchangeRate','currency','items','paymentType']` contra update client-side. Cualquier edición del carrito desde el browser da `permission-denied`. No es una preferencia de arquitectura, es la única vía que existe.

### 16.1 Qué se puede editar (allowlist, D1)

**Solo una cotización NATIVA en estado `QUOTATION`.** Nada más.

- Una percha IMPORTADA (`COT-*`, con `relatedSaleId` / `metadata.isQuotation`) **NO se edita**: es el espejo de una factura ya emitida (§5-6), editarla desincronizaría la venta gemela sin propagar nada — venta y percha son copias independientes unidas por 2 strings.
- Una venta `COMPLETED`/`VOIDED` tampoco: para eso está anular ([`annulment.md`](annulment.md)).
- Una `CANCELLED`/`CONVERTED` tampoco.

⚠️ **Para distinguir nativa de importada NO sirve `resolveSaleQuotationLink`.** Ese helper clasifica como `mode: "self"` a TODA cotización — nativa E importada — porque el chequeo `status === "QUOTATION"` va PRIMERO (`saleProductionLink.ts:26-28`) y corta antes de mirar `relatedQuotationId`/`originQuoteId`. La señal correcta es `isImportedQuotation` (las 2 marcas que `buildImportWrites` escribe siempre juntas, 130/130 en prod). Este error ya se pagó caro en v6.52.1; ver [`annulment.md`](annulment.md) §0.

### 16.2 Guards del callable, en orden barato→caro

`functions/src/callables/editQuotation.ts` (exportado en `functions/src/index.ts:5`):

| # | Guard | Error |
|---|---|---|
| 1 | auth presente + email en el token | `unauthenticated` |
| 2 | **rol ADMIN-only** (`:112`) | `permission-denied` |
| 3 | `quotationId` no vacío · al menos 1 ítem | `invalid-argument` |
| 4 | la cotización existe | `not-found` |
| 5 | `status === 'QUOTATION'` (`:140`) | `failed-precondition` |
| 6 | **origen NATIVO** — `isImportedQuotation(preData)` (`:148`) | `failed-precondition` (emite `quotationId`) |
| 7 | **sin producción ACTIVE** — `hasActiveProductionForQuote(quotationId, db)` (`:158`) | `failed-precondition` (emite `quotationId` + `activeLogIds`) |

⚠️ **D-Q6 — el rol NO es el mismo que el de `annulSale`.** `annulSale` acepta ADMIN **y** SUPERVISOR; `editQuotation` es **ADMIN-only**. Hay un test que ancla la diferencia a propósito — no "unificarlos" sin decisión de negocio.

El guard 7 reusa `hasActiveProductionForQuote` (`functions/src/utils/`, de v6.52.1) — trabaja **directo sobre el `quoteId`**, sin pasar por `resolveSaleQuotationLink`. Bloqueo **total** (D4/D10): editar el carrito de algo que ya se está produciendo corrompería el fulfillment. No hay edición parcial ni cascada.

### 16.3 LOS 2 INVARIANTES — no los rompas

**T1 — el callable NUNCA reenvía totales del cliente al builder.**
No es solo que `EditQuotationData` no declare `totalAmount`/`totalCost`/`totalProfit`/`totalWeight`: el input del builder se **enumera campo por campo** (`:233-245`), y lo mismo dentro de cada ítem (`:211-229`). **Nunca un spread de `request.data`.** Aceptar totales del cliente reintroduciría exactamente el vector que `firestore.rules` cierra al proteger `totalAmount`. Anclado por test (se manda `totalAmount: 999999` y el doc queda con el del builder) y por el smoke real.

**T2 — NUNCA `set()` del output del builder sobre el doc existente.**
`buildQuotationDoc` emite un doc de **CREACIÓN** (19 claves). Un `set()` pisaría `productionStatus` (`CONFIRMED` → `PENDING`, o sea: **la cotización saldría de la cola de producción**), más `timestamp`, `isFulfilled`, `confirmedBy`, `confirmedForProductionAt`, `convertedToId`, `costSyncedAt` y `annulledSaleRef`.

En su lugar: **`tx.update()` con un mapa EXPLÍCITO de 14 campos** (`:250-273`) + `updatedAt`/`updatedBy`. Los otros 5 del builder (`status`, `productionStatus`, `paymentStatus`, `sellerId`, `timestamp`) y los 16 de ciclo de vida se preservan **por no estar en el mapa** — esa omisión ES la propiedad que hace segura la operación. Si agregás un campo al mapa, estás decidiendo pisarlo.

### 16.4 Q2(b) — recompute de `baseCost`, con 3 guards

Al editar, el `baseCost` de cada ítem se recomputa contra el WAC vivo — pero solo si `isRecomputable(item)` (`:95-99`). Los 3 casos que **preservan** el costo del input, cada uno por una razón concreta:

- **`isCoil` ⇒ nunca.** Una bobina no tiene WAC: su `baseCost` es `pricePerKg` (**S/ por KG**) y su `quantity` son kilos. El selector de bobina emite `businessLine: "drywall"` + `isCoil`, así que sin el guard el callable leería `inventory_stock/{coilId}` — la colección equivocada, mezclando unidades.
- **Línea desconocida/vacía ⇒ preserva.** `getStockStrategy('')` **lanza un `Error` genérico**, no un `HttpsError`. El builder en cambio tolera esos ítems (`bl:''` + flag 'linea no resuelta'), así que acá también: preservar es fail-safe.
- **`WAC <= 0` ⇒ preserva** (`:207`). 7 de 18 SKUs de metallic en prod están en 0 y 8 tienen cantidad negativa. Sin el guard, editar metería basura en el costo.

Solo un `WAC > 0` pisa el `baseCost`.

⚠️ **UNA SOLA pasada del builder, con el `baseCost` resuelto ANTES.** El builder canónico **no es idempotente en las flags**: `const itemFlags = rawItem.flags ? [...rawItem.flags] : []` arranca de las flags del input. El patrón build → recomputar → build dejaría pegada una flag `'sin costo'` de la 1ª pasada aunque el costo ya sea > 0.

### 16.5 Efectos — y los que NO hay

- **Queda `QUOTATION` in-place** (D13). No cambia de estado, no crea un doc nuevo, no consume correlativo.
- **CERO efectos de stock.** El callable solo LEE docs de stock (para el WAC de Q2(b)); las únicas escrituras son el `tx.update(quoteRef)` y un `audit_logs` con `action: 'EDIT_QUOTATION'` (`:275`). Anclado por test.
- **Totales por la fórmula del builder** (Q5): profit **por ítem sobre `unitValue`** (sin IGV) — NO `totalAmount − totalCost`, que es lo que hacía la borrada `updateQuotation` con el monto CON IGV.
- Los maestros `customers`/`contacts` **no** son asunto de la edición (Q7): editar una cotización no muta el CRM.

### 16.6 UI (E3)

- **Ruta `/admin/quotations/[id]/edit`** (D7) — `src/app/admin/quotations/[id]/edit/page.tsx`. **NO se declara en `ROUTE_PERMISSIONS`**: el `.find()` matchea `/admin/quotations` por prefijo y ya la cubre como ADMIN; declararla sería **declaración muerta** (misma trampa del bug de sombra, ver CLAUDE.md).
- **Botón** en `/admin/quotations` (`page.tsx:163`) gateado por `canEditQuotation(row)` (`src/core/sales/quotationsViewLogic.ts:108`) — allowlist estricta `origin === "NATIVA" && quotationStatus === "QUOTATION"`, espeja el backend para no ofrecer lo que el callable va a rechazar. **No** cubre el bloqueo por producción (eso no se sabe desde la fila): lo aplica el callable y la UI lo muestra con el modal.
- El form **reusa** `ProductSelector` y `CustomerSection` tal cual; `CartSummary` se extendió con `actions?` (opcional — el modo default con COTIZAR/VENDER queda intacto).
- **`parseEditError`** (`src/core/sales/parseEditError.ts:51`) — ⚠️ **NO se reusó `parseAnnulError`.** Aquel discrimina el bloqueo de producción **solo por la presencia de `details.quotationId`**, lo cual es correcto para `annulSale` (su único `failed-precondition` con ese campo es el de producción) pero **`editQuotation` tiene DOS guards que emiten `quotationId`** (origen y producción) — reusarlo habría abierto el modal de "producción activa" al intentar editar una IMPORTADA. `parseEditError` discrimina por **`activeLogIds` no vacío**. Regla general: el discriminante tiene que ser el campo que **solo** el caso objetivo produce.
- **`ProductionBlockedAnnulModal` fue RENOMBRADO a `ProductionBlockedModal`** (`src/components/sales/ProductionBlockedModal.tsx`) — el nombre viejo mentiría al usarlo desde editar. Copy opcional cuyo **default son los strings de anular**, así que `SaleDetailsModal` no cambió de comportamiento.

### 16.7 Dominio duplicado server-side (E1)

`buildQuotationDoc` y `classifyLine` tienen copia server-side con parity tests (48 casos): `functions/src/domain/quotation/buildQuotationDoc.ts`, `functions/src/domain/quotation/isImportedQuotation.ts`, `functions/src/domain/catalog/classifyLine.ts`. Ver [`docs/03-arquitectura/patrones-y-convenciones.md`](../03-arquitectura/patrones-y-convenciones.md) §3.

**Son 4 los bloqueos al import cross-boundary, no 3:** `rootDir`/`TS6059` · `firebase.json source:"functions"` · el alias `@/` (functions no declara `paths`) · y el 4º: `catalogImport.ts:1` importa `xlsx` **a nivel de módulo**, así que traer `classifyLine` de ahí arrastraría el paquete entero al bundle del callable. Por eso se porta **solo** esa función.

⚠️ **`calcCoverageWeightKg` NO se copió, y no falta:** el builder nunca calcula peso — solo lee `calculatedWeight` y hace passthrough de `weightSnapshot`.

### 16.8 Estado en PROD (2026-08-20)

⚠️ **El universo editable está VACÍO: 0 cotizaciones nativas en `QUOTATION`.** La única nativa (`C-000020`) está `CANCELLED`; las 130 en `QUOTATION` son perchas importadas. **El botón no aparece en ninguna fila hasta que se cree una cotización nativa. Es correcto y esperado, no un bug.**

**Refactor del POS asociado:** `computeCartTotals`/`addItemToCart` se extrajeron del inline de `sales/new/page.tsx` a `src/core/sales/cartLogic.ts` para que la página de edición los reuse. `cartLogic.test.ts` guarda una copia **textual** de las 2 fórmulas viejas y assertea igualdad contra ellas — el inline se borró recién con esa parity en verde. Diff del POS `−33/+12`, sin ningún cambio de fórmula. Ver [`docs/05-formulas/ventas-igv.md`](../05-formulas/ventas-igv.md) F-V6.
