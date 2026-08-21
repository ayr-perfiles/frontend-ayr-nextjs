# Patrones y Convenciones — Estado Real (no aspiracional)

> Estado: Vigente
> Última verificación: 2026-08-20 (§3 re-verificada al cierre del frente EDITAR — los 13 pares de paridad chequeados uno por uno contra los `import` de sus tests; el resto del doc sigue en su verificación de 2026-07-07 · commit `71250ae6`)
> Fuente de verdad: el CÓDIGO. Este doc se valida contra él, no al revés.
> Relacionado: CLAUDE.md v6.21 §8, §10, §11 · ADR-003/004/009/010/011 · docs/05-formulas/

Este doc lista cada patrón núcleo con su regla, dónde se cumple y — honestamente — **dónde NO** (excepciones reales verificadas por grep al commit de cabecera). Las excepciones son deuda conocida, no permiso para agregar más.

---

## 1. Strategy por línea de negocio (`getStockStrategy`)

**Regla:** toda operación de stock dependiente de línea pasa por `getStockStrategy(businessLine)` (`src/core/sales/strategies/index.ts:576`). Prohibido `if/else`/`switch` por línea en código compartido.

**✅ Se cumple en:**
- `src/core/sales/services/salesService.ts` — 6 call sites, cero branching directo.
- `src/core/coils/services/coilConsumptionService.ts:41` — una resolución, reuso del objeto.

**⚠️ EXCEPCIONES (5 leaks verificados):**

| # | Archivo:línea | Qué hace |
|---|---|---|
| 1 | `src/core/import/importDispatcher.ts:25-126` | `switch(line)` completo para shaping de catálogo en import, llama `createProduct` de cada módulo por caso |
| 2 | `src/app/admin/sales/import/page.tsx:498-547` | Ternary de nombre de colección + cadena if/else por línea, escribe con `setDoc` crudo bypasseando strategies y catalogServices |
| 3 | `src/components/purchases/PurchaseItemSelector.tsx:26` | `businessLine === 'roofing' ? 'roofing_catalog' : 'trading_catalog'` — hardcodea 2 líneas en el type |
| 4 | `src/core/purchases/service.ts:19-30` | `LINE_CONFIG`: segundo mapa de colecciones, paralelo a getStockStrategy e incompleto (2/5 líneas — compras de metallic/drywall/services THROWean) |
| 5 | `src/app/admin/coils/finishes/page.tsx:127` | `line === 'drywall' ? 0.00785 : 0.008` — constante física por ternary en vez del lookup `coil_finishes` |

**Nota adicional:** el ADR-004 documenta una interfaz `StockStrategy` vieja (1 método, 2 líneas) — superseded; la viva tiene 6 métodos y 5 líneas en un solo archivo.

---

## 2. Thin-client / Fat-backend (writes de negocio en Callables)

**Regla:** los writes críticos van a Cloud Functions callables; el cliente es thin (arma payload, muestra resultado). Migración en curso (WRITEs 1-9, CLAUDE.md roadmap).

**✅ Migrado y validado en prod:** `registerCoil(sBulk)`, `registerCoilSplit`, `reverseCoilSplit`, `voidCoil`, `updateCoil`, `cancelCoilPlan`, `produceFromCoils`, `produceFromStrip`, `registerCoilScrap`, `voidCoilScrap`, `deleteCoilDraft`, `voidProductionFromCoils` (metallic, v6.21).

