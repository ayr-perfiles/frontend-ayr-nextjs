---
name: project-pm6-scrap
description: Merma de bobina (P-M6) — what was built, architecture decisions, and collections added
metadata:
  type: project
---

P-M6 (Registro de merma de bobina) completado en Sprint 8.

**Why:** Merma es pérdida de material (bordes de slitting, despuntes, defectos) que reduce el peso de la bobina y debe contabilizarse como costo para el reporte P-M7.

## Colecciones nuevas
- `scrap_logs`: campos `{ coilId, scrapWeightKg, scrapCostPEN, reason, adminId, timestamp }`
- `kardex_movements` ahora acepta `type: "SCRAP"` además de "IN" | "OUT"
- `audit_logs` ahora incluye acción `"REGISTER_SCRAP"`

## Archivos creados
- `src/core/coils/domain/scrap.ts` — funciones puras: validateScrapRequest, calculateScrapCost, calculateNewWeight, determineCoilStatusAfterScrap
- `src/core/coils/services/scrapService.ts` — registerCoilScrap() con runTransaction (patrón client-side como splitCoilService)
- `src/core/coils/services/scrapService.test.ts` — 21 tests Fase 1 (dominio puro, sin Firebase)
- `src/core/coils/components/RegisterScrapModal.tsx` — modal con preview de costo, warning de negativo, useConfirm(warning)

## Archivos modificados
- `src/types/index.ts` — ScrapLog interface + REGISTER_SCRAP en AuditLog.action
- `src/services/kardexService.ts` — type "SCRAP" añadido
- `src/components/kardex/KardexTable.tsx` — badge ámbar "Merma" para type SCRAP
- `src/core/coils/components/InventoryTable.tsx` — "Registrar Merma" en RowActionsMenu (ADMIN, no-SOLD)
- `src/core/coils/components/InventoryModals.tsx` — RegisterScrapModal slot
- `src/app/admin/coils/page.tsx` — scrappingCoil state + onScrap handler

## Decisions
- Client-side Firestore transaction (mismo patrón que splitCoilService), no Firebase callable
- `scrap_logs` colección separada (production_logs tiene schema diferente: piezas producidas)
- Cuando newWeight ≤ 0 → status PROCESSED (no bloquea, pero advierte hasNegativeCoilWarning)
- "Registrar Merma" visible para ADMIN en cualquier estado excepto SOLD

**How to apply:** Al implementar P-M7 (reporte costo/ganancia), leer `scrap_logs` por coilId y sumar scrapCostPEN para incluirlo como costo de la bobina.
