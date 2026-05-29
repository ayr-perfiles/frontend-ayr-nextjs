# HANDOFF — Sprint 6A (Bobinas a Core y Limpieza de Build)

## Estado actual
- **Líneas de Negocio:** 5/5 registradas (`drywall`, `roofing`, `metallic-roofing`, `trading`, `services`).
- **Build:** 🟢 100% VERDE. Se resolvieron errores de tipos y rutas huérfanas.
- **Lint:** 🟢 0 errores, 241 warnings (aceptables).
- **Tests:** 🟢 257/272 passed. Los 15 fallos son de integración y requieren el emulador de Firestore activo. La suite unitaria (Fase 1) está totalmente limpia.
- **Materia Prima:** Bobinas movidas a `core/coils/`. Gestión centralizada y line-agnostic lista.

## Logros de la sesión
1.  **Refactor de Bobinas:** La materia prima es ahora transversal. Se creó un servicio de consumo atómico (`coilConsumptionService`) que maneja peso y stock PEPPS de forma segura.
2.  **Sistema de Acabados:** Se implementó la colección `coil_finishes`. Las bobinas ahora tienen compatibilidad forzada (ej: solo bobinas GALVANIZADAS aparecen para producir Drywall).
3.  **Desacoplamiento:** La producción ahora se inicia desde cada módulo de línea, no desde el inventario global de bobinas.
4.  **Estabilidad:** Se eliminaron las excepciones de build para `coils/page.js`. El proyecto compila limpiamente para producción.
5.  **Infraestructura de Test:** Se crearon suites de integración reales que corren contra el emulador, cubriendo concurrencia y transacciones de stock.

## Próximo Sprint: 6B — Producción Metallic
Objetivo: Implementar el `ProductionEngine` para `metallic-roofing` (conformado).

### 🛑 BLOQUEANTES (Pendiente definir con cliente):
1.  **Métrica de Consumo:** ¿Se reporta en Kg directos, o se calcula vía Metros Lineales × Peso Nominal?
2.  **Flujo de Trabajo:** ¿Requiere plan de corte previo (tipo slitter) o es producción directa por bobina?
3.  **Merma:** ¿Existe merma de despunte fija por rollo o es variable?

### Patrón recomendado para 6B:
- Espejar la estructura de `drywall/engines/production.ts`.
- Usar el molde de `PlanOperation` / `ExecuteOperation`.
- **IMPORTANTE:** Consumir siempre vía `coilConsumptionService.consume` (en `src/core/coils/services/`) para mantener la integridad del pool de materia prima.

## Deuda Técnica Crítica
- **Sprint 7 (Seguridad):** Las `firestore.rules` siguen 100% abiertas. Se requiere implementar el RBAC por colección y mover las escrituras de stock/kardex/audit a Cloud Functions para evitar manipulación desde el cliente.

## Archivos clave para la próxima sesión:
- `GEMINI.md` (v6.0)
- `src/core/coils/services/coilConsumptionService.ts` (lógica de consumo)
- `src/core/sales/strategies/index.ts` (estrategias de stock)
- `src/modules/drywall/services/productionService.ts` (ejemplo de implementación)
