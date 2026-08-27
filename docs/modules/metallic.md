# Módulo Metallic (Aluzinc)

Esta ficha contiene la verdad operativa del módulo de Conformado Aluzinc (Metallic Roofing).
Fecha de última verificación: **2026-08-19** (guards `laterSales` endurecidos con `toMillisSafe`, §4) — **§5 agregada 2026-08-24 (v6.58.0), resto del doc sin re-verificar en esa fecha.**

> ⚠️ **BANNER DE ESTADO (2026-08-27, alcance: solo este banner) — EL MÓDULO ESTÁ VACÍO.** Frente `[ALUZINC-RESET]` (v6.71.0 en CLAUDE.md) borró físicamente, autorizado por el dueño: 0 bobinas aluzinc, 0 `metallic_roofing_stock`, 0 `metallic_roofing_stock_movements`, 0 `production_logs`/`sales`/`scrap_logs` de la línea. El CÓDIGO descrito abajo (catálogo multi-acabado, freeze-WAC, cotizaciones importadas) no cambió — pero no hay ni un solo doc vivo hoy sobre el que se ejecute. `coil_finishes` (§1) sobrevive intacto.

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

## 4. Guard `laterSales` de anulación — endurecido con `toMillisSafe` (2026-08-19, commit `5f17db81`)

`voidProductionFromCoils` (y su gemelo dentro de `revertProductionLog`, drywall) tienen un guard "GUARD POSTERIOR" (`production.ts:423-442`) que, antes de anular un `production_log`, busca ventas `status:'COMPLETED'` del mismo SKU y bloquea si alguna es posterior a la producción (`saleData.approvedAt ?? saleData.timestamp`, comparado contra `logTimestamp`).

- **Bug real (no teórico):** el guard asumía que ese campo siempre era un `Timestamp` de Firestore real (llamaba `.toMillis()` directo). Si el campo venía guardado como objeto plano `{_seconds,_nanoseconds}` (visto en test, ver abajo), el guard **crasheaba con `TypeError` no manejado** — el cliente solo veía un `500 Internal` genérico, sin mensaje de negocio.
- **Fix:** helper puro `toMillisSafe(v): number | null` (`functions/src/domain/timestamps.ts`) — tolera `Timestamp` real, `{_seconds,_nanoseconds}`, `{seconds,nanoseconds}`, `Date`, `number` (ya millis); cualquier otra cosa (incluido falsy) → `null`. Ambos guards (`production.ts` y `drywallProduction.ts`) lo consumen — mata la duplicación entre los dos. Si `toMillisSafe` da `null` para cualquiera de los dos lados de la comparación, el guard mantiene el mismo bloqueo conservador que ya existía (`HttpsError('failed-precondition', ...)`, texto sin cambios) — **nunca crashea, nunca deja pasar una anulación que no puede verificar**.
- **Alcance real en prod (2026-08-19):** 0/328 docs de `sales` con `timestamp`/`approvedAt` corrupto — el fix es preventivo en prod, no repara ningún dato existente. La corrupción confirmada era específica de `ayrsteel-test` (al menos `sales/FFA1-1289` y `sales/FFA1-1290`, mismo epoch que sus contrapartes sanas en prod — la causa exacta, qué script de seed/restore de TEST serializó el timestamp como JSON crudo, no se investigó).
- **No tocado a propósito:** `functions/src/callables/scrap.ts:150/164` tiene el mismo patrón `.toMillis()` sin guardia (sobre `createdAt`, no `sales.timestamp`) — no se extendió `toMillisSafe` ahí, ni se investigó si hay corrupción (fuera del alcance del sizing de esta sesión). Ver deuda en CLAUDE.md/HANDOFF.md v6.48.6.
- **Recon/sizing/deploy crudos:** `scripts/local/recon-void500.md` (diagnóstico del 500), `scripts/local/recon-void-sizing.md` (conteo en prod + alcance del daño), `scripts/local/impl-void.md` (RED→GREEN del fix), `scripts/local/deploy-void.md` (deploy test→prod, incluye el hallazgo de que `firebase-functions-hash` no es comparable cross-project).

