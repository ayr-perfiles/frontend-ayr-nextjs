# ADR-010: Guard posterior de venta COMPLETED en anulación de producción

**Estado:** Aceptada
**Fecha:** 2026-07-07 (formaliza decisión implementada en v6.21, CERRADA EN PROD)
**Decisores:** Equipo AYR Steel
**Sprint:** 7 (Seguridad Capa 2)

---

## Contexto y problema

`voidProductionFromCoils` resta del stock del producto terminado la cantidad y el valor de la corrida anulada. Si **después** de esa producción hubo una venta COMPLETED del mismo SKU, anular la producción puede dejar el stock/valorización incoherente con una venta ya facturada (el PT vendido "nunca habría existido").

Complicación encontrada en la misma sesión de implementación: las ventas **ex-cotización** spreadean el `timestamp` de creación de la cotización (anterior a la producción), no el momento de aprobación. Comparar solo contra `timestamp` producía un **false-negative real**: una venta aprobada DESPUÉS de la producción parecía anterior y el guard no saltaba.

## Opciones consideradas

1. **No guardear (confiar en el ADMIN):** riesgo de inconsistencia contable silenciosa post-facturación. Descartada.
2. **Comparar contra `sale.timestamp`:** falla con ventas ex-cotización (false-negative comprobado). Descartada.
3. **Comparar contra `approvedAt ?? timestamp` (elegida):** `approvedAt` existe solo en ventas aprobadas desde cotización y refleja el momento real del efecto en stock; fallback a `timestamp` para ventas directas.

## Decisión

**Hard-block (`failed-precondition`)** en `voidProductionFromCoils` si el SKU del log tiene alguna venta con `status: "COMPLETED"` cuyo `(approvedAt ?? timestamp) > log.timestamp`.

- Fail-closed: es un bloqueo duro, no un warning.
- El operador debe anular primero la venta posterior (flujo A2 desacoplado: anular venta no toca producción) y recién entonces anular la producción.

Implementación: `functions/src/callables/production.ts` (query pre-transacción sobre `sales` por SKU + status COMPLETED, comparación de timestamps con el coalesce).

## Consecuencias

### Positivas ✅
- Imposible dejar una venta facturada apoyada en producción inexistente.
- El fix `approvedAt ?? timestamp` cierra el false-negative de cotizaciones — encontrado y corregido antes de deployar a prod.

### Negativas ⚠️
- Anulaciones legítimas de producciones viejas pueden requerir anular ventas intermedias primero (fricción operativa aceptada — es el orden contable correcto).
- El guard depende de que `approvedAt` se grabe consistentemente al aprobar cotizaciones (invariante de `approveQuotation`).

### Pendiente 🔵
- El mismo guard debe agregarse a la futura migración de `revertProductionLog` drywall (WRITE 7) — hoy la reversa drywall client-side NO lo tiene.

## Referencias
- CLAUDE.md v6.21 (cabecera y §3.3) · HANDOFF.md ("GUARD POSTERIOR nuevo").
- ADR-009 (costo congelado — el guard protege la otra mitad del problema: la coherencia hacia adelante).
