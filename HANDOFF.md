# Handoff — AYR Steel ERP (Siguiente Sesión)

> **Subir SIEMPRE al inicio:** este `HANDOFF.md` + `CLAUDE.md` (v6.10).
> **Foco próxima sesión:** Sprint 7 EN CURSO. Runtime B de scrap (merge frontend → merma real prod → cerrar rule scrap_logs). LUEGO write 2 (`splitCoilAction`) replicando el patrón probado.
> **Preferencias (MANTENER):** Prompts de Claude Code por defecto. Caveman mode. Cada prompt con PASO 0 read-only. Preguntar ante cualquier duda. NUNCA dar por cerrado en verde sin validación en RUNTIME (tsc y tests verdes son necesarios, pero no suficientes para capturar todos los problemas en producción).

---

## 1. Estado al cerrar esta sesión

- **Sprint 7 EN CURSO:** Decisiones de diseño CERRADAS (registradas en CLAUDE.md como ADR).
- **WRITE 1 (`registerCoilScrap`) estado:**
  - Function + dominio + 9 tests integración (feliz/rol/sin-rol/input/coil inválido) VERDE.
  - DESPLEGADA Y ACTIVE en prod ayrsteel-2026. `onUserWritten` también desplegado (era deuda Fase 1) y VALIDADO runtime A en prod.
  - PENDIENTE para cerrar scrap: (B) merge frontend scrap a master → runtime: registrar merma real en prod. (C) cerrar rule `scrap_logs` a `if false` (`coils-weight` NO cerrar aún: split/produce también escriben coils).
  - Frontend scrap YA migrado (`RegisterScrapModal`+`scrapService` llaman Callable, `runTransaction` cliente borrado) en develop, NO mergeado a master.
- **SEPARACIÓN CODEBASES:** `functions/` (default, sin secretos) + `functions-sunat/` (SUNAT+purchases+integrations+secrets.ts). Desbloqueó deploys. SUNAT/purchases NO están vivas en prod (código nuevo nunca desplegado, bloqueado por 8 secretos inexistentes en GCP).

---

## 2. Deuda Técnica y Pendientes Críticos

- **`correlative.ts` DUPLICADO:** en `functions/` y `functions-sunat/` (separación codebases). Riesgo divergencia. Resolver: test de paridad o paquete compartido.
- **ayrsteel-TEST:** functions SUNAT/purchases huérfanas en codebase default viejo (deploy dijo N a borrar) → limpiar antes de desplegar codebase sunat a test.
- 🔴 **DEUDA ÍNDICES:** 6 índices Firestore sin desplegar (auditoría v6.10): `listAvailableCoils`, `MovementsModal`, catálogos trading/roofing CRÍTICOS (revientan en runtime). Definiciones exactas ya derivadas.
- **8 secretos SUNAT no existen en GCP prod:** codebase sunat no desplegable hasta crear secretos REALES (NUNCA dummy — rompería Algolia/APIs).
- **ESQUEMA `kardex_movements` (Semántica de Unidades):**
  - *Problema:* Divergencia semántica en `quantity` y `balance` entre bobinas (usan `quantity: 1` + `weightKg` + `balance` en kg) y drywall (usan `quantity`/`balance` en piezas).
  - *Fix:* Introducir un campo `unit` explícito (`PIECES` | `KG`) por documento y eliminar el `quantity: 1` placeholder en bobinas para habilitar renderizado condicional adaptativo.
  - *Decisión:* ¿Una sola tabla adaptativa o vistas separadas? (Se recomienda una sola tabla adaptativa).
  - *⚠️ Implicación:* Dado que los writes 2-5 (split, produce, sale) escribirán más movimientos de bobina a `kardex_movements`, se debe decidir este esquema **antes o en paralelo** a dichos desarrollos para evitar acumular documentos desalineados que requieran migración.

---

## 3. Próxima Sesión

Arranca con: Runtime B de scrap (merge frontend → merma real prod → cerrar rule `scrap_logs`). LUEGO write 2 (`splitCoilAction`) replicando el patrón probado.

---

## 4. Suggested Skills

- `grill-me`: Para realizar stress-test y alineación sobre el plan del Sprint 7 de Cloud Functions.
- `tdd`: Para desarrollar las Cloud Functions interactivamente usando el emulador y tests de integración.
- `diagnose`: Ante cualquier comportamiento extraño o bug en runtime.
- `handoff`: Para cerrar sesiones futuras de forma estructurada.
