# Fórmulas de Costeo — Drywall (Flejes y Perfiles)

> Estado: Vigente
> Última verificación: 2026-07-07 · commit `71250ae6`
> Fuente de verdad: el CÓDIGO. Este doc se valida contra él, no al revés.
> Relacionado: CLAUDE.md v6.21 §11 (Convenciones) · ADR-009 · `modelo-de-costeo.md` · HANDOFF (WRITE 7 drywall pendiente)

Flujo: bobina → plan de corte (slitter) → flejes (`strips_stock`) → producción de perfiles (`inventory_stock`, campo WAC = `lastCostPerPiece`).

---

## F-D1 · `calculateWeightedAverageCost` — WAC de perfil terminado

**Propósito:** re-blend del costo promedio por pieza al ingresar un lote de producción (Principio 2).

**Notación:**
```
newAvgCost = (currentQty × currentAverageCost + batchTotalCost) / (currentQty + newPieces)
caso borde: currentQty ≤ 0 → batchTotalCost / newPieces
```

**Implementación — ⚠️ DEUDA: TRES copias con relaciones distintas:**

| # | Archivo | Relación |
|---|---|---|
| 1 | `functions/src/domain/drywallProduction.ts:3-17` | Backend canónico (usado por `produceFromStrip`) |
| 2 | `src/modules/drywall/domain/drywallProduction.ts:3-17` | Gemelo cliente con `// SYNC-MARKER` + test de paridad (`drywallProduction.parity.test.ts`). Byte-idéntico. Su `calcProductionFromStrip` no tiene consumidor cliente vivo — existe para el test de paridad. |
| 3 | `src/modules/drywall/domain/costing.ts:54-68` | **Tercera copia SIN SYNC-MARKER ni test cruzado** con las otras dos. Mismo nombre, mismo cuerpo. Consumida por `productionService.ts:158` (`processSingleStrip`, `@deprecated` pero presente). Si alguien edita una, las otras divergen en silencio. |

```typescript
export function calculateWeightedAverageCost(params: {
  currentQty: number; currentAverageCost: number;
  batchTotalCost: number; newPieces: number;
}): number {
  const { currentQty, currentAverageCost, batchTotalCost, newPieces } = params;
  if (currentQty <= 0) { return batchTotalCost / newPieces; }
  const inventoryValueBefore = currentQty * currentAverageCost;
  return (inventoryValueBefore + batchTotalCost) / (currentQty + newPieces);
}
```

**Costo:** WAC-ACTUAL — `currentAverageCost` = `inventory_stock/{sku}.lastCostPerPiece` releído dentro de la tx (`functions/src/domain/drywallProduction.ts:5,9,15,69` — corregido `[DOCS-STALE-SWEEP]` PASO 3, apuntaba al archivo hermano `callables/` en vez de `domain/`).
**Nota de campo:** en drywall el WAC vive en `lastCostPerPiece` (nombre heredado), no en `avgCost` como las otras líneas.

---

## F-D2 · `calcProductionFromStrip` — producción de perfiles desde flejes

**Notación:**
```
avgWeight        = stripStock.totalWeight / stripStock.totalStrips
consumedWeightKg = stripsUsed × avgWeight
consumedCostPEN  = stripsUsed × (avgCostPerKg × avgWeight)
costPerPiece     = consumedCostPEN / pieces
reportedWeightKg = pieces × standardWeight
```

**Implementación:** `functions/src/domain/drywallProduction.ts:46-83` (gemelo cliente SYNC-MARKER)
```typescript
const avgWeight = stripStock.totalWeight / stripStock.totalStrips;
const consumedWeightKg = stripsUsed * avgWeight;
const consumedCostPEN = stripsUsed * (stripStock.avgCostPerKg * avgWeight);
const reportedWeightKg = pieces * (product.standardWeight || 0);
const costPerPiece = consumedCostPEN / pieces;
```

**Entradas:** `stripStock.totalWeight` (kg) / `totalStrips` (unid) / `avgCostPerKg` (S/kg, ver F-D5) · `standardWeight` (kg/pieza, catálogo).
**Salida:** kg `toFixed(4)`, costo por pieza `toFixed(6)`.
**Costo:** el fleje se consume a su `avgCostPerKg` vigente (WAC de strips_stock); el PT se re-blenda con F-D1.
**Casos borde:** throw si `pieces ≤ 0`, `stripsUsed ≤ 0`, o strip stock inválido/agotado.
**Consumidores:** `functions/src/callables/drywallProduction.ts:83` (`produceFromStrip`). La copia cliente no tiene consumidor vivo (solo parity test).

