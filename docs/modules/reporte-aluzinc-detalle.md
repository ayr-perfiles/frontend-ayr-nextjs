# Reporte Aluzinc Detalle (A3)

## A3 (net-new) — terreno PASO 0
*Fecha: 2026-08-12*

### Terreno Confirmado (recon read-only)
- **Reporte 'ventas con producción cumplida'**: página DEDICADA fuera de REPORT_REGISTRY (ReportDefinition/ReportRunner tienen un render rígido que no soporta 3 bloques ni export custom). 
  - **Precedente a copiar**: `src/app/admin/reports/bobinas-supervisor/page.tsx` y su `pdfExport.ts`.
- **PDF**: Se usará `jspdf ^4.2.1` y `jspdf-autotable ^5.0.8` (ya presentes en `package.json`). El patrón de exportación será: `autoTable(doc, {startY, head, body, theme})` (referencia: `bobinas-supervisor/pdfExport.ts`).
- **Parseo SKU**: REUSAR `parseCoverageMetadata` (`src/modules/metallic-roofing/domain/coverageMetadataParser.ts`) para obtener la familia (`COB` → `COBERTURA`, `PL` → `PLANCHA`), extraer el espesor usando `/^(\d{2,3})/` (`030` → `0.30`) y el color vía su diccionario de alias. NO reinventar esta lógica.
- **`aluzinc-detalle`**: Es un desarrollo NET-NEW. Actualmente no existe. `aluzinc-resumen` vive en `aluzincResumenLogic.ts` y se lanza con `reportFunctions.runAluzincResumen`, el cual consulta `sales` con `status=='COMPLETED'` y `scrap_logs`, filtrando por `timestamp`.
- **Estructura de 3 bloques**:
  1. **VENTAS**: Se enlazan a través de `sale.relatedQuotationId` → `COT-*`. El `costSource` viene marcado como `'PRODUCTION'` a nivel de ítem (agregado por el backfill reciente).
  2. **MERMAS**: Es un CÓMPUTO, no un campo persistido directamente. Fórmula: `weightConsumedKg − teorico(ML × ancho × espesor × densidad)`. La densidad se debe consultar SIEMPRE de `coil_finishes`. Esta data vive en `production_log.perCoilBreakdown`.
  3. **PRODUCCIÓN**: Los datos contextuales salen de `production_logs` (incluyendo `sku`, `mlProduced`, `piecesProduced`, y `perCoilBreakdown`). Nota: `costPEN` a veces está como `undefined` en el nivel raíz del log, debiendo consultarse en el `perCoilBreakdown`.
- **Filtro de Período**: Utilizar el helper backend `getPeriodDates(period)` y aplicar `Timestamp.fromDate` sobre el campo `timestamp` (valores de `PERIOD` admitidos: `HOY`, `ESTE_MES`, `HISTORICO`, etc.).
- **Reagrupación/Filtros**: El reporte base debe reagrupar la información por **COLOR + ESPESOR** (derivados mediante `parseCoverageMetadata`). 
- **Drill-down**: Será la vista en detalle net-new a implementar.

### Dudas Pendientes A3
*A resolver al inicio de la próxima sesión (Fase de implementación):*
1. Definición exacta de 'venta con producción cumplida': ¿sale cuya quote linkeada (relatedQuotationId) tiene `isFulfilled==true`? ¿Qué se hace con las ventas POS que no tienen quote vinculada?
2. Merma: Confirmar la fórmula del peso teórico, qué densidad usar por finish (natural 0.00785 vs prepintado 0.008) y qué ancho considerar (puesto que `masterWidth` decrece después de un split → ¿se aproxima a ML?).
3. Scope del PDF: Qué bloques exporta exactamente, si mantendrá un layout landscape, y si generará 1 único documento combinando los 3 bloques.
4. Drill-down: ¿Debe abrir un modal, una sub-tabla expansible o redirigir a una vista aparte al hacer clic en una fila de (color+espesor)?
5. Universo de ventas: ¿Se alineará con el set del `aluzinc-resumen` (`status=='COMPLETED'`) o incluye otros estados?
6. Observaciones auto-derivadas: Definir el conjunto exacto de alertas (ej. merma en %, SKU con peor rendimiento/merma, ventas detectadas sin costo de producción).
