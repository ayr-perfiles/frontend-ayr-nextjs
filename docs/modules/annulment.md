# MÓDULO: annulment (anulación de venta, `annulSale`) — verdad de arquitectura
> ÚLTIMA VERIFICACIÓN CÓDIGO+PROD: 2026-08-22 (v6.56.0, `annulledAt` string→Timestamp cerrado, commits `545ee08e`+`62116ea5`, backend desplegado a test Y prod 425.07 KB ACTIVE, 2 docs de prod backfilleados; ver §7). **Actualizado 2026-08-24 (v6.59.0), alcance acotado: §0-bis completo (las 4 NC restantes fueron anuladas + nota NC-sin-costo), §0-ter completo (retro de cola CERRADO 0/6 + corrección de `PRODUCTION_QUEUE_FILTER`), y el párrafo de refuerzo empírico de `annulledAt` en §7. Resto del doc sin re-verificar en esa fecha.** **Actualizado 2026-08-27 (v6.70.0, `[CASCADE-DUP]`, commit `f88cbb02`), alcance acotado: §0 (tabla de gates, fila 2 — "en las 2 copias" → copia server única) y §2 (Helpers puros, reescrito — `canAnnulSale.ts`/`buildAnnulmentCascade.ts` cliente BORRADOS, quedan 2 parity tests no 4). Resto del doc (§0-bis, §0-ter, §1, §3+) sin re-verificar en esta fecha — sus referencias a `buildAnnulmentCascade`/`canAnnulSale` son narrativa histórica en tiempo pasado, no afirman que la copia cliente exista.**
> ⚠️ SE PUDRE. Antes de tocar `annulSale`/rules de `sales.status`: verificá (checklist). No confíes si la fecha está vieja.

## 0. ⚠️ LOS 2 GATES QUE HAY QUE MIRAR SIEMPRE (v6.52.1)

**`resolveSaleQuotationLink` clasifica como `mode: "self"` a TODA cotización — nativa E IMPORTADA.**
El chequeo `status === "QUOTATION"` está PRIMERO (`saleQuotationLink.ts:26-28`) y corta antes de mirar
`relatedQuotationId`/`originQuoteId`. "Nativa vs importada" NO decide el modo; lo decide el `status`.

El bloqueo por producción activa vive en DOS sitios y **ambos** deben cubrir `linked || self`:

| # | Dónde | Qué hace |
|---|---|---|
| 1 | `functions/src/callables/sales.ts` (`if (link.mode === "linked" || link.mode === "self")`) | dispara la query de logs vía `hasActiveProductionForQuote` |
| 2 | `canAnnulSale.ts` (copia server ÚNICA desde v6.70.0, `[CASCADE-DUP]` — la copia cliente se borró) | evalúa el bloqueo y arma `context: {quotationId, activeLogIds}` |

Hasta v6.52.0 los dos decían solo `"linked"` → una `QUOTATION` con producción ACTIVE se anulaba sin
bloqueo (84 perchas reales expuestas en prod). **Arreglar uno solo no alcanza**: sin (1) el bloqueo
recibe `[]`; sin (2) los logs se ignoran.

**El loop de items solo corre para `COMPLETED`** (`sales.ts`, `const movedStock = saleData.status === "COMPLETED"`).
Una cotización NUNCA descontó stock, así que anularla no debe devolver nada. Es una **allowlist positiva
a propósito**: un status nuevo que llegue ahí NO toca stock.

## 0-bis. ⚠️ DENTRO de `COMPLETED` hay un gate de NIVEL 2 (v6.54.0) — anular NC es el INVERSO del import

Que `movedStock` sea `true` no significa "sumar stock". El loop de items (`sales.ts:203-251`) bifurca por
**`documentType`**, el MISMO campo que ya usa el importador para decidir el signo al crear el doc:

| `documentType` | `ncStockAction` | Signo en annul | Primitiva |
|---|---|---|---|
| `FACTURA` / `BOLETA` / ausente | — | `+qty` (devuelve lo que la venta descontó) | `writeSaleReversal` — SIN CAMBIO |
| `NOTA CRÉDITO` | `RETURNS_STOCK` | `−qty` (retira lo que la NC repuso al importar) | `writeAnnulNCDecrement` — NUEVO |
| `NOTA CRÉDITO` | `MONEY_ONLY` / `UNDECIDED` / **ausente** | ninguno — `continue` | — |

