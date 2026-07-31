# MÓDULO: coils (bobinas) — verdad de arquitectura
> ÚLTIMA VERIFICACIÓN CÓDIGO+PROD: 2026-07-29 (Frente B, runtime prod ayrsteel-2026, finishes).
> ⚠️ SE PUDRE. Antes de tocar lógica/writes de bobinas: verificá (checklist). No confíes si la fecha está vieja.

## 1. Estado isClosed (regla de negocio verificada)
- Bobinas NACEN CERRADAS (isClosed:true default en registerCoil + registerCoilsBulk). Supervisor abre para producir.
- CERRADA = NO producir, SÍ vender (incluso a medio producir), SÍ split, SÍ merma.
- Guard producción: BLOQUEA en produceFromCoils (aluzinc), consumeCoil (drywall), sendToCut. NO bloquea venta/split/scrap.
- ⚠️ Guard HERMÉTICO solo en produceFromCoils (backend callable, lee isClosed del doc en transaction.get, inmune a inyección de request).
  consumeCoil (drywall) y sendToCut son CLIENT-side → guard solo en cliente = DEUDA DE SEGURIDAD hasta que drywall/corte migren a callable.
- Toggle abrir/cerrar: setCoilClosed (coilClose.ts).

## 2. Fórmula ML (metros lineales) — tabla InventoryTable
- ML = weight / (masterWidth_mm × thickness_mm × densityFactor). masterWidth en mm DIRECTO (NO /1000 — ese bug infló ML x1000).
- ML restante = currentWeight/... · ML total teórico = initialWeight/...
- Densidad SIEMPRE de coil_finishes (0.00785 galv/aluzinc natural, 0.008 aluzinc prepintado). NUNCA hardcodeada. Si falta → "s/densidad", no inventar.
- ML total inflado en bobinas splitteadas (split.ts baja masterWidth, NO initialWeight) → marcar aproximado ("≈≈").

## 3. Catálogo de Acabados (`coil_finishes`)
- **Estructura unificada:** `coil_finishes` opera como FUENTE ÚNICA de acabados. Los documentos cuentan con los campos `tipo` (`Natural`|`Prepintado`|`Galvanizado`) y `color` (`Rojo`|`Azul`|`Blanco`|`Gris`|`Verde`|`'-'`). 
- **Helpers:** `getFinishMeta` lee los campos de BD y `formatFinishChip` inyecta los estilos visuales consistentes (badge colors, etc).
- **Tipado:** Tipado estricto con uniones `FinishType` y `FinishColor`.

## 3. Tabla InventoryTable (8 columnas)
checkbox · Serie(id+proveedor truncado) · Acabado(FinishBadge legible) · Material(dims+originalDescription truncado+tooltip) · Valorización(PEN+USD) · Stock/peso(restante/total kg + ML restante/total + barra) · Estado(StatusBadge+CERRADA) · Acciones. Responsable y Fecha Ingreso → modal, no tabla. Server-side (cursores useCoils.ts) — cambiar filtros toca queries+índices.

## 4. Shape coil (doc real prod): id, initialWeight, currentWeight, masterWidth, thickness, pricePerKg, status, isClosed, isDraft, registeredBy, finish, densityFactor, metadata{provider, invoiceNumber, invoiceDate, originalDescription...}

## 5. VERIFICAR antes de cambio grande: grep escritor vivo · leer 1 doc real de prod · ¿guard backend o solo client? · densidad de coil_finishes nunca hardcodeada.
