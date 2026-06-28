# Handoff — AYR Steel ERP (Siguiente Sesión)

> **Subir SIEMPRE al inicio:** este `HANDOFF.md` + `CLAUDE.md` (v6.10).
> **Foco próxima sesión:** Sprint 7 EN CURSO. Runtime B de scrap (merge frontend → merma real prod → cerrar rule scrap_logs). LUEGO write 2 (`splitCoilAction`) replicando el patrón probado.
> **Preferencias (MANTENER):** Prompts de Claude Code por defecto. Caveman mode. Cada prompt con PASO 0 read-only. Preguntar ante cualquier duda. NUNCA dar por cerrado en verde sin validación en RUNTIME (tsc y tests verdes son necesarios, pero no suficientes para capturar todos los problemas en producción).

---

## 1. Estado al cerrar esta sesión

- **Sprint 7 EN CURSO:** Decisiones de diseño CERRADAS (registradas en CLAUDE.md como ADR).
- **WRITE 1 (`registerCoilScrap`) estado:** Desplegada en prod y validada. Pendientes: cerrar rule `scrap_logs` (pero no `coils-weight` aún).
- **WRITE 2 (`splitCoilAction`) HITO 5 (CIERRE):** Migración confirmada. `splitCoilService` ya NO escribe directo a BD vía `runTransaction` desde cliente, sólo llama a `httpsCallable('registerCoilSplit')`. (NO se cierran rules de coils/kardex/audit aún porque hay otros flujos pendientes).
- **SEPARACIÓN CODEBASES:** `functions/` (default, sin secretos) + `functions-sunat/` (SUNAT+purchases+integrations+secrets.ts).

---

## 2. Deuda Técnica y Pendientes Críticos

- **Tipos Duplicados (`CoilStatus`):** copiado literal en `functions/src/domain/coilPricing.ts` (junto a `correlative.ts`) desde `src/types/index.ts` para aislar backend. Riesgo de divergencia silenciosa (paridad no lo atrapa). *Mitigación temporal*: Comentarios `// SYNC-MARKER` añadidos. *Fix futuro*: paquete de tipos compartido o test que compare definiciones.
- **`idempotency_keys`:** Estrenada en WRITE 2 (split). scrap (WRITE 1) legacy quedó sin idempotencia. Es un patrón reusable para writes 3-6. Queda pendiente: Sin TTL/limpieza de keys aún (¿crecen indefinidamente? deuda menor a evaluar).
- **Lección runtime:** Validar frontend en incógnito (bundle cacheado puede correr legacy). Agregar a reglas de validación en futuras pruebas.
- **Hijas legacy huérfanas sin `densityFactor` en `ayrsteel-test`:** (de pruebas pre-migración) — basura de test, limpiar si molesta, no urgente.
- **Candado pendiente para Rules:** Las colecciones `coils` / `kardex_movements` / `audit_logs` NO se pueden cerrar (bloquear client-writes) hasta migrar `produce` + `sale` (scrap ya migrado). 
  - *Inventario de escritores cliente (runTransaction) restantes en `src/core/coils/`:*
    - `coilConsumptionService.ts`
    - `coilService.ts`
    - `cutOrderService.ts`
    - `stripsStockService.ts`
- 🔴 **DEUDA ÍNDICES:** 6 índices Firestore sin desplegar (auditoría v6.10): `listAvailableCoils`, `MovementsModal`, catálogos trading/roofing CRÍTICOS (revientan en runtime). Definiciones exactas ya derivadas.
- **ESQUEMA `kardex_movements` (Semántica de Unidades):**
  - *Problema:* Divergencia semántica en `quantity` y `balance` entre bobinas (usan `quantity: 1` + `weightKg` + `balance` en kg) y drywall (usan `quantity`/`balance` en piezas).
  - *Fix:* Introducir un campo `unit` explícito (`PIECES` | `KG`) por documento y eliminar el `quantity: 1` placeholder en bobinas para habilitar renderizado condicional adaptativo.

---

## 3. Próxima Sesión

Arranca con: WRITE 3 (ej. `produce` o `sale`) replicando el patrón probado con idempotency keys, cerrando poco a poco las llamadas legacy de `runTransaction` en los servicios del core.

---

## 4. Suggested Skills

- `grill-me`: Para realizar stress-test y alineación sobre el plan del Sprint 7 de Cloud Functions.
- `tdd`: Para desarrollar las Cloud Functions interactivamente usando el emulador y tests de integración.
- `diagnose`: Ante cualquier comportamiento extraño o bug en runtime.
- `handoff`: Para cerrar sesiones futuras de forma estructurada.