**La regla es el REPLAY INVERSO del import**, no un caso especial inventado para anular: una NC con
`RETURNS_STOCK` **SUMÓ** stock al importarse (`import/page.tsx:564-583`, `writeSaleReversal` cliente,
`+qty`, movimiento `ENTRADA`) — anularla tiene que **restar** esos mismos kilos, no volver a sumarlos.
Antes de v6.54.0 el loop no distinguía NC de venta normal: **anular cualquier NC volvía a sumar**, doble
contando lo que la NC ya había repuesto. Medido en prod: 6 NC reales (`FFC1-44/57/61/64/67/72`) expuestas
— 2 cerradas con este fix en su momento (`FFC1-44`, `FFC1-72`). Las otras 4 (`FFC1-57/61/64/67`) quedaron
backfilleadas pero sin anular por un duplicado en `metallic_roofing_stock_movements` — **resuelto en
v6.58.0**: la causa real NO era "re-import sin limpiar", fue un borrado masivo de 114 docs de `sales`
entre el 13 y el 17-ago SIN auditoría y SIN reversión de stock (los 4 movimientos fantasma del 13-ago
quedaron huérfanos y se borraron en prod). **Anuladas en v6.59.0** vía invocación real del callable
desplegado (no script): las 6 NC de prod están hoy `VOIDED`, sus 6 perchas `CANCELLED`. Ver detalle
completo en CLAUDE.md/HANDOFF.md v6.58.0 y v6.59.0.

**NOTA (v6.59.0) — las 4 NC tenían `item.baseCost: 0` (flag `"sin costo"`), así que `frozenCost = 0` y
los 4 movimientos `SALIDA` de la anulación entraron con `costPerUnit: 0`.** `writeAnnulNCDecrement`
preserva `avgCost` y recalcula `totalValue = newBalance × avgCost` — con `avgCost` ≠ 0 en ambos SKUs, el
valor del inventario se movió igual (`-77.57` en `PL030AZ6MT`, `-99.59` en `PL030RJ6MT`) aunque el
movimiento entrara "gratis". Es una asimetría con el import (que sumó 0 de valor) conocida y aceptada —
ver deuda nueva en CLAUDE.md v6.59.0 antes de anular una NC sin costo sobre un SKU con `avgCost` confiable.

**El discriminante de nivel 1 es POSITIVO** (`documentType === "NOTA CRÉDITO"`), no negativo
(`!== "FACTURA" && !== "BOLETA"`): **68 docs de prod tienen `documentType` ausente** (ventas POS nativas,
nunca pasaron por el importador) y la versión negativa los habría metido por error en la rama NC.

**El nivel 2 (`ncStockAction`) también es una allowlist positiva**, fail-safe: solo `=== "RETURNS_STOCK"`
decrementa; cualquier otro valor —incluido **ausente**, que es el caso REAL de las 6 NC vivas en prod,
importadas antes de que `ncStockAction` se empezara a persistir— hace `continue` sin tocar stock ni emitir
movimiento. El campo se persiste desde v6.54.0 en `salesImportLogic.ts` (`saleDoc` Y `quotationDoc`, mismo
patrón literal que `documentType`); antes moría con la transacción de import (0/329 docs en prod lo tenían).

## 0-ter. ⚠️ La rama `imported` de la cascada CANCELA la percha, no solo la marca (v6.55.0)

Hasta `488455d1`, anular una venta con twin `imported` (`buildAnnulmentCascade.ts`, rama `imported`) escribía
**solo** `annulledSaleRefs` en la percha — nunca `status`/`productionStatus`. La percha `COT-*` quedaba
`status:'QUOTATION'` para siempre, así que seguía calificando para `PRODUCTION_QUEUE_FILTER`
(`status:'QUOTATION', productionStatus:'CONFIRMED', businessLines array-contains 'metallic-roofing',
isFulfilled:false` — 4 predicados; el 4º, `isFulfilled`, es parte de la query real de
`getProductionQueueCount` (`salesService.ts:659`) pero no de la constante `PRODUCTION_QUEUE_FILTER` en sí,
verificado 2026-08-24) y **seguía visible en la cola de producción** pese a que su venta ya no existía —
rompiendo la promesa que `cancelQuotation` ya le hace al usuario ("para revertir, anule la venta").
⚠️ **Trampa de nombre:** la constante declara el campo `businessLine` (singular, escalar), pero la query
consume `businessLines` (plural, array) con `array-contains` — grepear solo el nombre de la constante
induce a creer que el campo del doc es escalar.

