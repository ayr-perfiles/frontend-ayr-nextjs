# Fórmulas de Costeo — Bobinas (Coils) y Metallic Roofing

> Estado: Vigente
> Última verificación: 2026-07-07 · commit `71250ae6`
> Fuente de verdad: el CÓDIGO. Este doc se valida contra él, no al revés.
> Relacionado: CLAUDE.md v6.21 §3 · ADR-009 (costo congelado) · ADR-010 (guard posterior) · ADR-011 (bulk por-factura) · `modelo-de-costeo.md`

Fichas según `_TEMPLATE.md`. Convención global: montos en PEN, pesos en kg, anchos/espesores en mm.

---

## F-C1 · `pricePerKg` — costo S/·kg⁻¹ al registrar bobina

**Propósito:** convertir el valor total de factura (PEN o USD) al costo unitario por kg que la bobina arrastra toda su vida (nunca se recalcula post-creación).

**Notación:**
```
pricePerKg = (totalValue × TC) / weightKg     (USD)
pricePerKg = totalValue / weightKg            (PEN, TC=1)
```

**Implementación — ⚠️ TRES copias:**

1. **Domain (NO usada por ningún callable — solo test de paridad):** `functions/src/domain/coilPricing.ts:16-32` + gemelo cliente `src/core/coils/domain/coilPricing.ts:8-24`
```typescript
export function computePricePerKg(totalValue, weightKg, currency, exchangeRate) {
  if (weightKg <= 0) throw new Error('El peso debe ser mayor a 0.');
  if (currency === 'USD') {
    if (exchangeRate <= 1) { throw new Error('Tipo de cambio inválido para USD...'); }
    return Number(((totalValue * exchangeRate) / weightKg).toFixed(6));
  }
  return Number((totalValue / weightKg).toFixed(6));
}
```
2. **Inline en `registerCoil`:** `functions/src/callables/coilRegistration.ts:134-135` (offset corregido en v6.74.0 — el `[COIL-TYPE-KEY]` de esa misma tanda insertó líneas antes de este punto; era `:124-127`).
```typescript
const totalPEN = currency === "USD" ? inputValue * exchangeRate : inputValue;
const pricePerKg = Number((totalPEN / weight).toFixed(6));
```
3. **Inline en `registerCoilsBulk`:** `functions/src/callables/coilBulkRegistration.ts:127-128` (idéntica a la #2; offset corregido en v6.74.0, era `:114-118`).

**Entradas:** `totalValue` (PEN|USD, >0) · `weightKg` (kg, >0, throw) · `exchangeRate` (adimensional; domain exige >1, callables exigen [2,7] — ver F-C10).
**Salida:** PEN/kg, `toFixed(6)`.
**Costo:** N/A — computación de creación; el resultado es el snapshot que las reversas tratan como congelado.
**Consumidores:** `computePricePerKg` → solo `coilPricing.test.ts` (ambos lados). Los callables usan sus copias inline. Además `AddCoilForm.tsx:684` y `EditCoilModal.tsx:40` recomputan inline en UI (preview).
**Paridad:** SYNC-MARKER sí (domain) · test `functions/src/domain/coilPricing.test.ts` · **GAP:** las 2 copias inline de los callables no están atadas a la domain fn por código ni test — coinciden hoy por disciplina manual.
**Deudas:** triplicación (domain + 2 inline); umbral de TC inconsistente entre capas (domain `>1`, callables `[2,7]`).

---

## F-C2 · `validateAndCalculateSplit` — split de bobina por ancho

**Propósito:** partir una bobina madre en hija, repartiendo el peso proporcional al ancho cortado (mismo espesor, mismo largo). Base contable de la genealogía de splits.

**Notación:**
```
ratio           = childWidthMm / masterWidth
childWeight     = currentWeight × ratio
newParentWeight = currentWeight − childWeight
newParentWidth  = masterWidth − childWidthMm
```

**Implementación:** `functions/src/domain/coilPricing.ts:48-74` (gemelo cliente `src/core/coils/domain/coilPricing.ts:40-66`)
```typescript
const ratio = newChildWidthMm / parent.masterWidth;
const childWeight = Number((parent.currentWeight * ratio).toFixed(4));
const newParentWeight = Number((parent.currentWeight - childWeight).toFixed(4));
const newParentWidth = Number((parent.masterWidth - newChildWidthMm).toFixed(4));
const newParentStatus: CoilStatus =
  newParentWidth === 0 || newParentWeight === 0 ? 'SPLIT_PARENT' : 'AVAILABLE';
```

**Entradas:** `parent.currentWeight` (kg) · `parent.masterWidth` (mm) · `newChildWidthMm` (mm, 0 < x < masterWidth, throw fuera de rango; parent debe estar AVAILABLE).
**Salida:** pesos kg / ancho mm, `toFixed(4)`.
**Costo:** CONGELADO — `pricePerKg` **se hereda idéntico, no se recalcula** (comentario explícito en línea 46 del archivo).
**Invariantes:** conserva masa total (childWeight + newParentWeight = currentWeight, módulo redondeo 4 dec) y valor contable (mismo pricePerKg en ambas).
**Consumidores:** `functions/src/callables/split.ts:58` (`registerCoilSplit`) · `src/core/coils/components/SplitCoilModal.tsx:27` (preview UI, ejecución duplicada legítima) · tests de paridad ambos lados.
**Paridad:** SYNC-MARKER sí · test `coilPricing.test.ts` con aserción de proporcionalidad verificada a mano.

---

## F-C3 · `calcProductionFromCoils` — conformado bobina → SKU (metallic)

**Propósito:** calcular cuántos kg y S/ consume cada bobina al producir un SKU de cobertura (ML) o plancha (UND), y el costo unitario del lote. Alimenta `perCoilBreakdown` (fuente de verdad para anulación exacta, ver F-C5).

**Notación:**
```
mlFromCoil        = declared                    (COBERTURA_ML)
mlFromCoil        = declared × lengthM          (PLANCHA_UND)
theoreticalWeight = mlFromCoil × thicknessMm × masterWidth × densityFactor
weightConsumedKg  = reportedWeightKg ?? theoreticalWeight
costPEN           = weightConsumedKg × pricePerKg
costoUnitarioPEN  = Σ costPEN / cantidadProducida
```
Sin `/1000`: `densityFactor` ya incorpora la conversión de unidades.

**Implementación:** `functions/src/domain/coilProduction.ts:8-71` (fórmulas núcleo 40-47 y 68); gemelo `src/modules/metallic-roofing/domain/coilProduction.ts` (SYNC-MARKER).
```typescript
const theoreticalWeight = mlFromCoil * coil.thicknessMm * coil.masterWidth * coil.coilDensityFactor;
const weightConsumedKg = Number((coil.reportedWeightKg ?? theoreticalWeight).toFixed(4));
const costPEN = Number((weightConsumedKg * coil.pricePerKg).toFixed(4));
// ...
const costoUnitarioPEN = Number((costoTotalPEN / cantidadProducida).toFixed(6));
```

**Entradas:** `declared` (ML o UND, >0 throw) · `thicknessMm`/`masterWidth` (mm, >0 throw) · `coilDensityFactor` (>0 throw, lookup `coil_finishes`) · `pricePerKg` (S/kg) · `reportedWeightKg` (kg, opcional — si viene, manda sobre el teórico).
**Salida:** kg/PEN `toFixed(4)`; costo unitario `toFixed(6)`.
**Costo:** CONGELADO — usa `coil.pricePerKg` leído dentro de la transacción (`production.ts:137`); las bobinas no tienen WAC, su pricePerKg es fijo desde el registro/split.
**Consumidores:** `functions/src/callables/production.ts:147` (`produceFromCoils`) · `src/app/admin/lines/metallic-roofing/production/new/page.tsx:155` (preview UI) · tests ambos lados.
**Paridad:** SYNC-MARKER sí · `coilProduction.parity.test.ts` con caso de 3 bobinas calculado a mano.

---

## F-C4 · WAC de producto terminado en `produceFromCoils`

**Propósito:** re-blend del costo promedio del SKU terminado al ingresar el lote producido.

**Notación:**
```
newAvgCost = (currentQty × currentAvgCost + costoTotalPEN) / (currentQty + cantidadProducida)
```

**Implementación:** `functions/src/callables/production.ts:152-157` (inline, no extraído a domain)
```typescript
const currentQty = stockSnap.exists ? (stockSnap.data()!.quantity || 0) : 0;
const currentAvgCost = stockSnap.exists ? (stockSnap.data()!.avgCost || 0) : 0;
const newQty = currentQty + result.cantidadProducida;
const newValue = currentQty * currentAvgCost + result.costoTotalPEN;
const newAvgCost = newQty > 0 ? Number((newValue / newQty).toFixed(6)) : result.costoUnitarioPEN;
```

**Entradas:** `currentQty`/`currentAvgCost` releídos de `metallic_roofing_stock/{sku}` DENTRO de la tx · `costoTotalPEN` del lote (congelado, viene de F-C3).
**Salida:** S/·unidad⁻¹ (`toFixed(6)`). Unidad mixta según ProductKind (ML o UND).
**Costo:** **WAC-ACTUAL** — `currentAvgCost` es el promedio vivo (`stockSnap.data()!.avgCost`, línea 154). Correcto por Principio 2.
**Casos borde:** `newQty <= 0` → usa `costoUnitarioPEN` del lote.
**Consumidores:** solo inline; el resultado se persiste vía `metallicRoofingStockStrategy.writeProductionIncrement` (línea 197) y como `averageCostAfter` en el production_log.
**Paridad:** **GAP** — no está extraído a `functions/src/domain/` ni tiene test de dominio dedicado (a diferencia del WAC de drywall).

---

## F-C5 · `voidProductionFromCoils` — anulación de producción (costo congelado)

**Propósito:** revertir una corrida de conformado: devolver el peso exacto a cada bobina al costo original, y restar del PT la cantidad y el **valor congelado** de la corrida.

**Notación:**
```
Por bobina:  costPerKgCongelado = breakdown.costPEN / breakdown.weightConsumedKg
PT:          nuevoTotalValue    = totalValue − Σ breakdown.costPEN
             nuevoAvgCost       = nuevoTotalValue / nuevaQuantity
```

**Implementación:** `functions/src/callables/production.ts:361-368` (bobinas) y `:395-398` (PT)
```typescript
const newWeight = Number((coil.currentWeight + breakdown.weightConsumedKg).toFixed(4));
const newStatus = determineCoilStatusAfterReversal(newWeight, coil.initialWeight);
const costPerKgCongelado = breakdown.costPEN / breakdown.weightConsumedKg;
// ...
const costoCorrida = log.perCoilBreakdown.reduce((acc, b) => acc + b.costPEN, 0);
const nuevoTotalValue = currentTotalValue - costoCorrida;
const nuevoAvgCost = nuevaQuantity > 0 ? nuevoTotalValue / nuevaQuantity : 0;
```

**Entradas:** exclusivamente campos del `production_logs` inmutable (`perCoilBreakdown[].costPEN`, `weightConsumedKg`, `piecesProduced`) + estado vivo del stock/bobinas para los balances.
**Costo:** **CONGELADO** para el valor devuelto (nunca relee `coil.pricePerKg`, que pudo mutar — validado en prod con pricePerKg mutado a 9.99); el `nuevoAvgCost` del PT sí se recalcula (mixto documentado en CLAUDE.md §3.3).
**Guards:** ADMIN-only · idempotente (`status==='VOIDED'` aborta) · aborta sin `perCoilBreakdown` · **guard posterior** (ADR-010): hard-block si el PT tiene venta COMPLETED con `(approvedAt ?? timestamp) > log.timestamp`.
**Consumidores:** thin-client `MetallicProductionHistory` (la función client-side fue BORRADA en v6.21).
**Paridad:** N/A — backend-only por diseño.

---

## F-C6 · `calculateScrapCost` / `calculateNewWeight` — merma de bobina

**Implementación:** `functions/src/domain/scrap.ts:19-31` (gemelo `src/core/coils/domain/scrap.ts`)
```typescript
export function calculateScrapCost(scrapWeightKg, pricePerKg) {
  return Number((scrapWeightKg * pricePerKg).toFixed(2));
}
export function calculateNewWeight(currentWeight, scrapWeightKg) {
  return Number((currentWeight - scrapWeightKg).toFixed(2));
}
```
**Entradas:** kg × S/kg → S/ (`toFixed(2)`); kg − kg → kg (`toFixed(2)`).
**Precisión — inconsistencia conocida:** acá 2 decimales; split/producción usan 4 decimales para pesos. Sin impacto reportado, pero es asimetría real.
**Costo:** el `pricePerKg` leído al momento del scrap queda **congelado** en `scrap_logs.scrapCostPEN` (caller: `functions/src/callables/scrap.ts`).
**Consumidores:** `registerCoilScrap` (backend) · `RegisterScrapModal.tsx:39,43` (preview UI) · tests ambos lados.
**Paridad:** copia cliente idéntica; test de paridad explícito solo para `validateScrapRequest` (las 2 de arriba idénticas por inspección — gap menor).

---

## F-C7 · `voidCoilScrap` — reversa de merma (costo congelado derivado)

**Notación:**
```
costPerKgCongelado = scrapLog.scrapCostPEN / scrapLog.scrapWeightKg
```
El scrap_log **no guarda** pricePerKg; se deriva. NUNCA se relee del coil (su WAC/precio pudo cambiar).

**Implementación:** `functions/src/callables/scrap.ts:207-235`
```typescript
const newWeight = txCoil.currentWeight + scrapLog.scrapWeightKg;
const newStatus = determineCoilStatusAfterReversal(newWeight, txCoil.initialWeight);
const costPerKgCongelado = scrapLog.scrapCostPEN / scrapLog.scrapWeightKg;
```
Kardex compensatorio `SCRAP_REVERSAL` con ese costo. Reporte: `calculateTotalMermaSoles` (`src/core/reports/services/reportFunctions.ts:867-873`) filtra in-memory `status==="VOIDED"` (retrocompat: históricos sin status CUENTAN).
**Costo:** CONGELADO. **Guards:** 5 pre-escritura fail-closed (CLAUDE.md §3.7).

---

## F-C8 · `reverseCoilSplit` — reversa de split

**Notación:**
```
newMotherWeight = motherWeight + childWeight        (suma directa, NO ratio)
newMotherWidth  = motherWidth + childWidth
guard prístino: |childCurrentWeight − childInitialWeight| ≤ 0.01 kg
```

**Implementación:** `functions/src/callables/split.ts:262-296`
```typescript
if (Math.abs(childCurrentWeight - childInitialWeight) > 0.01) { throw ... }
const costPerKgCongelado: number = child.pricePerKg;   // línea 273, leído PRE-tx
// dentro de la tx:
const newMotherWeight = Number((txMother.currentWeight + childWeight).toFixed(4));
const newMotherWidth = txMother.masterWidth + txChild.masterWidth;
const newMotherStatus = determineCoilStatusAfterReversal(newMotherWeight, txMother.initialWeight);
```

**Costo:** CONGELADO — `child.pricePerKg` (invariante: nunca muta post-creación). Nota: se lee **antes** de abrir la transacción y se reusa adentro; aceptable solo por ese invariante.
**Nota EPSILON:** el `0.01` del guard prístino es un **literal independiente** del `REVERSAL_EPSILON` de `scrap.ts` — dos constantes 0.01 hardcodeadas con propósitos distintos (guard vs umbral de estado), no comparten fuente.
**Guards:** 7 fail-closed (CLAUDE.md v6.19).

---

## F-C9 · `determineCoilStatusAfterReversal` — estado post-reversa (EPSILON 0.01)

**Propósito:** decidir el estado de una bobina tras devolverle peso. Nunca devuelve PROCESSED.

**Implementación:** `functions/src/domain/scrap.ts:40-46`
```typescript
const REVERSAL_EPSILON = 0.01;
export function determineCoilStatusAfterReversal(newWeight, initialWeight): CoilStatus {
  return newWeight >= initialWeight - REVERSAL_EPSILON ? "AVAILABLE" : "IN_PROGRESS";
}
```

**Entradas:** kg, kg. Tolerancia 0.01 kg (paridad con el ε que usaba el cliente histórico).
**Consumidores (3 — trazado global, NO uso único):** `split.ts:287` (`reverseCoilSplit`) · `scrap.ts:208` (`voidCoilScrap`) · `production.ts:367` (`voidProductionFromCoils`).
**Paridad:** **backend-only a propósito** — la copia inline cliente fue deduplicada/borrada (v6.19/v6.21). No tiene gemelo ni test de paridad cliente; tiene tabla de 5 casos en `scrap.test.ts`.
**Coexiste con** `determineCoilStatusAfterScrap` (`scrap.ts:33-38`): camino forward, `newWeight <= 0 → PROCESSED`, sin epsilon. Son 2 helpers distintos, no confundir.

---

## F-C10 · Guard TC USD [2,7]

**Propósito:** rechazar tipos de cambio absurdos (typo, columna corrida) antes de que contaminen `pricePerKg`. Complementa la muerte del fallback 3.75 (v6.20: `/api/tipo-cambio` en fallback no emite número).

**Implementaciones (3, mismo rango):**
- Cliente (single source UI): `src/core/coils/bulkUploadLogic.ts:100-109`
```typescript
export const EXCHANGE_RATE_MIN = 2;
export const EXCHANGE_RATE_MAX = 7;
export function isValidUsdExchangeRate(rate) { ... n >= EXCHANGE_RATE_MIN && n <= EXCHANGE_RATE_MAX; }
```
- Backend `registerCoil`: `functions/src/callables/coilRegistration.ts:47`
- Backend `registerCoilsBulk`: `functions/src/callables/coilBulkRegistration.ts:52`
```typescript
if (currency === "USD" && (isNaN(exchangeRate) || exchangeRate < 2 || exchangeRate > 7)) { throw ... }
```

**Deuda:** el backend NO importa `isValidUsdExchangeRate` (duplicación inline con el mismo rango); la domain fn `computePricePerKg` usa otro umbral (`>1`). Consumidores cliente: `BulkUploadCoils.tsx:135`, `PurchaseCoilFromXml.tsx:233,405,414`.

---

## F-C11 · Guards de bulk: peso [2000-7000] kg · unidad→kg · valor 2 decimales

**Implementación:** `src/core/coils/bulkUploadLogic.ts:97-126` + `validateCoilRow`/`buildInvoicesPayload`
```typescript
export const WEIGHT_MIN_KG = 2000;
export const WEIGHT_MAX_KG = 7000;
export function parseWeightToKg(weightRaw, unitRaw): number | null {
  if (u === 'KILOGRAMO' || u === 'KG') return rawVal;
  else if (u === 'TONELADA' || u === 'TON' || u === 'TN' || u === 'TONELADAS') return rawVal * 1000;
  return null; // ROLLO, UNIDAD, UND, vacíos, o desconocidos
}
```

- **Peso [2000-7000]:** guard de **robustez de formato en UI**, NO hard-block backend (el callable solo exige `weight > 0` — bobina atípica legítima no debe bloquearse). Diseño intencional (CLAUDE.md §10).
- **Unidad→kg:** TON×1000, KG passthrough, resto → `null` (fila inválida, kg a mano). **Distinto de `calcPesoKg`** del importador de ventas (`src/utils/importHelpers.ts:9-45`), que sí multiplica UNIDAD/ML por peso de catálogo y hace fallback con flag ante UM desconocida. Dos conversores para dos flujos, sin helper común.
- **Valor monetario:** `Number(parseNumValue(row.valueRaw).toFixed(2))` — XLSX `raw:true` trae floats sucios; la verdad contable es el valor facturado a 2 decimales.

---

## F-C12 · densityFactor por acabado

Ver Principio 3 en `modelo-de-costeo.md`. Lookup `coil_finishes` (GALV 0.00785, ALU-NATURAL 0.00785, ALU-* colores 0.008), throw si falta, nunca hardcodear. Gate de compatibilidad: `assertCoilFinishCompatible` (`functions/src/domain/finishCompat.ts` + gemelo cliente).
