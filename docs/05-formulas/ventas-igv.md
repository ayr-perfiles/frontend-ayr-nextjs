# Fórmulas — Ventas, IGV y Compras

> Estado: Vigente
> Última verificación: 2026-08-20 (cierre del frente EDITAR — F-V6 actualizada: `updateQuotation` borrada, `cartLogic.ts` nuevo; el resto de las fichas siguen en su verificación de 2026-07-07 · commit `71250ae6`)
> Fuente de verdad: el CÓDIGO. Este doc se valida contra él, no al revés.
> Relacionado: CLAUDE.md v6.21 §11 · ADR-004 (superseded) · ADR-008 (NC/ND) · ADR-009 · `modelo-de-costeo.md`

---

## F-V1 · `suggestedPrice` — precio de venta sugerido (fórmula REAL)

**Propósito:** pre-llenar el precio de venta en el carrito a partir del costo, aplicando margen comercial e IGV.

**Notación — ATENCIÓN, es markup sobre PRECIO, no sobre costo:**
```
valueWithoutIGV = cost / (1 − margin%/100)
suggestedPrice  = valueWithoutIGV × (1 + IGV_RATE)
```
El costo es la fracción `(1 − margin)` del valor sin IGV. NO es `cost × (1 + margin)` — esa versión (documentada erróneamente en versiones previas de `costeo-pvc.md`) da un número distinto.

**Ejemplo numérico verificado:** `cost = 54.09`, `margin = 30%`:
```
54.09 / (1 − 0.30) = 77.2714  →  × 1.18 = 91.18   (toFixed(2))
```
(La fórmula errónea `54.09 × 1.30 × 1.18` daría 82.97 — 8.21 soles menos por pieza.)

**Implementación:** `src/core/sales/components/ProductSelector.tsx:40-46`
```typescript
const IGV_RATE = 0.18;
function suggestedPrice(cost: number, marginPercent: number): number {
  if (cost <= 0) return 0;
  const valueWithoutIGV = cost / (1 - marginPercent / 100);
  return Number((valueWithoutIGV * (1 + IGV_RATE)).toFixed(2));
}
```

**Entradas:** `cost` (S/, WAC/lastCostPerPiece vigente) · `marginPercent` = **dinámico**, `settings?.minMarginPercent ?? 20` (NO un 0.30 hardcodeado).
**Salida:** PEN `toFixed(2)`. Referencial — el vendedor puede pisarlo (piso = costo, ADMIN lo cruza).
**Consumidores:** `ProductSelector.tsx:234,344,452,583,731` (una por tab de línea de negocio).
**Casos borde:** `cost ≤ 0 → 0`. Nota: `marginPercent ≥ 100` daría división por ≤0 — no hay guard (el setting es controlado por ADMIN).

---

## F-V2 · DEUDA — IGV_RATE declarado 6+ veces, sin fuente única

La tasa 0.18 está **redeclarada localmente** en cada archivo que la usa; ninguna importa de otra:

| # | Archivo:línea | Forma |
|---|---|---|
| 1 | `src/core/sales/components/ProductSelector.tsx:40` | `const IGV_RATE = 0.18;` |
| 2 | `src/app/admin/sales/new/page.tsx:39` | `const IGV_RATE = 0.18;` |
| 3 | `src/app/admin/purchases/new/page.tsx:23` | `const IGV_RATE = 0.18;` |
| 4 | `src/components/sales/SaleDetailsModal.tsx:61` | `const IGV_RATE = 0.18;` |
| 5 | `src/components/sales/PrintableTicket.tsx:25` | `settings?.igvRate ?? 0.18` (único que honra el setting) |
| 6 | `src/domain/steel/constants.ts:84` | `IGV_RATE_PERU = 0.18` — **cero consumidores, constante muerta** |
| 7 | `src/core/reports/services/reportFunctions.ts:375` | literal crudo `sale.totalAmount / 1.18` (`runSunatIGV`) |
| 8-9 | `functions-sunat/src/sunat/xmlGenerator.ts:9`, `pdfGenerator.ts:82` | `const IGV_RATE = 0.18;` (backend SUNAT) |

Existe además `settings.igvRate` configurable (`src/services/settingsService.ts`, default 0.18 en `GeneralSettings.tsx:53`) que casi nadie lee. **Si el IGV peruano cambia, hay que tocar ~8 lugares y uno está muerto.** Fuente real de facto: el literal 0.18. Backlog en CLAUDE.md §11.

Fórmulas derivadas dispersas (mismo patrón, sin helper):
```typescript
const unitValue = numPrice / (1 + IGV_RATE);            // ProductSelector ×7, sales/new, SaleDetailsModal
const isLoss = numVal > 0 && numVal / (1 + IGV_RATE) < baseCost;   // ProductSelector.tsx:847
const igv = totalPEN * IGV_RATE;                        // purchases/new/page.tsx:101
```

