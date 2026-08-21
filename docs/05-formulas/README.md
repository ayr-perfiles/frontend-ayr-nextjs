# Índice de Fórmulas — AYR Steel ERP

> Estado: Vigente
> Última verificación: 2026-08-20 (cierre del frente EDITAR — F-V6 y `classifyLine` actualizados; el resto del índice sigue en su verificación de 2026-07-07 · commit `71250ae6`)
> Fuente de verdad: el CÓDIGO. Este doc se valida contra él, no al revés.
> Relacionado: CLAUDE.md v6.21 §15 · `modelo-de-costeo.md` (principios) · `_TEMPLATE.md` (ficha estándar)

---

## Convenciones de estas fichas

- **Unidades:** todo monto en **PEN**, peso en **kg**, anchos/espesores en **mm**, largos en **m**. Stock metallic es MIXTO: ML (`COBERTURA_ML`) o UND (`PLANCHA_UND`).
- **Redondeo:** `pricePerKg`/`avgCost` → `toFixed(6)` · pesos → `toFixed(4)` (excepto merma: 2) · montos contables → `toFixed(2)` · WAC de compras/ajustes → `toFixed(4)`. Las inconsistencias se marcan en cada ficha, no se ocultan.
- **Costo:** cada ficha declara **CONGELADO** (lee snapshot grabado en la transacción original), **WAC-ACTUAL** (relee el promedio vivo dentro de la tx) o **N/A**. Ver los 3 principios en `modelo-de-costeo.md`.
- **Consumidores:** trazados por grep global. Ninguna ficha asume uso único.
- Cada ficha nueva usa `_TEMPLATE.md`.

## ⚠️ Drift conocido de docs

- `docs/` (dominio, seguridad, ADRs 001-008) y `docs/report/*` quedaron mayormente **congelados en Sprint 3-8** (CLAUDE.md v6.4, mayo 2026). La verdad viva es **CLAUDE.md v6.21** + el código. Ver estados por doc en `docs/README.md`.
- ADR-004 está **superseded** en su detalle de interfaz (banner en el propio ADR).
- `costeo-pvc.md` fue corregido 2026-07-07 (referencias a archivos inexistentes + fórmula de precio sugerido errónea).

---

## Tabla de fórmulas

### Coils / Metallic Roofing → [`costeo-coils.md`](./costeo-coils.md) · [`costeo-metallic-reportes.md`](./costeo-metallic-reportes.md)

| ID | Fórmula | Propósito (1 línea) | Código |
|---|---|---|---|
| F-C1 | `pricePerKg` (×3 copias) | Costo S/·kg⁻¹ al registrar bobina (USD→PEN con TC) | `functions/src/domain/coilPricing.ts:16` · `coilRegistration.ts:124` · `coilBulkRegistration.ts:114` |
| F-C2 | `validateAndCalculateSplit` | Split por ancho, peso proporcional, pricePerKg heredado | `functions/src/domain/coilPricing.ts:48` |
| F-C3 | `calcProductionFromCoils` | Conformado bobina→SKU: peso teórico por densidad + costo congelado | `functions/src/domain/coilProduction.ts:8` |
| F-C4 | WAC PT `produceFromCoils` | Re-blend del promedio del terminado (WAC-ACTUAL) | `functions/src/callables/production.ts:152` |
| F-C5 | `voidProductionFromCoils` | Anulación: devuelve peso y valor CONGELADO del breakdown | `functions/src/callables/production.ts:361,395` |
| F-C6 | `calculateScrapCost`/`calculateNewWeight` | Merma: costo congelado al pricePerKg del momento | `functions/src/domain/scrap.ts:19` |
| F-C7 | `voidCoilScrap` | Reversa de merma: `scrapCostPEN/scrapWeightKg` derivado | `functions/src/callables/scrap.ts:210` |
| F-C8 | `reverseCoilSplit` | Restaura madre (suma directa peso+ancho), hija VOIDED | `functions/src/callables/split.ts:262` |
| F-C9 | `determineCoilStatusAfterReversal` | Estado post-reversa, EPSILON 0.01 kg, 3 consumidores | `functions/src/domain/scrap.ts:40` |
| F-C10 | Guard TC USD [2,7] | Rechaza TC absurdo (×3 implementaciones mismo rango) | `bulkUploadLogic.ts:100` · callables |
| F-C11 | Guards bulk: peso [2000-7000], TON×1000, valor 2 dec | Robustez de formato UI (no hard-block backend) | `src/core/coils/bulkUploadLogic.ts:97` |
| F-C12 | densityFactor por acabado | Lookup `coil_finishes`, throw si falta (Principio 3) | `functions/src/domain/finishCompat.ts` |