**Fix:** el mismo write ahora agrega `status: 'CANCELLED'` (junto a `annulledSaleRefs`, no en su lugar).
`CANCELLED` ya está fuera de `PRODUCTION_QUEUE_FILTER` — reusa el mecanismo que `cancelQuotation` ya usa para
cancelar cotizaciones nativas, no inventa uno nuevo. Solo la rama `imported`; `native` (que ya escribía
`annulledSaleRef` + revertía a `status:'QUOTATION'` a propósito, para que la cotización vuelva a la cola) y
`orphan` (sin twin) quedan sin cambios — anclados por test anti-regresión.

**DEUDA RETRO, confirmada en prod (read-only) al cerrar este frente:** el fix es **forward-only**. Las 6
perchas `COT-FFC1-*` que ya existían de ANTES (creadas por NC, ver §0-bis) seguían calificando **6/6** para
`PRODUCTION_QUEUE_FILTER` — visibles en la cola en ese momento. `COT-FFC1-44` y `COT-FFC1-72` en particular
tenían su venta gemela (`FFC1-44`/`FFC1-72`) ya `VOIDED` desde ANTES de que este fix existiera/se desplegara,
así que la cascada nueva **nunca corrió sobre ellas**.

✅ **RETRO CERRADO (v6.56.0 + v6.59.0), hoy 0/6.** `COT-FFC1-44`/`COT-FFC1-72` se corrigieron por backfill
manual en v6.56.0 (`status→'CANCELLED'`, fuente del timestamp = `voidedAt` de la venta gemela). Las 4
restantes (`COT-FFC1-57/61/64/67`) se cancelaron en v6.59.0 al anular sus 4 NC gemelas vía el callable
real desplegado, una vez levantado en v6.58.0 el bloqueo de duplicado de movimientos que las frenaba.
Barrido re-corrido sobre la query exacta de `PRODUCTION_QUEUE_FILTER` (v6.59.0): **50 docs en cola, cero
`COT-FFC1-*`.** Ver CLAUDE.md v6.55.0/v6.56.0/v6.58.0/v6.59.0 y HANDOFF.md.

## 1. Componente principal
- `functions/src/callables/sales.ts` — callable `annulSale`, `onCall` v2 gen2, ÚNICO escritor legítimo de `sales.status → 'VOIDED'`.
- Cliente: `src/core/sales/services/salesService.ts` (export `annulSale`) — wrapper thin de `httpsCallable`, ~15 líneas, **NO hace catch/rewrap del error** (necesario para que `parseAnnulError` lea `error.details` estructurado).

## 2. Helpers puros (server-only desde v6.70.0, salvo `resolveSaleTwinPath`)
- Cliente: `src/core/sales/saleProductionLink.ts` (`resolveSaleQuotationLink`) + `src/core/sales/annulment/{resolveSaleTwinPath,parseAnnulError}.ts`. **`canAnnulSale.ts` y `buildAnnulmentCascade.ts` cliente fueron BORRADOS en v6.70.0 (`[CASCADE-DUP]`, commit `f88cbb02`)** — código muerto medido (0 consumidores en `src/` fuera de sus propios tests).
- Server: `functions/src/domain/annulment/{saleQuotationLink,canAnnulSale,resolveSaleTwinPath,buildAnnulmentCascade}.ts` — la copia server es la ÚNICA para `canAnnulSale` y `buildAnnulmentCascade`. Solo `saleQuotationLink`↔`saleProductionLink.ts` y `resolveSaleTwinPath` siguen duplicados cliente↔server, con **2 parity tests** vivos (`saleQuotationLink.parity.test.ts`, `resolveSaleTwinPath.parity.test.ts`) — antes eran 4; `canAnnulSale.parity.test.ts` y `buildAnnulmentCascade.parity.test.ts` se borraron junto con la copia cliente que comparaban.
- **Por qué duplicado y no compartido:** cross-boundary import (`functions/src/... → ../../../src/core/...`) rompe `tsc` (`TS6059`, `rootDir` de `functions/tsconfig.json`) y aunque compilara, `firebase.json` acota `source:"functions"` para el deploy — el zip nunca incluiría `../../../src/`. Mismo patrón sancionado que otros dominios (`coilProduction`, `drywallProduction`, `scrap`) — ver ADR "Dominio puro" en CLAUDE.md §10.
- `parseAnnulError.ts` es SOLO cliente (clasifica el `FunctionsError` que el SDK del browser lanza).

