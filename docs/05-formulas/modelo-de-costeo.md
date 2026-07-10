# Modelo de Costeo — Principios Transversales

> Estado: Vigente
> Última verificación: 2026-07-07 · commit `71250ae6`
> Fuente de verdad: el CÓDIGO. Este doc se valida contra él, no al revés.
> Relacionado: CLAUDE.md v6.21 §3, §10, §11 (Convenciones) · ADR-009 (costo congelado) · ADR-004 (Strategy, superseded en detalle)

Este documento ata conceptualmente todas las fichas de `docs/05-formulas/`. Son **3 principios**; cada fórmula del sistema aplica exactamente uno de ellos (o es N/A por ser validación pura).

---

## Principio 1 — Costo CONGELADO en toda reversa (nunca WAC actual)

**Regla:** al anular/revertir cualquier transacción (producción, merma, split), el costo que se devuelve es el que se **grabó en el momento de la transacción original**, nunca el costo promedio o `pricePerKg` vigente al momento de la reversa.

**Riesgo que evita:** el WAC del producto terminado y el `pricePerKg` de una bobina **pueden mutar** entre la transacción y su reversa (nuevas producciones re-blendan el WAC; una corrección de datos puede tocar `pricePerKg`). Si la reversa releyera el costo actual, devolvería un monto distinto al que salió → el ledger deja de cuadrar y el inventario acumula error contable silencioso. Validado en runtime prod (v6.21): se mutó `pricePerKg` a 9.99 post-producción y la reversa devolvió el costo original 4/5.

**Dónde aplica (con la línea que lo prueba):**

| Reversa | Costo congelado leído de | Prueba |
|---|---|---|
| `voidProductionFromCoils` | `production_logs.perCoilBreakdown[].costPEN / weightConsumedKg` | `functions/src/callables/production.ts:368` |
| `voidCoilScrap` | `scrap_logs.scrapCostPEN / scrapWeightKg` (se deriva; el scrap_log no guarda pricePerKg) | `functions/src/callables/scrap.ts:210` |
| `reverseCoilSplit` | `child.pricePerKg` (invariante: nunca muta post-creación) | `functions/src/callables/split.ts:273` |
| `writeSaleReversal` (NC/anulación de venta, cliente) | `frozenCost` del item de venta | `src/core/sales/strategies/index.ts:214` |

**Excepción conocida (deuda):** `voidPurchase` (`src/core/purchases/service.ts:194-199`) hace un WAC inverso **aproximado** — el propio código lo admite en comentario ("mantenemos el costo actual para no complicar el promedio histórico") y tiene fallback a costo actual si el resultado da negativo. No es costo congelado limpio. Ver `ventas-igv.md`.

**Excepción conocida (deuda, WRITE 7 drywall pendiente):** `revertProductionLog` (drywall, client-side, `src/modules/drywall/services/productionService.ts`) usa WAC-lookback (busca el `costPerPiece` del log ACTIVO anterior), no el costo congelado del propio log. Decisión de alineación pendiente (HANDOFF opción 3).

---

## Principio 2 — WAC ACTUAL en producción y compra (re-blend)

**Regla:** al **ingresar** stock (producción o compra), el costo promedio del SKU se recalcula mezclando el valor de inventario vigente con el costo del lote nuevo:

```
newAvgCost = (currentQty × currentAvgCost + costoLoteNuevo) / (currentQty + qtyNueva)
```

El `currentAvgCost` se relee **dentro de la transacción** (es el promedio vivo, no un snapshot histórico). El costo del lote nuevo, en cambio, sí viene congelado de su origen (ej. `pricePerKg` de las bobinas consumidas).

**Dónde aplica:**

| Operación | Implementación | Prueba |
|---|---|---|
| `produceFromCoils` (metallic, backend) | inline en callable | `functions/src/callables/production.ts:152-157` |
| `produceFromStrip` (drywall, backend) | `calculateWeightedAverageCost` | `functions/src/domain/drywallProduction.ts:3-17` |
| `registerPurchase` (roofing/trading, cliente) | inline | `src/core/purchases/service.ts:85-93` |
| Ajuste manual ENTRY (roofing/metallic/trading, cliente) | inline ×3 copias | `stockAdjustmentService.ts` de cada módulo |
| `receiveStrips` (cut orders, cliente) | WAC por **peso** (no por cantidad) | `src/core/coils/services/cutOrderService.ts:203-205` |

