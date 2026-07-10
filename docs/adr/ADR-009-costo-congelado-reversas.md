# ADR-009: Costo congelado en reversas (nunca WAC actual)

**Estado:** Aceptada
**Fecha:** 2026-07-07 (formaliza decisión vigente desde v6.15; validada en runtime prod en v6.15/v6.19/v6.21)
**Decisores:** Equipo AYR Steel
**Sprint:** 7 (Seguridad Capa 2)

---

## Contexto y problema

El ERP permite anular transacciones de inventario (producción, merma, split). Cada anulación debe devolver peso y **valor contable** al origen. La pregunta: ¿a qué costo se devuelve?

- El `pricePerKg` de una bobina y el `avgCost` de un producto terminado **pueden cambiar** entre la transacción original y su reversa: nuevas producciones re-blendan el WAC, y una corrección de datos puede tocar el precio de la bobina.
- Si la reversa releyera el costo vigente, devolvería un monto distinto al que salió → el ledger (kardex/movements) deja de cuadrar y el inventario acumula error contable **silencioso e imposible de auditar**.

## Opciones consideradas

1. **Releer costo actual al revertir (WAC vigente):** simple, pero contablemente incorrecto — la reversa no espeja la transacción original. Descartada.
2. **Costo congelado (elegida):** la reversa usa exclusivamente los valores grabados en el documento de la transacción original (`production_logs.perCoilBreakdown[].costPEN`, `scrap_logs.scrapCostPEN`, `SaleItem.baseCost`/`frozenCost`, `child.pricePerKg`).

## Decisión

**Toda reversa devuelve valor al costo CONGELADO de la transacción original.** Si el documento original no guarda el costo por kg explícito, se **deriva** de lo que sí guarda (ej. `scrapCostPEN / scrapWeightKg`) — nunca se relee del estado vivo.

Implementaciones vigentes (con la línea que lo prueba):

| Reversa | Fuente congelada | Código |
|---|---|---|
| `voidProductionFromCoils` | `breakdown.costPEN / breakdown.weightConsumedKg` | `functions/src/callables/production.ts:368` |
| `voidCoilScrap` | `scrapLog.scrapCostPEN / scrapLog.scrapWeightKg` | `functions/src/callables/scrap.ts:210` |
| `reverseCoilSplit` | `child.pricePerKg` (inmutable post-creación) | `functions/src/callables/split.ts:273` |
| `writeSaleReversal` (NC/anulación, cliente) | `frozenCost` del item | `src/core/sales/strategies/index.ts:214` |

Validación runtime prod (v6.21): se mutó `pricePerKg` de la bobina a 9.99 después de producir; la anulación devolvió al costo original 4/5 — el congelado ganó.

## Consecuencias

### Positivas ✅
- El kardex cuadra: lo que salió a costo X vuelve a costo X.
- Las reversas son auditables contra el documento original sin reconstruir historia.
- Independencia de orden: revertir después de N producciones posteriores no contamina el monto devuelto.

### Negativas ⚠️
- El `avgCost` del stock post-reversa se **recalcula** con el valor congelado restado/devuelto (mixto: valor congelado, promedio recalculado) — correcto, pero exige entender la distinción (documentada en CLAUDE.md §3.3 y `docs/05-formulas/modelo-de-costeo.md`).
- Los documentos de transacción deben grabar el breakdown completo (`perCoilBreakdown`) — sin él, la reversa aborta (fail-closed).

### Excepciones conocidas (deuda, no cambian la decisión) 🔵
- `voidPurchase` (`src/core/purchases/service.ts:194-199`): WAC inverso aproximado con fallback — pre-existente, alinear cuando compras migre a callable.
- `revertProductionLog` drywall (client-side): WAC-lookback legacy — decisión de alineación pendiente en WRITE 7 drywall (HANDOFF).

## Referencias
- CLAUDE.md v6.21 §3.3, §3.7, §11 Convenciones ("Reversa siempre al costo congelado").
- `docs/05-formulas/modelo-de-costeo.md` Principio 1 · fichas F-C5/F-C7/F-C8/F-V3.
- ADR-010 (guard posterior, complementario).