## 3. Stock strategies (server-side, `functions/src/domain/strategies/`)
- `types.ts` — interfaz `StockStrategy` compartida (antes vivía duplicada inline en cada strategy).
- `{metallicRoofing,drywall,roofing,trading,services}StockStrategy.ts` — 5 líneas de negocio completas. `drywallStockStrategy.ts` fue extendido ADITIVAMENTE con `writeSaleDecrement`/`writeSaleReversal` (antes solo tenía `writeProductionIncrement`) — sin romper sus consumidores existentes (`drywallProduction.ts`).
- **`writeAnnulNCDecrement`** (v6.54.0, `metallicRoofingStockStrategy.ts:101-134`) — 3ª primitiva, **OPCIONAL** en `StockStrategy` (`types.ts`) y **solo implementada en metallic** (las 12 NC de prod son 100% `metallic-roofing`, verificado). Emite `SALIDA` con el **costo CONGELADO** del ítem (`frozenCost`, no el WAC vivo — mismo principio que `writeSaleReversal`, ADR-009), y a diferencia de esa NO re-mezcla `avgCost`: lo preserva tal cual y solo recalcula `totalValue = newBalance × avgCost`. El signo lo decide el **caller** (recibe `newBalance` ya resuelto), igual que sus 2 hermanas. **Fail-safe de línea**: si una strategy no la implementa, el callable hace `continue` — nunca cae a `writeSaleReversal`, que INFLARÍA el stock (el bug exacto que este frente cierra). Hoy inalcanzable (0b del recon: las 12 NC de prod son metallic), pero blindado para cuando aparezca una de otra línea.
- `index.ts` — registry `getStockStrategy(businessLine)`, espejo del registry cliente (`src/core/sales/strategies/index.ts`).

## 3-bis. Pre-check de producción activa (v6.52.1)
- `functions/src/utils/hasActiveProductionForQuote.ts` — `(quoteId, db) => {hasActive, activeLogIds, allLogs}`.
  Query: `production_logs` where `source.id == quoteId`, **sin** filtrar `status` en la query (se clasifica
  en memoria). Campo simple sin `orderBy` ⇒ índice automático, **ningún índice nuevo**.
- **Vive en `utils/`, no en `domain/`**, porque hace I/O y `domain/` es puro (la única excepción es
  `strategies/`, justificada en su propio `types.ts`). Tampoco inline en `sales.ts`: el futuro callable
  de **Editar** consume este mismo pre-check y no debe importar desde un archivo de callable.
- Trabaja **directo sobre el `quoteId`**, sin pasar por `resolveSaleQuotationLink` — que es justo la pieza
  que clasifica el caso `self`. Delega la clasificación ACTIVE a `functions/src/domain/fulfillmentLogic.ts`
  (`hasActiveProduction`, copia pura del cliente + parity test).

## 4. Utilidad de traducción
- `functions/src/utils/translateCascadeFields.ts` — traduce los placeholders serializables que `buildAnnulmentCascade` (100% puro, sin `firebase-admin`) emite (`'SERVER_TIMESTAMP'` / `'DELETE_FIELD'` / `'ARRAY_UNION:{json}'`) a los sentinels reales (`FieldValue.serverTimestamp()`/`.delete()`/`.arrayUnion()`). **3 parámetros** — `(fields, FieldValue, Timestamp)` — con **2 inyecciones de dependencia** (`FieldValue` y, desde v6.56.0, también `Timestamp`) para poder testearse con mocks, sin `firebase-admin` real. `Timestamp` se usa SOLO dentro de un payload `ARRAY_UNION` (ver v6.56.0 abajo) — el sentinel de `FieldValue` sigue siendo lo que se usa en todo lo demás.
- ⚠️ **`FieldValue` SIEMPRE modular** (`import { FieldValue } from "firebase-admin/firestore"`), NUNCA `admin.firestore.FieldValue` (namespace clásico) — el namespace clásico resuelve `undefined` en el emulador LOCAL de Functions (aunque funciona en Cloud Functions real desplegado). Ver CLAUDE.md v6.50.0 aprendizajes.