⚠️ **Deuda:** existen 5+ implementaciones independientes de este mismo re-blend sin helper compartido (ver fichas y CLAUDE.md §11 Backlog).

---

## Principio 3 — Densidad ÚNICA por acabado (`coil_finishes`, lookup, throw si falta)

**Regla:** el `densityFactor` de una bobina se hereda **siempre** por lookup de la colección viva `coil_finishes` (llave = acabado). Nunca se hardcodea; si el acabado no existe o no tiene factor → fallo ruidoso (throw), nunca fallback silencioso.

**Valores vivos (test = prod, confirmado v6.13):** `GALV` 0.00785 · `ALU-NATURAL` 0.00785 · `ALU-AZUL`/`ALU-BLANCO`/`ALU-ROJO`/`ALU-VERDE`/`ALU-GRIS` 0.008.

**Nota de unidades:** `densityFactor` ya incorpora la conversión de unidades — la fórmula peso↔ML **no divide por 1000** (comentario explícito en `functions/src/domain/coilProduction.ts` y `src/modules/metallic-roofing/domain/coverageWeightCalc.ts`).

**Excepción conocida (leak):** `src/app/admin/coils/finishes/page.tsx:127` tiene un ternary inline `line === 'drywall' ? 0.00785 : 0.008` como default de UI al crear un acabado — branching por línea fuera del lookup. Ver `docs/03-arquitectura/patrones-y-convenciones.md`.

---

## Relación peso ↔ ML ↔ UND por `ProductKind`

La unidad del stock de metallic-roofing es **MIXTA** según `ProductKind` (derivado de `family` vía `coverageMetadataParser.ts`):

| ProductKind | Unidad de `quantity` | `avgCost` en | Conversión |
|---|---|---|---|
| `COBERTURA_ML` | ML (metros lineales) | S/·ML⁻¹ | `declared` = ML directo |
| `PLANCHA_UND` | UND (planchas) | S/·UND⁻¹ | `mlFromCoil = declared × lengthM` |

**Fórmula base peso↔ML (única en todo el sistema):**

```
pesoKg = ML × thicknessMm × widthMm × densityFactor
ML     = pesoKg / (thicknessMm × widthMm × densityFactor)
```

Implementaciones: `calcProductionFromCoils` (`functions/src/domain/coilProduction.ts:45`), `calcCoilTheoreticalML` (`src/modules/metallic-roofing/domain/yieldCalc.ts:21-32`), `calcCoverageWeightKg` (`coverageWeightCalc.ts:45-82`), `calculateExpectedPiecesByDensity` (`src/utils/calculations.ts:10-35`, drywall: agrega `÷ pieceLengthM` y `Math.floor`).

---

## Mapa fórmula → principio

| Fórmula | Ficha | Principio |
|---|---|---|
| `computePricePerKg` / inline en register* | costeo-coils | N/A (creación; produce el snapshot que luego se congela) |
| `validateAndCalculateSplit` | costeo-coils | 1 (pricePerKg heredado sin recalcular) |
| `calcProductionFromCoils` | costeo-coils | 1 (consume `coil.pricePerKg` congelado) + 3 (densityFactor) |
| WAC PT en `produceFromCoils` | costeo-coils | 2 |
| `voidProductionFromCoils` | costeo-coils | 1 (bobinas) + recalc de `avgCost` PT tras restar valor congelado |
| `calculateScrapCost` / `voidCoilScrap` | costeo-coils | 1 |
| `reverseCoilSplit` | costeo-coils | 1 |
| `determineCoilStatusAfterReversal` | costeo-coils | N/A (estado, no costo) |
| Guard TC [2,7] / peso [2000-7000] | costeo-coils | N/A (validación) |
| `calculateWeightedAverageCost` (drywall) | costeo-drywall | 2 |
| `calculateEffectiveCostPerMm` / `calculateCostPerStrip` | costeo-drywall | N/A (asignación de costo en corte) |
| `restoredWidth` ratio (revert drywall) | costeo-drywall | ⚠️ viola 1 (WAC-lookback, WRITE 7 pendiente) |
| CPP roofing/metallic/trading (ajuste manual) | costeo-pvc | 2 |
| `registerPurchase` WAC | ventas-igv | 2 |
| `voidPurchase` | ventas-igv | ⚠️ aproximación de 1 |
| `writeSaleReversal` | ventas-igv | 1 |
| `suggestedPrice` / IGV | ventas-igv | N/A (pricing comercial) |