---

## F-V3 · `writeSaleReversal` — devolución de stock por NC / anulación (costo congelado + re-blend)

**Propósito:** al anular una venta o procesar una NC `RETURNS_STOCK`, devolver la cantidad al stock re-blendando el valor al **costo congelado de la venta** (`frozenCost`), no al WAC actual.

**Notación:**
```
returnedValue = quantity × frozenCost
newTotalValue = currentTotalValue + returnedValue
newAvgCost    = newTotalValue / newBalance
```

**Implementación:** `src/core/sales/strategies/index.ts:207-247` (roofing; copias estructuralmente idénticas para metallic-roofing `:336-376` y trading `:464-504`)
```typescript
const currentTotalValue = snap?.exists() ? ((snap.data().totalValue as number) ?? (currentQty * currentAvgCost)) : 0;
const returnedValue = quantity * (frozenCost ?? 0);
const newTotalValue = currentTotalValue + returnedValue;
const newAvgCost = newBalance > 0 ? newTotalValue / newBalance : 0;
// avgCost toFixed(6), totalValue toFixed(2)
```

**Costo:** CONGELADO (`frozenCost` del item vendido) + re-blend del promedio (mixto, mismo patrón que `voidProductionFromCoils`).
**⚠️ Fallback silencioso conocido (línea 211):** si el doc de stock no tiene campo `totalValue`, cae a `currentQty × currentAvgCost` sin advertir. Si `totalValue` hubiera divergido de `quantity × avgCost` por un bug previo, esta fórmula propaga el valor divergente en silencio. Además `frozenCost ?? 0`: un item histórico sin frozenCost devuelve stock a costo 0 sin ruido.
**Consumidores:** `salesService.ts` (processSale/approveQuotation/annulSale: líneas 66,120,244,288,361,400) · `sales/import/page.tsx:673,739` (NC del importador).
**Paridad:** existe copia backend en `functions/src/domain/strategies/metallicRoofingStockStrategy.ts:91-131` que es **CÓDIGO MUERTO** (ningún callable la consume — WRITE 9 pendiente); numéricamente igual hoy, sin SYNC-MARKER ni test de paridad. Riesgo de drift silencioso.

---

## F-V4 · WAC de compras (`registerPurchase`) — 4ª implementación independiente del re-blend

**Implementación:** `src/core/purchases/service.ts:81-95`
```typescript
if (currentQty <= 0) {
  newAvgCost = item.unitCostPEN;
} else {
  // Fórmula estándar: (Q1*C1 + Q2*C2) / (Q1 + Q2)
  const existingValue = currentQty * currentAvgCost;
  const incomingValue = item.quantity * item.unitCostPEN;
  newAvgCost = Number(((existingValue + incomingValue) / (currentQty + item.quantity)).toFixed(4));
}
const newTotalValue = Number((newTotalQty * newAvgCost).toFixed(2));
```

**Costo:** WAC-ACTUAL (Principio 2). Redondeo `toFixed(4)` para avgCost — inconsistente con el `toFixed(6)` de producción.
**⚠️ `LINE_CONFIG` solo cubre 2/5 líneas** (`service.ts:19-30`): `trading` y `roofing`. Compras de `metallic-roofing`/`drywall`/`services` lanzan `Línea de negocio no soportada para compras`. Es un mapa de colecciones paralelo e incompleto respecto de `getStockStrategy` (que cubre las 5). El componente `PurchaseItemSelector.tsx:26` hardcodea la misma limitación en su type signature.
**Consumidores:** `purchases/new/page.tsx:151` · tests unit/integración.

## F-V4b · `voidPurchase` — WAC inverso aproximado

**Implementación:** `src/core/purchases/service.ts:194-200`
```typescript
let newAvgCost = currentAvgCost;
if (newQty > 0) {
    const currentValue = currentQty * currentAvgCost;
    const originalValue = item.quantity * item.unitCostPEN;
    newAvgCost = Number(((currentValue - originalValue) / newQty).toFixed(4));
    if (newAvgCost < 0) newAvgCost = currentAvgCost; // Fallback por si acaso
}
```
**Costo:** ⚠️ aproximación admitida por el propio código (comentario líneas 190-193: si hubo otras compras después, el resultado no reconstruye el histórico). No es costo congelado limpio; tiene fallback silencioso a costo actual si el cálculo da negativo. Deuda documentada, no bug nuevo.

---

## F-V5 · CPP por ajuste manual (roofing / metallic / trading) — 3 copias

