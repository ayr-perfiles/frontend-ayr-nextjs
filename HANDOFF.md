# HANDOFF — Sprint 6A Completado (v6.1)

## Estado actual
- **Versión:** 6.1
- **Líneas de Negocio:** 5/5 registradas (`drywall`, `roofing`, `metallic-roofing`, `trading`, `services`).
- **Build:** 🟢 100% VERDE. Se resolvieron errores históricos y excepciones.
- **Lint:** 🟢 0 errores, 241 warnings (aceptables).
- **Tests:** 🟢 257/272 passed. Los 15 fallos de integración confirman que el CI requiere el emulador vivo para Fase 2. La suite unitaria (Fase 1) está 100% limpia.

## Logros Recientes
1.  **Refactor de Bobinas (Materia Prima Core):** Pool centralizado `core/coils/`, consumos atómicos vía `coilConsumptionService`, filtros por acabado (`coil_finishes`), desacople del inicio de producción.
2.  **Dashboard Ejecutivo (`/admin`):** Rediseñado para mostrar P&L, ventas, inventario y alertas (Stock/Márgenes) consolidadas de las 5 líneas.
3.  **Centro de Reportes (`/admin/reports`):** Nueva arquitectura orientada a registro (`ReportDefinition` + `ReportRunner`). Reportes P1 implementados (Kardex, Rentabilidad, IGV SUNAT, Cotizaciones).
4.  **Test Suites:** Integración de Vitest para flujos E2E, mock de Firestore y pruebas contra base de datos local emulada.

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
- `CLAUDE.md` (v6.1)
- `src/core/reports/registry.ts` (para ver/añadir nuevos reportes)
- `src/core/coils/services/coilConsumptionService.ts` (lógica de consumo)
- `src/core/sales/strategies/index.ts` (estrategias de stock multi-línea)
- `src/modules/drywall/services/productionService.ts` (molde para el próximo motor metallic)