---

## F-D3 · `calculateEffectiveCostPerMm` / `calculateCostPerStrip` — asignación de costo en el corte (regla leftover ≤ 40mm)

**Propósito:** repartir el costo total de la bobina entre los flejes planificados. Si el sobrante de ancho es chico (≤ 40mm) no tiene valor de rescate y NO absorbe costo: todo el costo va al ancho planificado.

**Notación:**
```
leftover = masterWidth − totalPlannedWidth
base     = (0 < leftover ≤ 40mm) ? totalPlannedWidth : masterWidth
costPerMm    = totalCoilCost / base
costPerStrip = stripWidth × costPerMm
```

**Implementación:** `src/modules/drywall/domain/costing.ts:17-39` (**solo cliente — sin equivalente en functions/src**)
```typescript
export function calculateEffectiveCostPerMm(totalCoilCost, masterWidth, totalPlannedWidth) {
  const leftoverWidth = masterWidth - totalPlannedWidth;
  const isSmallLeftover = leftoverWidth > 0 && leftoverWidth <= LEFTOVER_THRESHOLD_MM;
  return totalCoilCost / (isSmallLeftover ? totalPlannedWidth : masterWidth);
}
export function calculateCostPerStrip(stripWidth, effectiveCostPerMm) {
  return Number((stripWidth * effectiveCostPerMm).toFixed(2));
}
```

**Entradas:** `totalCoilCost` = `initialWeight × pricePerKg` (PEN) · anchos en mm · `LEFTOVER_THRESHOLD_MM = 40` (`src/domain/steel/constants.ts:48`).
**Salida:** S/mm; costo por fleje `toFixed(2)`.
**Costo:** N/A (asignación, no promedio).
**Consumidores:** `slitter.ts:57,70` (`calculateCuttingPlan`) → `productionService.ts:77` (`saveCuttingPlan`, write cliente) · tests `costing.test.ts`.
**Paridad:** **GAP total** — el plan de corte (cutOrder / WRITE 8) aún no migró a backend; esta fórmula solo existe client-side.

---

## F-D4 · `calculateCuttingPlan` / `calculateScrapPerStrip` — plan de corte

**Implementación:** `src/modules/drywall/domain/slitter.ts:31-75` y `:88-104`
```typescript
const totalPlannedWidth = items.reduce((sum, item) => sum + item.stripWidth * Number(item.quantity), 0);
if (totalPlannedWidth > masterWidth) { throw new Error("El ancho total de los flejes supera el ancho de la bobina."); }
// scrap prorrateado:
return (masterWidth - totalPlannedWidth) / totalStripCount;
```
**Unidades:** mm; scrap por fleje en mm (trazabilidad en production_logs).
**Consumidores:** `productionService.ts:77` (plan) y `:165` (`processSingleStrip`) · tests `slitter.test.ts`.
**Paridad:** solo cliente (mismo GAP que F-D3).

---

## F-D5 · WAC de `strips_stock` al recibir flejes (cut orders)

WAC ponderado por **peso** (no por cantidad), con prorrateo del costo de servicio de corte por peso enviado. Ver ficha completa en `costeo-coils.md` no — vive acá por ser insumo drywall:

**Implementación:** `src/core/coils/services/cutOrderService.ts:155-205` (recepción) y `:328-341` (ajuste por factura)
```typescript
// El costo de SERVICIO sí se convierte: `gravada` viene crudo de la factura del tercero.
const serviceCostPEN = invoice.gravada * invoice.exchangeRate;
// El costo de MATERIAL NO se reconvierte: `pricePerKg` ya está en PEN (invariante Mundo A).
const materialCostPEN = coilInfo.sentWeight * coil.pricePerKg;
const proportionalServiceCost = serviceCostPEN * (coilInfo.sentWeight / sentWeightTotal);
const totalCoilCostPEN = materialCostPEN + proportionalServiceCost;
const costPerKgUtil = coilReceivedWeight > 0 ? totalCoilCostPEN / coilReceivedWeight : 0;
// blend:
const newAvgCostPerKg = newTotalWeight > 0
  ? ((currentStock.totalWeight * currentStock.avgCostPerKg) + (strip.weight * costPerKgUtil)) / newTotalWeight
  : 0;
```
**Costo:** WAC-ACTUAL sobre `strips_stock` (Principio 2), con costo de material congelado (`coil.pricePerKg`).
**Paridad:** solo cliente — cutOrder es WRITE 8 pendiente ("el monstruo", CLAUDE.md roadmap).

