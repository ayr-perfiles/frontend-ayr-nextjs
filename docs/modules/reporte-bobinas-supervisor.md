# Reporte Bobinas Supervisor

**Fecha de verificación:** 2026-07-31  
*(⚠️ Este documento expira. Si se lee en el futuro, re-verificar contra el código y prod.)*

## Criterios de Sección
- **ABIERTAS:** `isClosed === false && currentWeight > 0`.
- **CERRADAS:** `isClosed === true && |currentWeight - initialWeight| < 0.01`.
- **Excluidas (→ para 'stock', diferido):** bobinas tocadas (parciales), agotadas (`<= 0`), negativas, y anuladas (`VOIDED`).

## Regla ALZ- / ALU- / GALV
El reporte está destinado EXCLUSIVAMENTE a Aluzinc:
- Se incluyen bobinas cuyo `finish` (key crudo) empiece con `'ALZ-'` (bulk en prod) o `'ALU-'` (legacy en test).
- El galvanizado (donde el finish es EXACTAMENTE `'GALV'`) queda explícitamente **excluido**.

## Mapeo Columna → Campo Real
- **UND:** Constante `= 1`.
- **ESPESOR:** `thickness` crudo, sin `toFixed()`.
- **ANCHO:** `masterWidth / 1000` (en metros).
- **ACABADO:** `finish` (la key cruda del objeto, REEMPLAZA a color).
- **PROVEEDOR:** `metadata.provider`.
- **EMPRESA:** Constante `'PERFILES'`.
- **PESO:** `currentWeight`.
- **METRAJE:** Fórmula `weight / (thickness × masterWidth_mm_CRUDO × densityFactor)`.
  - La densidad sale del mapeo en `coil_finishes` (prepintado = 0.008, natural = 0.00785), NUNCA hardcodeado.
- **FECHA:** `metadata.invoiceDate`.
  - Extraída con soporte para `{ seconds }`, `{ _seconds }`, `Date`, y string. El SDK cliente devuelve `Timestamp` que se procesa a `DD/MM/YYYY UTC` usando el helper `normalizeInvoiceDate`.
