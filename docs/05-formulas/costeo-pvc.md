# Fórmulas de Costeo — Línea Roofing (PVC)

> Estado: Vigente (corregido 2026-07-07; original Sprint 3, Mayo 2026)
> Última verificación: 2026-07-07 · commit `71250ae6`
> Fuente de verdad: el CÓDIGO. Este doc se valida contra él, no al revés.
> Relacionado: CLAUDE.md v6.21 §15 · `modelo-de-costeo.md` Principio 2 · `ventas-igv.md` F-V5
>
> **Módulo:** `src/modules/roofing/services/stockAdjustmentService.ts` (⚠️ corregido — el `stockService.ts` que citaba la versión original de este doc NUNCA existió con ese nombre)
> **Sprint:** 3 (Mayo 2026)

---

## 1. Costo Promedio Ponderado (CPP)

El costo promedio ponderado se recalcula **únicamente en entradas (ENTRADA)**. Las salidas y ajustes consumen al costo promedio existente sin modificarlo.

### Fórmula

```
newAvgCost = (currentQty × currentAvgCost + incomingQty × unitCost)
             ─────────────────────────────────────────────────────
                        (currentQty + incomingQty)
```

### Implementación

⚠️ **Corrección 2026-07-07:** no existe una función `calcNewAvgCost` ni un archivo `stockService.ts`. La fórmula vive **inline** en `adjustStock`, y está **duplicada a mano en 3 módulos** (deuda conocida, sin helper compartido — ver CLAUDE.md §11 Backlog):

- `src/modules/roofing/services/stockAdjustmentService.ts:83-91` (fórmula en :90)
- `src/modules/metallic-roofing/services/stockAdjustmentService.ts:70-78` (fórmula en :77)
- `src/modules/trading/services/stockAdjustmentService.ts:69-77` (fórmula en :76)

```typescript
// src/modules/roofing/services/stockAdjustmentService.ts:83-91 (código real)
// Weighted average cost — only recalculate on ENTRY with a positive cost
let newAvgCost = currentAvgCost;
const unitCost = input.unitCost ?? 0;
if (input.type === 'ENTRY' && unitCost > 0) {
  const existingValue = currentQty > 0 ? currentQty * currentAvgCost : 0;
  const incomingValue = input.quantity * unitCost;
  const totalQtyAfter = (currentQty > 0 ? currentQty : 0) + input.quantity;
  newAvgCost = Number(((existingValue + incomingValue) / totalQtyAfter).toFixed(4));
}
```

Nota: a diferencia del pseudocódigo original de este doc, la implementación real **excluye el stock negativo del denominador** (`currentQty > 0 ? ... : 0`) y redondea a 4 decimales. El write path de ventas/producción usa además `writeSaleReversal`/`writeProductionIncrement` en `src/core/sales/strategies/index.ts` (ver `ventas-igv.md` F-V3).

### Casos especiales

| Situación                          | Comportamiento                                                              |
|------------------------------------|-----------------------------------------------------------------------------|
| Primera entrada (qty = 0)          | `newAvgCost = unitCost` (denominador = incomingQty)                         |
| Stock negativo antes de la entrada | Se incluye el stock negativo en el denominador. La fórmula sigue aplicando  |
| SALIDA                             | No modifica `avgCost`                                                       |
| AJUSTE                             | No modifica `avgCost` (independiente del signo del delta)                   |

### Ejemplo numérico

```
Estado inicial: qty=0, avgCost=0

Entrada 1: 10 piezas a S/ 50.00 c/u
  newAvgCost = (0×0 + 10×50) / (0+10) = 50.00
  qty = 10, avgCost = 50.00

Entrada 2: 5 piezas a S/ 60.00 c/u
  newAvgCost = (10×50 + 5×60) / (10+5) = (500+300) / 15 = 53.33
  qty = 15, avgCost = 53.33

Venta de 3 piezas:
  avgCost NO cambia = 53.33
  qty = 12, avgCost = 53.33

Entrada 3: 10 piezas a S/ 55.00 c/u
  newAvgCost = (12×53.33 + 10×55) / (12+10) = (640 + 550) / 22 ≈ 54.09
  qty = 22, avgCost = 54.09
```

---

## 2. Valor Total del Stock

```
totalValue = quantity × avgCost
```

Se guarda desnormalizado en `roofing_stock/{sku}.totalValue` para consultas rápidas de valorización de inventario. Se actualiza en cada movimiento.

```typescript
const totalValue = parseFloat((newQty * newAvgCost).toFixed(2));
```

> Redondeo a 2 decimales para evitar acumulación de errores de punto flotante.

