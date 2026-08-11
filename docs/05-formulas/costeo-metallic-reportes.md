---
title: "Costeo y Reportes - Metallic Roofing (Aluzinc)"
status: "APPROVED"
last_updated: "2026-07-18"
---

# Costeo y Reportes - Metallic Roofing (Aluzinc)

Este documento detalla las fórmulas de costeo de la línea de conformado (Aluzinc) y su impacto tanto en el Kardex (WAC) como en los reportes ejecutivos.

## 1. DISTINCIÓN CLAVE: "Costo Corrida" vs "Costo del Reporte"

Es fundamental distinguir conceptualmente dos momentos del costeo que **no son idénticos**:

- **Costo de Corrida (Producción):** Es el costo de *PRODUCIR* el producto terminado en un momento dado, basado en el valor exacto de la materia prima (bobina) consumida en ese instante. Este costo entra al inventario y se promedia (WAC).
- **Costo del Reporte (COGS de lo Vendido):** Es el Costo de los Bienes Vendidos (Cost of Goods Sold). Representa el valor del stock (WAC) que fue entregado al cliente en una venta completada.

**¿Por qué no coinciden?** Porque la producción no es igual a la venta. El WAC promedia múltiples corridas de producción con distintos costos a lo largo del tiempo, y el reporte excluye operaciones anuladas o ventas no concretadas.

---

## 2. Costo Corrida (Producción)

Cuando se conforma Aluzinc a partir de bobinas, el costo total de la corrida se calcula sumando el costo de la porción consumida de cada bobina.

**Fórmula:**
- `costoTotalPEN` (stripCost) = `Σ (weightConsumedKg × coil.pricePerKg)`
- `costoUnitarioPEN` (costPerPiece) = `costoTotalPEN / piezasProducidas`

> **Ubicación:** `functions/src/domain/coilProduction.ts:47` y `68`

Este costo unitario es el que se inyecta como valor de "Entrada" al Kardex del Producto Terminado.

---

## 3. Costo Promedio Ponderado (WAC) del Producto Terminado

Al registrar la producción, el costo total de la corrida incrementa el valor total del inventario del PT, recalculando su WAC (Average Cost).

**Fórmula:**
- `newValue = (currentQty × currentAvgCost) + costoTotalPEN`
- `newAvgCost = newValue / newQty` *(si newQty > 0, sino `costoUnitarioPEN` de la corrida)*

> **Ubicación:** `functions/src/callables/production.ts:159-161`

Este `newAvgCost` permanecerá en el stock y será el costo que se "congele" al momento de realizar una venta de este PT.

---

## 4. Reporte "Costo + Ganancia" (Aluzinc)

El reporte ejecutivo de rentabilidad (P-M7 y Resumen) reconstruye los márgenes de la línea de Aluzinc basándose en las **ventas**.

> **Archivos clave:** `src/core/reports/services/reportFunctions.ts` y `src/modules/metallic-roofing/domain/aluzincCostReport.ts`

### 4.1. Universo de Datos
- **Ventas:** Documentos en `sales` con `status === "COMPLETED"`.
- **Items:** Se filtran los ítems con `businessLine === "metallic-roofing"` y que posean un `weightSnapshot != null`.
- **Moneda:** Las ventas en `USD` exigen estrictamente que tengan registrado un `exchangeRate > 0`; de lo contrario, se excluyen íntegramente de la estadística.
- **Agrupación:** Por el color definido en `weightSnapshot.colorFinish`.

### 4.2. Cálculo de Venta
- **Venta por Fila:** `Σ (unitValue × quantity)`
- *(Nota: Si la venta es USD, se multiplica por el `exchangeRate` del momento de la venta para expresarlo en PEN. `unitValue` es el valor neto sin IGV).*

### 4.3. Cálculo de Costo (COGS)
- **Costo por Fila:** `Σ (baseCost × quantity)`
- *(Nota Crítica [Actualizada 2026-08-11]: Para cotizaciones CON producción propia, el `baseCost` original (que era el WAC al momento de venta) **SE PISA** con el costo de producción exacto al llegar a CUMPLIDA (A1) o vía backfill (A2). Esto hace que el "Costo Corrida" y el "Costo Reporte" CONVERJAN. Para el histórico loteado sin link a producción propia, sigue rigiendo el WAC de import).*

### 4.4. Cálculo de Merma
La merma (scrap) se extrae independientemente sumando el campo `scrapCostPEN` de la colección `scrap_logs` del periodo consultado, **excluyendo** los registros con `status === "VOIDED"`.

### 4.5. Ganancia y Margen

> [!WARNING]
> **NOTA DE DISEÑO (Merma Global):** La merma originada en las bobinas no puede atribuirse con precisión a un color específico de producto terminado (debido a las combinaciones de producción). Por ende, la merma se aplica **únicamente como una deducción al Total General**.

- **Ganancia por Fila (Color):** `Venta - Costo` *(La merma NO se resta aquí).*
- **Margen por Fila:** `(Ganancia / Venta) × 100`
- **Ganancia Neta (Total):** `Venta Total - Costo Total - Merma Total`

Esto implica matemáticamente que **la suma de las ganancias por color NO cuadrará con la Ganancia Total** si hubo merma en el periodo (la Ganancia Total será menor).