## 5. `metallic_roofing_stock_movements` — writers, campos e idempotencia (2026-08-24, v6.58.0)

4 writers escriben esta colección, todos con `tx.set(doc(collection(...)))` — **auto-id, NO determinístico. No hay guard de idempotencia a nivel de movimiento** (el único dedup del sistema está a nivel del DOC de `sales`, ver §6 abajo).

| Writer | Archivo | `type` | Campos propios |
|---|---|---|---|
| `writeSaleDecrement` | `src/core/sales/strategies/index.ts` (cliente) / `functions/src/domain/strategies/metallicRoofingStockStrategy.ts` (server) | `SALIDA` | `reason: Venta ${saleId} — ${customerName}` (lleva el id de venta) |
| `writeSaleReversal` | ídem | `ENTRADA` | `reason: motivo ?? Anulación Venta ${saleId} — ...`, `adjustedDocument: ref \|\| null` |
| `writeProductionIncrement` | ídem | `ENTRADA` | `reason: description ?? 'Ingreso por Producción'` (SIN `adjustedDocument`) |
| `writeAnnulNCDecrement` | solo server, `metallicRoofingStockStrategy.ts` | `SALIDA` | `reason: motivo ?? Anulación NC ${saleId} — ...`, `adjustedDocument: ref \|\| null` |

Campos comunes a los 4: `sku`, `type`, `quantity`, `costPerUnit`, `businessLine: 'metallic-roofing'`, `createdBy`, `createdAt`.

- **`adjustedDocument` NO es el id del movimiento actual ni de la venta que lo generó** — solo lo pueblan `writeSaleReversal`/`writeAnnulNCDecrement` (los 2 writers de NC), y vale el **comprobante ORIGINAL que la NC ajusta** (`sale.adjustedDocument`, columna Excel "DOCUMENTO AJUSTADO", ej. `FFA1-1107`), NUNCA el id de la propia NC. Consecuencia medida: una query `where adjustedDocument == '<id de NC>'` devuelve **0 resultados** — hay que buscar por el comprobante ajustado, no por la NC. Para `writeSaleDecrement`/`writeProductionIncrement` el campo directamente no existe en el doc.
- **La clave que sí identifica el universo completo de una venta es `(sku, type, quantity, reason)`** — `reason` de `writeSaleDecrement`/`writeSaleReversal` lleva el id de venta embebido en el string. Puede dar falsos positivos legítimos (2 líneas del mismo SKU/quantity en una misma venta); verificar contra `items[]` antes de tratar un grupo como duplicado.
- **§6 — Re-importar una venta (`isReplacement`) NO limpia sus movimientos previos.** El dedup del importador (`sales/import/page.tsx`, `existingSaleSnap.data().status`) opera sobre el DOC de `sales`: si existe y está `VOIDED`, permite `isReplacement:true` y re-ejecuta el loop de items completo, generando un 2º juego de movimientos con auto-id nuevo — el 1º nunca se borra ni compensa. Si el doc de `sales` fue borrado **sin pasar por una anulación real** (sin quedar `VOIDED`, sin revertir stock), el guard ni siquiera entra en la rama `isReplacement`: `isReplacement` queda `false` y el re-import escribe igual un 2º juego de movimientos sobre el terreno vacío. Medido en prod (v6.58.0): esto es lo que generó 89 grupos de movimientos duplicados el 13→17-ago sobre 7 SKUs (`COB030ROJO`, `PL030NT6M`, `COB030AZUL`, `PL030RJ6MT`, `PL030AZ6MT`, `PL030NT515`, `PL030NT366M`) — causa real: un borrado masivo de 114 docs de `sales` sin auditoría entre el 13 y el 17-ago (ver CLAUDE.md/HANDOFF.md v6.58.0).