---

## 3. Precio de Venta Sugerido

⚠️ **Corrección 2026-07-07:** la fórmula que documentaba este doc (`avgCost × (1 + MARGIN_FACTOR) × (1 + IGV_RATE)`, markup sobre COSTO) **es incorrecta** — nunca fue la implementada. Los archivos `modules/roofing/config/pricing.ts` y `domain/pricing/constants.ts` que citaba **no existen**. La fórmula real es **markup sobre PRECIO** con margen dinámico:

```
valueWithoutIGV = cost / (1 − marginPercent/100)
suggestedPrice  = valueWithoutIGV × (1 + IGV_RATE)
```

```typescript
// src/core/sales/components/ProductSelector.tsx:40-46 (código real)
const IGV_RATE = 0.18;
function suggestedPrice(cost: number, marginPercent: number): number {
  if (cost <= 0) return 0;
  const valueWithoutIGV = cost / (1 - marginPercent / 100);
  return Number((valueWithoutIGV * (1 + IGV_RATE)).toFixed(2));
}
```

| Parámetro | Valor | Fuente real |
|---|---|---|
| `marginPercent` | **dinámico** — `settings?.minMarginPercent ?? 20` | `ProductSelector.tsx:234,344,452,583,731` |
| `IGV_RATE` | 0.18 | local en `ProductSelector.tsx:40` (⚠️ redeclarado ×6 en el repo, ver `ventas-igv.md` F-V2) |

### Ejemplo (corregido)

```
cost = S/ 54.09, margin = 30%
suggestedPrice = 54.09 / (1 − 0.30) × 1.18 = 77.2714 × 1.18 = S/ 91.18
```

(La fórmula errónea `54.09 × 1.30 × 1.18` daba S/ 82.97 — una diferencia de S/ 8.21 por pieza.)

> El precio sugerido es solo referencial. El operador puede introducir cualquier precio en la venta (piso = costo; ADMIN puede cruzarlo).

---

## 4. Costo de Venta (COGS)

Para cada item vendido, el costo de venta se registra en el movimiento:

```
costOfGoodsSold = quantity × avgCostAtTimeOfSale
```

`avgCostAtTimeOfSale` es el `avgCost` vigente en `roofing_stock` en el momento de la transacción. Se captura durante la fase de lecturas del `runTransaction` y se escribe en `roofing_stock_movements.unitCost`.

---

## 5. Movimiento de stock: qué campos cambian según tipo

| Campo en `roofing_stock` | ENTRADA | SALIDA | AJUSTE |
|--------------------------|---------|--------|--------|
| `quantity`               | +qty    | −qty   | ±delta |
| `avgCost`                | ✅ recalcula | ❌ sin cambio | ❌ sin cambio |
| `totalValue`             | ✅ recalcula | ✅ recalcula | ✅ recalcula |
| `lastUpdated`            | ✅      | ✅     | ✅     |

---

## 6. Validaciones de integridad

1. **`unitCost > 0`** solo en ENTRADA. SALIDA y AJUSTE no requieren costo (se usa el `avgCost` del stock).
2. **`quantity > 0`** en todos los tipos. La dirección la indica el `type`.
3. **Stock negativo permitido** (ADR-005): no se lanza error si `newQty < 0`.
4. **Redondeo consistente**: todos los montos monetarios se redondean a 2 decimales antes de escribir en Firestore.

---

## 7. Diferencias con el costeo de Drywall

| Aspecto              | Drywall                                      | Roofing PVC                           |
|----------------------|----------------------------------------------|---------------------------------------|
| Unidad de entrada    | Bobina madre (kg)                            | Plancha (pieza)                       |
| Cálculo de costo     | Costo por mm derivado del peso y densidad    | CPP directo sobre piezas              |
| Stock negativo       | Permitido (ADR-005)                          | Permitido (ADR-005)                   |
| Colección de stock   | `inventory_stock`                            | `roofing_stock`                       |
| Colección movimientos| `kardex_movements`                           | `roofing_stock_movements`             |
| Costo promedio       | `lastCostPerPiece` (no ponderado)            | `avgCost` (CPP estricto)              |

---

## Referencias

- [ADR-005 — Stock negativo permitido](../adr/ADR-005-stock-negativo.md)
- [Proceso de negocio Roofing](../04-dominio/lineas-negocio/roofing.md)
- `src/modules/roofing/services/stockAdjustmentService.ts` — implementación (corregido 2026-07-07; +2 copias en metallic-roofing/trading)
- `src/core/sales/components/ProductSelector.tsx` — suggestedPrice + IGV_RATE reales (corregido 2026-07-07)