**⚠️ EXCEPCIONES (writes de negocio aún client-side):**
- **Ventas completas** (`processSale`/`approveQuotation`/`annulSale`, `src/core/sales/services/salesService.ts`) + NC del importador — WRITE 9 pendiente. Corolario: las rules FASE 2 de `sales`/`*_stock` no se pueden candar.
- **`revertProductionLog` drywall** (`src/modules/drywall/services/productionService.ts`) — WRITE 7 drywall pendiente; además usa WAC-lookback, no costo congelado (ver `costeo-drywall.md` F-D6).
- **`saveCuttingPlan` / cut orders** (`cuttingPlanService`, `cutOrderService`) — WRITE 8 pendiente.
- **`registerPurchase`/`voidPurchase`** (`src/core/purchases/service.ts`) — client-side runTransaction.
- **Ajustes manuales de stock ×3** (`stockAdjustmentService.ts` de roofing/metallic/trading) — client-side.
- **`processSingleStrip`** (`productionService.ts:99`, marcado `@deprecated`) — write path paralelo a `produceFromStrip`, todavía presente en el bundle.
- **Código muerto backend:** `functions/src/domain/strategies/metallicRoofingStockStrategy.ts` tiene `writeSaleDecrement`/`writeSaleReversal` que NINGÚN callable consume (preparación de WRITE 9). Numéricamente iguales a la copia cliente hoy, pero sin SYNC-MARKER ni test de paridad → riesgo de drift silencioso.

**Nota (no violación):** los previews de UI (`SplitCoilModal`, `RegisterScrapModal`, `production/new`) recomputan la fórmula de dominio client-side ANTES de invocar el callable. Es ejecución duplicada legítima (UX), no un write path — pero exige mantener la paridad de las copias.

---

## 3. Dominio puro + paridad cliente↔backend (SYNC-MARKER + test)

**Regla:** la lógica de cálculo vive en funciones puras (`functions/src/domain/` como canónico); si el cliente necesita la misma fórmula (preview), se mantiene copia con `// SYNC-MARKER` + test de paridad que importa ambas.

**✅ Pares con SYNC-MARKER + test de paridad** *(tabla completada 2026-08-20 — le faltaban los 4 dominios agregados entre v6.50.0 y v6.53.0)*:

| Backend (`functions/src/domain/`) | Cliente | Test | Desde |
|---|---|---|---|
| `coilPricing.ts` | `src/core/coils/domain/coilPricing.ts` | `coilPricing.test.ts` | — |
| `coilProduction.ts` | `src/modules/metallic-roofing/domain/coilProduction.ts` | `coilProduction.parity.test.ts` | — |
| `drywallProduction.ts` | `src/modules/drywall/domain/drywallProduction.ts` | `drywallProduction.parity.test.ts` | — |
| `scrap.ts` | `src/core/coils/domain/scrap.ts` | `scrap.test.ts` (paridad solo `validateScrapRequest`) | — |
| `finishCompat.ts` | `src/core/coils/domain/finishCompat.ts` | tests propios | — |
| `annulment/saleQuotationLink.ts` | `src/core/sales/saleProductionLink.ts` | `annulment/__tests__/saleQuotationLink.parity.test.ts` | v6.50.0 |
| `annulment/canAnnulSale.ts` | `src/core/sales/annulment/canAnnulSale.ts` | `annulment/__tests__/canAnnulSale.parity.test.ts` | v6.50.0 |
| `annulment/resolveSaleTwinPath.ts` | `src/core/sales/annulment/resolveSaleTwinPath.ts` | `annulment/__tests__/resolveSaleTwinPath.parity.test.ts` | v6.50.0 |
| `annulment/buildAnnulmentCascade.ts` | `src/core/sales/annulment/buildAnnulmentCascade.ts` | `annulment/__tests__/buildAnnulmentCascade.parity.test.ts` | v6.50.0 |
| `fulfillmentLogic.ts` (`hasActiveProduction`) | `src/core/production/fulfillmentLogic.ts` | `__tests__/fulfillmentLogic.parity.test.ts` | v6.52.1 |
| `quotation/buildQuotationDoc.ts` (`buildSaleDoc` + `buildQuotationDoc`) | `src/core/sales/domain/saleDocBuilder.ts` | `quotation/__tests__/buildQuotationDoc.parity.test.ts` | **v6.53.0** |
| `quotation/isImportedQuotation.ts` | `src/core/import/salesImportLogic.ts:9` | `quotation/__tests__/isImportedQuotation.parity.test.ts` | **v6.53.0** |
| `catalog/classifyLine.ts` | `src/core/import/catalogImport.ts:83` | `catalog/__tests__/classifyLine.parity.test.ts` | **v6.53.0** |

