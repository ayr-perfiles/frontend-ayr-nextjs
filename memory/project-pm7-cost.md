---
name: project-pm7-cost
description: Aluzinc Costo + Ganancia (P-M7) — costeo con baseCost congelado, merma del periodo en totals
metadata:
  type: project
---

P-M7 (Reporte Aluzinc Costo + Ganancia) completado en Sprint 8.

**Why:** Cierra el whiteboard de aluzinc. P-M3 entregó Ventas; P-M7 agrega Costo y Resumen Ganancia.

## Decisión de costeo
`SaleItem.baseCost` = `stockItem.avgCost` (WAC de metallic_roofing_stock al agregar al carrito en ProductSelector línea 332/566). Está siempre en PEN. NO necesitó P-M7.1 — el costo ya estaba congelado en el documento de venta.

**Fórmula:** `costoTotal = Σ (item.baseCost × item.quantity)` — sin conversión de moneda (baseCost es siempre PEN).

## Merma en el resumen
`scrap_logs.scrapCostPEN` del periodo se suma como `mermaSoles` en `totals` del resumen.
No se atribuye a un color específico — aparece solo en el total.
`Ganancia Neta = TotalVenta − TotalCosto − TotalMerma`

## Archivos creados
- `src/modules/metallic-roofing/domain/aluzincCostReport.ts` — buildAluzincCostReport + buildAluzincProfitSummary (puras)
- `src/modules/metallic-roofing/domain/aluzincCostReport.test.ts` — 13 tests Fase 1

## Archivos modificados
- `src/core/reports/services/reportFunctions.ts` — runAluzincCosto + runAluzincResumen (runners)
- `src/core/reports/registry.ts` — entradas `aluzinc-costo` (MATERIA_PRIMA) + `aluzinc-resumen` (EJECUTIVO)

## Registry entries
- `aluzinc-costo`: mismos filtros que aluzinc-ventas (period, colorFilter, espesorFilter); columnas: thicknessMm, colorFinish, metrosTotales, pesoKg, toneladas, costoTotal, costoPorKg
- `aluzinc-resumen`: filtro period solo; columnas: colorFinish, ventaSoles, costoSoles, gananciaSoles, margenPct. Totals cards: ventaSoles, costoSoles, mermaSoles, gananciaSoles

**How to apply:** Para P-M7 Fase 2 (emulador), sembrar bobinas→producción→ventas→merma y validar que los 3 reportes cuadran. La merma de scrap_logs ya se consume en runAluzincResumen.