### Drywall → [`costeo-drywall.md`](./costeo-drywall.md)

| ID | Fórmula | Propósito | Código |
|---|---|---|---|
| F-D1 | `calculateWeightedAverageCost` (×3 copias) | WAC del perfil terminado (`lastCostPerPiece`) | `functions/src/domain/drywallProduction.ts:3` |
| F-D2 | `calcProductionFromStrip` | Consumo de flejes por peso promedio + costo por pieza | `functions/src/domain/drywallProduction.ts:46` |
| F-D3 | `calculateEffectiveCostPerMm`/`calculateCostPerStrip` | Asignación de costo en corte, regla leftover ≤40mm | `src/modules/drywall/domain/costing.ts:17` |
| F-D4 | `calculateCuttingPlan`/`calculateScrapPerStrip` | Plan de corte + scrap prorrateado | `src/modules/drywall/domain/slitter.ts:31` |
| F-D5 | WAC `strips_stock` (cut orders) | Blend por PESO con prorrateo de servicio de corte | `src/core/coils/services/cutOrderService.ts:155` |
| F-D6 | `restoredWidth` ratio (revert) | ⚠️ Reversa client-side WAC-lookback — WRITE 7 pendiente | `src/modules/drywall/services/productionService.ts:320` |

### Roofing PVC → [`costeo-pvc.md`](./costeo-pvc.md) (corregido 2026-07-07)

| ID | Fórmula | Propósito | Código |
|---|---|---|---|
| — | CPP en ajuste manual (ENTRY) | Promedio ponderado, solo entradas | `src/modules/roofing/services/stockAdjustmentService.ts:90` (+2 copias metallic/trading) |
| — | `totalValue = quantity × avgCost` | Valorización desnormalizada | ídem + `inventoryService.ts` |

### Ventas / IGV / Compras → [`ventas-igv.md`](./ventas-igv.md)

| ID | Fórmula | Propósito | Código |
|---|---|---|---|
| F-V1 | `suggestedPrice` | Precio sugerido: `cost/(1−margin%)×(1+IGV)` — margen dinámico | `src/core/sales/components/ProductSelector.tsx:42` |
| F-V2 | IGV_RATE (deuda ×6+) | Tasa 0.18 redeclarada por archivo, sin fuente única | ver ficha |
| F-V3 | `writeSaleReversal` | Devolución NC/anulación al `frozenCost` + re-blend | `src/core/sales/strategies/index.ts:207` |
| F-V4 | WAC `registerPurchase` / `voidPurchase` | Re-blend en compra; reversa aproximada — solo roofing/trading | `src/core/purchases/service.ts:81,194` |
| F-V5 | CPP ajuste manual ×3 | Ver costeo-pvc | `stockAdjustmentService.ts` ×3 |
| F-V6 | Totales/margen/aggregates | Carrito (servicio ×2 + `cartLogic.ts` de UI), `getAggregateFromServer`, margen ×5 en reportes | `salesService.ts:89,185` · `src/core/sales/cartLogic.ts:32` · `reportFunctions.ts` |
| F-V7 | `calcPesoKg` | Unidad→kg del importador SUNAT (con fallback flageado) | `src/utils/importHelpers.ts:9` |

### Otras (sin ficha dedicada aún — código como referencia)

| Fórmula | Propósito | Código |
|---|---|---|
| `calculateExpectedPiecesByDensity` | Piezas esperadas por densidad (guard de sobreproducción ×1.05) | `src/utils/calculations.ts:10` |
| `calcCoilTheoreticalML` / `calcCoilYieldDeviation` | ML teórico y desviación de rendimiento (umbral 5%) | `src/modules/metallic-roofing/domain/yieldCalc.ts:21,34` |
| `calcCoverageWeightKg` | Peso de cobertura/plancha al vender (snapshot en carrito) | `src/modules/metallic-roofing/domain/coverageWeightCalc.ts:45` |
| `buildAluzincSalesReport` / `buildAluzincCostReport` / `buildAluzincProfitSummary` | Reportes P-M3/P-M7: S/·kg⁻¹, margen %, ganancia operativa − merma | `src/modules/metallic-roofing/domain/aluzinc*.ts` |
| `calculateTotalMermaSoles` | Suma de merma excluyendo VOIDED (in-memory, retrocompat) | `src/core/reports/services/reportFunctions.ts:867` |
| `classifyLine` | Clasificador SKU→línea del importador. ⚠️ **YA NO es definición única** (2026-08-20): tiene copia server-side con parity test | `src/core/import/catalogImport.ts:83` **+** `functions/src/domain/catalog/classifyLine.ts:38` |
| Correlativos SUNAT | Contador atómico `padStart(6,'0')` | `functions/src/services/correlative.ts:8` |