Ver también `costeo-pvc.md` (versión narrativa). La fórmula (idéntica en las 3):
```typescript
// solo en ENTRY con unitCost > 0
const existingValue = currentQty > 0 ? currentQty * currentAvgCost : 0;
const incomingValue = input.quantity * unitCost;
const totalQtyAfter = (currentQty > 0 ? currentQty : 0) + input.quantity;
newAvgCost = Number(((existingValue + incomingValue) / totalQtyAfter).toFixed(4));
```
- `src/modules/roofing/services/stockAdjustmentService.ts:90`
- `src/modules/metallic-roofing/services/stockAdjustmentService.ts:77`
- `src/modules/trading/services/stockAdjustmentService.ts:76`

SALIDA y AJUSTE no tocan `avgCost`. Nota: a diferencia de `registerPurchase`, esta variante **excluye stock negativo del denominador** (`currentQty > 0 ? ... : 0`) — divergencia semántica menor entre las implementaciones del mismo concepto.

---

## F-V6 · Totales de venta / margen

**Acumulación de carrito — capa SERVICIO** (`src/core/sales/services/salesService.ts:89` y `:185`, copiada **2×** en `processSale`/`createQuotation`):
```typescript
totalAmount += item.quantity * item.unitPrice;
totalCost   += item.quantity * item.baseCost;
totalWeight += item.quantity * (item.unitWeight ?? 0);
// totalProfit: totalAmount - totalCost
```
> ⚠️ **Actualizado 2026-08-20 — eran 3 copias, ahora son 2.** La tercera vivía en `updateQuotation`, **borrada** en v6.53.0 (D6): estaba fuera del builder canónico v6.28 y su `totalProfit` restaba sobre el monto **CON** IGV, o sea una fórmula distinta de la del builder. Su reemplazo, el callable `editQuotation`, delega los totales a `buildQuotationDoc` — no acumula nada por su cuenta. Ver [`docs/modules/ventas.md`](../modules/ventas.md) §16.

**Acumulación de carrito — capa UI (POS), fórmula DISTINTA** (`src/core/sales/cartLogic.ts:32` `computeCartTotals`):
```typescript
totalValue     = Σ quantity × unitValue;   // SIN IGV
totalAmount    = Σ quantity × unitPrice;   // CON IGV
totalIGV       = totalAmount − totalValue;
projectedProfit = totalValue − totalCost;                       // margen SIN IGV
marginPercent   = totalValue > 0 ? projectedProfit/totalValue*100 : 0;
```
No es una 3ª copia de la fórmula de arriba: el margen del POS se calcula **sobre `totalValue` (sin IGV)**, no sobre `totalAmount`. Extraída en v6.53.0 del inline de `sales/new/page.tsx` para que la página de edición de cotización la reuse; `cartLogic.test.ts` guarda una copia **textual** de las 2 fórmulas viejas y assertea igualdad contra ellas (el inline se borró recién con esa parity en verde). El guard `totalValue > 0` evita `NaN`/`Infinity` con carrito vacío.

**Totales agregados server-side** (`salesService.ts:542-547`): `getAggregateFromServer` con `count() + sum(totalAmount/totalProfit/totalWeight)` sobre el set filtrado completo (cacheado al paginar, flag `skipAggregates`). También en `reportsService.ts:61` y `kardexService.ts:62`.

**Margen en reportes** (`reportFunctions.ts`): `(profit / (sales || 1)) * 100` — repetida 5 veces en el mismo archivo (líneas ~111, 164, 312, 540, 744), sin helper.

**⚠️ Constante mágica:** `runConsumoBobina` (`reportFunctions.ts:240`): `yield = (1 − scrap/1200) × 100 // Simplificado` — ancho de referencia 1200mm hardcodeado, sin fuente declarada (el default real del sistema es `DEFAULT_MASTER_WIDTH_MM = 1192`).

---

## F-V7 · `calcPesoKg` — unidad→kg del importador de ventas SUNAT

**Implementación:** `src/utils/importHelpers.ts:9-45`
```typescript
if (um === 'UNIDAD' | 'UND' | 'UNIDADES')       return { weight: cantidad * unitWeight };
if (um === 'METRO LINEAL' | 'ML' | 'METROS')    return { weight: cantidad * unitWeight };
if (um === 'KILOGRAMO' | 'KG' | 'KILOGRAMOS')   return { weight: cantidad };
if (um === 'TONELADA' | 'TN' | 'TONELADAS')     return { weight: cantidad * 1000 };
// UM vacía → cantidad * unitWeight sin flag; UM desconocida → mismo cálculo + flag warning
```
**⚠️ Fallback parcial:** ante UM desconocida NO bloquea — calcula como UNIDAD y agrega `flag` de warning. Contrasta con `parseWeightToKg` del bulk de bobinas (null = fila inválida). Decisión distinta por flujo; documentada aquí para que nadie la "arregle" sin contexto.
**Consumidores:** `sales/import/page.tsx:404,574` · tests.