**Los 4 bloqueos al import cross-boundary** (por qué se duplica en vez de importar de `src/`): `rootDir`/`TS6059` · `firebase.json source:"functions"` acota el deploy · el alias `@/` (functions no declara `paths`) · y —descubierto en v6.53.0— **un import de módulo pesado en el archivo origen**: `catalogImport.ts:1` importa `xlsx` a nivel de módulo, así que traer `classifyLine` de ahí arrastraría el paquete entero al bundle del callable. Por eso se porta la **función**, nunca el archivo.

**⚠️ Excepciones deliberadas (NO son gaps):**
- `parseAnnulError.ts` / `parseEditError.ts` son **solo cliente** — clasifican el `FunctionsError` que lanza el SDK del browser, no tienen sentido server-side.
- `hasActiveProductionForQuote` vive en `functions/src/utils/`, **no** en `domain/`: hace I/O (query a `production_logs`), y `domain/` es puro. Precedente: `translateCascadeFields.ts`.
- `calcCoverageWeightKg` **no** se copió con el builder y no falta: el builder nunca calcula peso, solo lee `calculatedWeight` y hace passthrough de `weightSnapshot`.

**⚠️ GAPS:**
- **`canAnnulSale` cliente tiene 0 consumidores** — existe únicamente como fuente de paridad de la copia server. Se mantiene en sync a mano en cada cambio. Candidata a borrado si nunca se cablea (ver deudas de v6.52.1).
- `calculateWeightedAverageCost` tiene una **tercera copia** en `src/modules/drywall/domain/costing.ts:54` sin SYNC-MARKER ni test cruzado.
- El WAC de `produceFromCoils` está inline en el callable (`production.ts:152-157`), no extraído a domain ni testeado como dominio.
- `computePricePerKg` (domain) no es llamada por los callables — estos llevan copias inline (F-C1).
- `determineCoilStatusAfterReversal` es backend-only a propósito (copia cliente borrada) — OK, pero documentarlo evita que alguien la "recree".

---

## 4. runTransaction: lee-antes-de-escribir · idempotente · append-only · CERO borrado físico

**Regla:** toda mutación de stock en `runTransaction` con TODAS las lecturas antes de la primera escritura; reversas idempotentes (re-invocar = no-op con error limpio); `audit_logs` y `*_movements`/`kardex_movements` append-only (update/delete `if false` para todos); nunca `delete` físico — `status: VOIDED`.

**✅ Se cumple** en todos los callables verificados (`production.ts`, `scrap.ts`, `split.ts`, `coilManagement.ts`, `drywallProduction.ts`, `coilRegistration.ts`, `coilBulkRegistration.ts`) y en los servicios cliente transaccionales.

**Excepción única y diseñada:** `transaction.delete(coilRef)` en `deleteCoilDraft` (`functions/src/callables/coilManagement.ts:337`) — borrado físico SOLO de borrador inerte (VOIDED + cero movimientos, 6 guards). Es la única llamada delete en `functions/src/callables/*` (verificado por grep).

**Matiz (no violación estricta):** `reverseCoilSplit` lee `child.pricePerKg` ANTES de abrir la transacción (`split.ts:273`) y lo reusa adentro — seguro solo porque `pricePerKg` es inmutable post-creación. No copiar el patrón para campos mutables.

---

## 5. Auth claim-only (RBAC por custom claim, sin bypass)

**Regla:** rol SIEMPRE por `request.auth.token.role` (custom claim). Prohibido bypass por dominio de email en prod (`@ayrsteel.com` es dominio real). Gate de cliente = UX, nunca seguridad.

