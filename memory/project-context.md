---
name: project-context
description: AYR Steel ERP — coil mutation pattern, auth model, and sprint status
metadata:
  type: project
---

Sprint 8 (SUNAT + Estandarización UI + Flejes v2) — en progreso.

**Coil mutation pattern:** Todas las mutaciones de bobinas son **client-side Firestore transactions** (splitCoilService, coilConsumptionService, scrapService). No Firebase callable. El rol admin se valida como parámetro de la función de servicio.

**Auth model:** `useAuth()` devuelve `role: "ADMIN" | "SUPERVISOR" | "OPERATOR"` leído del documento `users/{uid}` en Firestore (no custom claims). Los callables de Firebase usan `request.auth.token.role` (custom claims deben coincidir — Sprint 7 pendiente).

**Why:** Sprint 7 (Deuda técnica) tiene pendiente firestore.rules por rol + writes críticos a Functions. Hasta entonces, la validación de rol es en la capa de UI/servicio.

**How to apply:** Para operaciones admin-only, validar `role !== "ADMIN"` al inicio del servicio y en RowActionsMenu (show/hide). No depender de Firestore rules aún.