> **Corregido (batch `chore/batch-cleanup`, ítem 19): doble conversión USD→PEN del costo de material.**
> Esta ficha documentaba —sin flaggearlo— un `if (coil.metadata?.currency === 'USD') materialCostPEN *= coil.metadata.exchangeRate`
> que violaba el invariante **Mundo A** (v6.42): `computePricePerKg` (`coilPricing.ts:16-22`) ya aplica el TC al
> registrar la bobina, así que `coil.pricePerKg` **siempre está en PEN**. Volver a multiplicarlo inflaba el costo de
> material ~TC veces (≈3.4×) y ese número contaminaba `costPerKgUtil` → `strips_stock.avgCostPerKg`.
> El recálculo por cambio de factura (`:328-341`) nunca tuvo el bug: solo usa `invoice.exchangeRate`.
> **Sin dato corrupto en prod** (recon del ítem 16: 1 sola `cut_order`, ANULADA, sobre bobina PEN; `strips_movements` en 0),
> pero con 54 bobinas USD en catálogo la precondición ya existía. Anclado por
> `src/test/integration/cutOrderCost.integration.test.ts` (3 tests: USD, PEN de no-regresión, y USD + servicio en USD
> que fija que la conversión del servicio sí se preserva).

---

## F-D6 · `restoredWidth` ratio — reversa de producción drywall coil-directo

> ⚠️ **Reescrito `[DOCS-STALE-SWEEP]` PASO 3 (v6.74.0) — la ficha anterior describía una implementación client-side que ya no existe.** WRITE 7 drywall cerró en **v6.23** (WRITE 7b): la reversa migró a callable server-side, y el costo restaurado es **congelado** (violaba el Principio 1 en la versión vieja; la versión real desde v6.23 lo cumple). Ver CLAUDE.md v6.23 (línea 545) y `[DOCS-STALE-SWEEP]` PASO 3 A1.

**Propósito:** al anular un log de producción drywall "coil-directo" (bypasea el pool de flejes), devolver peso a la bobina proporcional al ancho usado y descontar el costo **congelado** del log del valor de PT.

**Notación:**
```
restoredWeight  = totalUsedWidth × (initialWeight / masterWidth)
coilNewWeight   = min(initialWeight, currentWeight + restoredWeight)
newQuantity     = ptStock.totalQuantity − log.piecesProduced
newLastCostPerPiece = (ptStock.totalQuantity × ptStock.lastCostPerPiece − log.stripCost) / newQuantity   (si newQuantity > 0)
```

**Implementación:** callable `revertProductionLog` (`functions/src/callables/drywallProduction.ts:206`, ADMIN-only) invoca el dominio puro `calcRevertProductionFromCoil` (`functions/src/domain/drywallProduction.ts:130-171`):
```typescript
const restoredWeight = log.totalUsedWidth * (coil.initialWeight / coil.masterWidth);
const coilNewWeight = Math.min(coil.initialWeight, coil.currentWeight + restoredWeight);

const newQuantity = ptStock.totalQuantity - log.piecesProduced;
let newLastCostPerPiece = ptStock.lastCostPerPiece;
if (newQuantity > 0) {
  const ptValueBefore = ptStock.totalQuantity * ptStock.lastCostPerPiece;
  const newValue = ptValueBefore - log.stripCost;
  newLastCostPerPiece = newValue / newQuantity;
} else {
  negativeStockWarning = true;
}
```

**Costo:** CONGELADO — `log.stripCost` es el costo guardado en el propio `production_log` al momento de producir; se resta directo de `ptValueBefore`, **nunca se recalcula contra un WAC vivo**. Cumple el Principio 1. `approximateWeight: true` marca que el `initialWeight/masterWidth` ratio sigue asumiendo proporcionalidad (un split posterior de la bobina podría romperla — deuda menor, no bloqueante). `negativeStockWarning: true` si `newQuantity <= 0` — congela `lastCostPerPiece` en vez de dividir por cero o negativo (mismo patrón que otras reversas del repo).
**Estado:** CERRADO EN PROD desde v6.23 (WRITE 7b). Confirmado `ACTIVE` en `ayrsteel-2026` (`firebase functions:list`, `[DOCS-STALE-SWEEP]` PASO 3).
**Paridad:** no aplica — `calcRevertProductionFromCoil` es dominio puro server-only, sin preview client-side que lo duplique.
