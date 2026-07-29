# Módulo Metallic (Aluzinc)

Esta ficha contiene la verdad operativa del módulo de Conformado Aluzinc (Metallic Roofing).
Fecha de última verificación: **2026-07-29**

## 1. Catálogo Multi-acabado (RAL)
- **`finishes` (array opcional):** El catálogo soporta múltiples acabados por SKU. Se agregó soporte retrocompatible vía `getFinishArray()` (que lee de `finishes` o hace fallback al viejo escalar `finish`). NO hubo migración masiva, conviven ambos modelos.
- **`coil_finishes` como fuente única:** La colección `coil_finishes` cuenta con campos `tipo` (Natural|Prepintado|Galvanizado) y `color` (Rojo|Azul|Blanco|Gris|Verde|'-'). La función `getFinishMeta` lee estos campos y `formatFinishChip` da estilos. Backfill ejecutado con 9 finishes.
- **SKU inmutable:** El `sku` es estrictamente inmutable en las actualizaciones del catálogo, ya que opera como llave foránea en `metallic_roofing_stock`, `kardex_movements`, `production_logs` y `items[].sku` de ventas/compras.
- **Unidad de medida (`unit`):** El campo `unit` en el catálogo es **100% display-only**. El `ProductKind` (que dicta si se inyecta en ML o en UND) **sale de `family`** (vía la función `toProductKind` en `coverageMetadataParser.ts`), NUNCA de `unit`. Si se cambia la `unit` de PIEZA a METRO visualmente, el motor de costeo/kardex/producción NO sufre impacto si la `family` sigue siendo COBERTURA o PLANCHA correspondientemente.

## 2. Inventario de PT (`metallic_roofing_stock`)
- **Stock en tabla:** La `InventoryTable` calcula en runtime los campos `quantity`, `avgCost` y `totalValue` (`qty * avgCost`).
- **Freeze-WAC:** Si `quantity <= 0`, el cálculo congela el `avgCost` mediante `ADR-009` (evita WAC negativos o valores irreales).
- **Display Guard (`hasStockPosition`):** En UI de inventario, si `quantity === 0`, el `avgCost` y `totalValue` se muestran como `'—'` (guía visual, aunque negativo anómalo sí se muestra).

## 3. Producción y Guard Mono-RAL
- **Guard Hermético en `produceFromCoils`:** Una corrida de producción = Un único acabado (RAL). El backend rechaza estrictamente si las bobinas seleccionadas para una corrida no coinciden en su acabado. 
- **Fail-closed:** Si una bobina carece de `finish`, el guard la bloquea. No hay fallback a un default implícito para bobinas.
- **Densidad:** El `densityFactor` sale siempre del documento individual de la bobina, derivado de `coil_finishes`. El catálogo de acabados tiene asignado 0.008 para todo lo que es Aluzinc.

## 3. Ventas y Estado de Producción
- **Cotizaciones importadas:** Para integraciones (importaciones masivas de facturas aluzinc), se generan cotizaciones con identificador `COT-{documentNumber}`. Nacen con `productionStatus: 'CONFIRMED'`. 
- **Estado de Producción:** Las cotizaciones normales nacen con `productionStatus: 'PENDING'`. Al validarse, se pasan a `'CONFIRMED'` a través del callable `confirmQuotationForProduction` (agregando `confirmedForProductionAt`/`confirmedBy`). Este campo es aditivo y NO afecta a `sales.status`.