**✅ Se cumple:** los 7 archivos de callables verifican `request.auth.token.role` (grep 7/7). `@ayrsteel.com`/`@example.com` solo aparecen en tests de integración (emulador). El bypass histórico fue eliminado en v6.11 (commit `837cca82`) y nunca llegó a prod.

**⚠️ Guards solo-cliente (por diseño, documentados):**
- Guard de peso [2000-7000] kg del bulk: UI-only intencional (backend solo `weight > 0`) — no es agujero, es decisión (bobina atípica legítima).
- Guard TC [2,7]: el backend SÍ lo replica (inline), pero no comparte el helper `isValidUsdExchangeRate` con el cliente.
- Rules FASE 2 (`sales.status`, `coils` weight/status, `*_stock`) siguen relajadas hasta migrar los writes restantes — multi-sprint, ver CLAUDE.md §8.4.

---

## 6. Fallo ruidoso vs fallback silencioso

**Regla:** dato mal formado → throw / badge visible / fila inválida. NUNCA inventar un número (el TC 3.75 está muerto; densidad sin acabado → throw).

**✅ Se cumple:** `/api/tipo-cambio` en fallback no emite número (`route.ts:49-51`) · densityFactor lookup con throw · `parseCoilDescription` emite null+flag, jamás adivina color · `parseWeightToKg` devuelve null (fila inválida) ante unidad no resolvible · `getKardexMovementDisplay` cae a gris ruidoso + warn.

**⚠️ EXCEPCIONES (fallbacks silenciosos reales):**
| Archivo:línea | Fallback |
|---|---|
| `src/utils/importHelpers.ts:36-44` (`calcPesoKg`) | UM desconocida → calcula como UNIDAD con solo un `flag` de warning (no bloquea); UM vacía → ni flag |
| `src/core/sales/strategies/index.ts:211` (`writeSaleReversal` ×3) | `totalValue` faltante → `currentQty × currentAvgCost` sin advertir; `frozenCost ?? 0` devuelve stock a costo 0 sin ruido |
| `src/core/purchases/service.ts:199` (`voidPurchase`) | WAC inverso negativo → mantiene costo actual (`// Fallback por si acaso`) |
| `src/core/reports/services/reportFunctions.ts:240` | yield con 1200mm mágico, `// Simplificado` |

---

## 7. Unidades y moneda únicas

**Regla:** todo monto en PEN, todo peso en kg (TON→×1000 al ingresar, nunca adivinar factor). USD→PEN con TC real del día. Redondeos: ver convenciones en `docs/05-formulas/README.md`.

**✅ Consistente** en los flujos vivos. **⚠️ Deudas:** dos conversores unidad→kg sin helper común (`calcPesoKg` vs `parseWeightToKg`, semánticas distintas a propósito); redondeo de WAC inconsistente entre capas (4 vs 6 decimales); IGV_RATE ×6 (ver `ventas-igv.md` F-V2).

---

## Resumen de deuda por patrón (para el backlog)

1. Strategy: 5 leaks (arriba §1).
2. Thin-client: WRITEs 7 (drywall), 8 (cutOrder), 9 (sales) pendientes + `processSingleStrip` deprecated vivo + strategy backend muerta sin paridad.
3. Paridad: 3ª copia de WAC drywall; WAC metallic inline sin test; `computePricePerKg` no consumida.
4. Fallbacks: `calcPesoKg`, `writeSaleReversal` totalValue/frozenCost, `voidPurchase`.
5. Constantes muertas: `IGV_RATE_PERU`, `SCRAP_WEIGHT_FACTOR_KG_MM`, `MIN_MARGIN_PERCENT`, `LOW_STOCK_THRESHOLD_*`, `MIN/MAX_STRIP_WIDTH_MM` (`src/domain/steel/constants.ts`, cero consumidores).