## 5. UI
- `src/components/sales/SaleDetailsModal.tsx` — `handleAnnul`: llama `annulSale({saleId})` (sin `userEmail`, viene de `request.auth.token.email` server-side), en el `catch` usa `parseAnnulError(error)` para decidir modal vs toast.
- `src/components/sales/ProductionBlockedModal.tsx` — se dispara si `parsed.type==='production-block' && parsed.quotationId`. CTA "Ir a anular producción" navega a `/admin/lines/metallic-roofing/production/queue` (sin filtro por quote — scope futuro).
  - ⚠️ **RENOMBRADO en v6.53.0** (era `ProductionBlockedAnnulModal.tsx`): el frente EDITAR lo reusa desde la edición de cotización, y el nombre viejo mentiría. Los strings de copy pasaron a ser props opcionales cuyo **default son los textos de anular**, así que el comportamiento de `SaleDetailsModal` no cambió. `parseAnnulError` sigue siendo exclusivo de anulación — editar usa `parseEditError`, que discrimina por `activeLogIds` en vez de por `quotationId` (ver `docs/modules/ventas.md` §16.6).
- ⚠️ **DEUDA:** en un smoke real de browser (prod) el modal no disparó, cayó a toast plano — investigado a fondo (body HTTP crudo del callable + código fuente de ambos SDKs, todo correcto), sin repro, hipótesis timing de cache Vercel edge post-deploy. Ver CLAUDE.md deudas v6.50.0.

## 6. Firestore rules (`firestore.rules:73-97`, colección `sales`)
> **Actualizado 2026-08-26 (v6.66.0, commit `921eeabe`):** la condición pasó de `isStaff()`
> a `canWrite()` (ADMIN+SUPERVISOR) — OPERATOR ya no puede actualizar `sales` desde el
> cliente. El resto de la condición (guard de `status`/`VOIDED`) no cambió. Ver CLAUDE.md
> v6.66.0 para el frente completo de permisos.
```
allow update: if canWrite()
  && fieldsUnchanged(['totalAmount','subtotal','igv','exchangeRate','currency','items','paymentType'])
  && !(request.resource.data.status == 'VOIDED' && resource.data.status != 'VOIDED')
  && !(resource.data.status == 'VOIDED');
```
- `sales.status` sigue mutable client-side para OTRAS transiciones (`approveQuotation`→`CONVERTED`, `cancelQuotation`→`CANCELLED`, ambos siguen 100% client-side, sin migrar).
- Transición a `VOIDED` **candada exclusivamente al callable** (Admin SDK bypassea rules por diseño).
- Un doc ya `VOIDED` queda **terminal/congelado** — ningún campo se toca desde el cliente una vez anulado (cierra de rebote un guard débil de `approveQuotation`, que no excluía `VOIDED` explícitamente).
- Test dedicado: `src/test/rules/salesStatus.rules.test.ts` (primer uso de `@firebase/rules-unit-testing` en el repo, 4 tests). Desde v6.64.0 tiene 4 archivos hermanos (`foundation`/`locks`/`sales`/`collections`): 84 tests, 35/35 colecciones de `firestore.rules` cubiertas. El blindaje de campos financieros de `sales` (`fieldsUnchanged`) se ancla en `sales.rules.test.ts` GRUPO J.

