# Fórmulas de Costeo — Línea Roofing (PVC)

> **Módulo:** `src/modules/roofing/services/stockService.ts`  
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

```typescript
// src/modules/roofing/services/stockService.ts
function calcNewAvgCost(
  currentQty: number,
  currentAvgCost: number,
  incomingQty: number,
  unitCost: number,
): number {
  const totalQty = currentQty + incomingQty;
  if (totalQty === 0) return unitCost;
  return (currentQty * currentAvgCost + incomingQty * unitCost) / totalQty;
}
```

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

El precio sugerido se calcula a partir del costo promedio aplicando un margen comercial y el IGV peruano.

```
suggestedPrice = avgCost × (1 + MARGIN_FACTOR) × (1 + IGV_RATE)
```

| Constante      | Valor  | Ubicación                           |
|----------------|--------|-------------------------------------|
| `MARGIN_FACTOR`| 0.30   | `modules/roofing/config/pricing.ts` |
| `IGV_RATE`     | 0.18   | `domain/pricing/constants.ts`       |

### Ejemplo

```
avgCost = S/ 54.09
suggestedPrice = 54.09 × 1.30 × 1.18 = S/ 82.97
```

> El precio sugerido es solo referencial. El operador puede introducir cualquier precio en la venta.

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
- `src/modules/roofing/services/stockService.ts` — implementación
- `src/domain/pricing/constants.ts` — IGV_RATE, MARGIN_FACTOR