## 7. Contratos clave (shape de escritura)
- **Error del callable:** `HttpsError(code, message, details?)`. Códigos: `unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`, `failed-precondition`. Solo `ACTIVE_PRODUCTION` (bloqueo por producción) trae `details:{quotationId, activeLogIds}` estructurado — el resto no trae `details`.
- **`annulledSaleRef` (nativa, twin path `native`):** OBJETO `{saleId, saleNumber, annulledAt, annulledBy, reason?}` — **cambio de contrato vs la versión client-side vieja**, que escribía el `saleId` como STRING plano. El test viejo que asumía el string (`annulSaleCascade.integration.test.ts`) fue borrado por obsoleto en el mismo frente.
- **`annulledSaleRefs` (importada, twin path `imported`):** ARRAY de refs (mismo shape de objeto), vía `arrayUnion` — antes el client-side no escribía NADA acá (gap real cerrado). Desde `488455d1` (v6.55.0) el MISMO write agrega `status:'CANCELLED'` a la percha (ver §0-ter) — `annulledSaleRefs` no cambió de forma, solo dejó de ser el único campo que se toca.
  - ✅ **CERRADO (v6.56.0, commits `545ee08e`+`62116ea5`).** Preexistente desde v6.50.0: `annulledSaleRefs[].annulledAt` quedaba como el STRING literal `"SERVER_TIMESTAMP"`, nunca un Timestamp real. Mecanismo: `translateCascadeFields.ts` traduce placeholders dentro de objetos anidados pero **no recorría arrays**; el campo `annulledSaleRefs` llega como el STRING `` `ARRAY_UNION:${JSON.stringify(ref)}` ``, con `ref.annulledAt` ya serializado adentro — la rama `ARRAY_UNION` hacía `JSON.parse` + `FieldValue.arrayUnion(parsed)` sin recursar sobre `parsed`. El path `native` (`annulledSaleRef`, objeto plano sin `ARRAY_UNION`) nunca tuvo el bug.
    - **Por qué el "fix candidato" original (mandar el objeto real a `arrayUnion` sin serializar) NO era viable:** un sentinel de `FieldValue.serverTimestamp()` es **ILEGAL** anidado dentro de un elemento de `arrayUnion` — el SDK lo rechaza **client-side, antes de tocar la red**. Error verbatim, verificado empíricamente contra el emulador en este frente (3 casos: A anidado en array → falla; B anidado en map → pasa; C valor concreto en array → pasa): `` Error: Element at index 0 is not a valid array element. FieldValue.serverTimestamp() cannot be used inside of an array (found in field "ts"). ``
    - **Fix real:** `translateCascadeFields` resuelve el placeholder, cuando está dentro de un `ARRAY_UNION`, a un **`Timestamp` concreto** (`Timestamp.now()`, inyectado como 3er parámetro, lazy + memoizado — un único `now()` por invocación, solo si hace falta) vía un walk recursivo genérico sobre objetos **y** arrays — no un `if` puntual sobre `annulledAt`. El path `native` (map anidado top-level) sigue usando el sentinel real de `FieldValue`: ahí SÍ es legal, y un test de no-regresión lo ancla.
    - **Backfill de prod:** 2 docs (`COT-FFC1-44`, `COT-FFC1-72`) corregidos con el `voidedAt` de su venta gemela como fuente — el mismo `FieldValue.serverTimestamp()` de la MISMA transacción de `annulSale`, coincidente al milisegundo con `audit_logs.VOID_SALE.timestamp` (restauración exacta, no estimación). Barrido final sobre las 329 ventas de prod: **0 con `annulledAt` tipo string.**
    - **REFUERZO EMPÍRICO (v6.59.0):** hasta acá la evidencia era test + backfill de 2 docs históricos. Al anular `FFC1-57/61/64/67` vía el callable real (primera corrida del fix sobre datos NUEVOS, no backfill), los 4 `annulledSaleRefs[0].annulledAt` salieron `Timestamp` real 4/4 (`annulledAtRawType:"Timestamp"`, verificado). Nota de mecanismo: `voidedAt` (venta) y `annulledAt` (ref en la percha) difieren ~30-50ms por doc — el primero es `serverTimestamp()` nativo, el segundo el `Timestamp.now()` inyectado por `translateCascadeFields` para poder vivir dentro del `arrayUnion`; es diseño, no defecto.
- **`twinPath` orphan:** solo se escribe la venta misma (`status:VOIDED`), sin twin.
- **`stockEffect`** (v6.54.0, `buildAnnulmentCascade`, ambas copias) — `'returned' | 'withdrawn' | 'none'`, **opcional, default `'returned'`** (preserva byte a byte el detalle histórico de todo lo existente). Alimenta el texto del audit: `'Stock devuelto.'` (no-NC) / `'Stock retirado.'` (NC decremento) / `'Sin efecto en stock.'` (NC money-only o cotización que nunca descontó). Antes de v6.54.0 el audit decía **siempre** `"Stock devuelto."`, hardcodeado — incluso al anular una cotización que jamás había tocado stock. La llamada a `buildAnnulmentCascade` se movió **adentro de la txn** (antes del loop de escrituras se llamaba afuera): `stockEffect` recién se conoce después de recorrer los ítems, y de paso la llamada ahora lee `saleData` (re-lectura bajo lock), no `preData` (snapshot pre-txn).
- **D3 (costos sincronizados):** `costSyncedAt`, `items[].baseCost` post-A1 (write-back de costo real de producción) NUNCA se revierten — son hechos históricos, no se tocan en la cascada de anulación.

## 8. Fixtures de test (`src/test/integration/fixtures/`)
- `seedAnnulFixtures.ts` — **11 fixtures** (F1-F11) + un doc de stock baseline, idempotentes, marcadas
  `metadata.isAnnulFixture:true`, IDs deterministas con prefijo `ANNUL-FIX-`.
  - **F1-F7** cubren native/imported/happy/block/ex-active/orphan/synced-cost. Los 7 invocan `annulSale`
    sobre una **VENTA**; ninguno sobre un doc `QUOTATION` (por eso el agujero de `self` no tenía cobertura).
  - **F8** (v6.52.1) — cotización NATIVA en `QUOTATION` con `production_log` **ACTIVE sobre sí misma**
    (`source.id == su doc.id`): es el fixture del bloqueo `self`.
  - **F9** (v6.52.1) — cotización NATIVA en `QUOTATION` **sin** logs: ancla el anulado legítimo Y el
    gate de stock fantasma.
  - **F10** (v6.54.0) — NC importada `COMPLETED` (twin `imported`, con percha propia) con
    `ncStockAction: 'RETURNS_STOCK'`: ancla el path DECREMENTO (§0-bis). Los 9 fixtures previos anulaban
    VENTAS o cotizaciones; ninguno era una NC.
  - **F11** (v6.54.0) — NC importada `COMPLETED` (twin `imported`) **sin** el campo `ncStockAction`
    (forma EXACTA de las 6 NC reales de prod): ancla el path SKIP.
  - **`stockBaseline`** (v6.52.1) — `metallic_roofing_stock/COB030ROJO` en `{quantity:100, avgCost:7.86,
    totalValue:786}`, sembrado con `set` **sin merge** para que cada test arranque del mismo número aunque
    otro lo haya movido. Antes el seeder no sembraba stock y el daño no era observable.
- `seedAnnulFixtures.cli.ts` — wrapper CLI, `npm run seed:annul-fixtures`, guard duro contra correr fuera de `ayrsteel-test`.
- ⚠️ `Timestamp.now()` de `firebase-admin/firestore` NO se usa acá — usa `new Date()` nativo, porque este módulo se importa cross-boundary desde tests de `functions/` (que tiene su PROPIA copia de `firebase-admin` en su `node_modules`) y un `Timestamp` creado con una copia del paquete no es `instanceof` el `Timestamp` que la otra copia espera al validar el write ("dual package hazard").

## 9. VERIFICAR antes de cambio grande
- ¿El caller necesita `error.details` estructurado? Si sí, el wrapper NO debe hacer `catch`/rewrap (ver `productionService.ts` como contraejemplo del patrón que NO aplica acá).
- ¿Tocaste `functions/src/callables/sales.ts`? Correr `npm run build` DE VERDAD (no solo `tsc --noEmit`) antes de `test:emu` — el emulador carga `functions/lib/` compilado, no el TypeScript fuente.
- ¿Agregaste un test con `firebase-functions-test`'s `wrap()`? Recordá que NO pasa por el runtime real — complementar con un smoke HTTP real contra el callable desplegado antes de dar algo por validado.
- `FieldValue` siempre modular (`firebase-admin/firestore`), nunca `admin.firestore.FieldValue`.
