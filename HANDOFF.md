# HANDOFF — Sprint 6D Completado (v6.3)

## Estado verificado
- **Versión:** 6.3
- **Líneas de Negocio:** 5/5 activas. PVC (`roofing`) migrado a modelo Compra-Venta.
- **Build:** 🟢 Verde (0 errores en `tsc`).
- **Lint:** 🟢 0 errores, 413 warnings.
- **Tests:** 🟢 264/285 passed. Los fallos actuales (21) son por `PERMISSION_DENIED` debido a que las `firestore.rules` son restrictivas para el entorno de tests de integración actual.

## Logros Recientes (v6.3)
1.  **Navegación por Capacidad:** Rediseño del sidebar (colapsable 260<->72px) y eliminación del `BusinessLineContext`. Las rutas unificadas `/admin/lines/[lineId]/...` son la fuente de verdad.
2.  **Módulo de Compras (Purchases):** Implementación de la colección `purchases` con lógica de valorización WAC/PPP para PVC y Trading. Incluye idempotencia por factura y anulación con validación de stock.
3.  **Ventas Unificadas:** Motor de ventas (Importador + Formulario) ahora descuenta stock de cualquiera de las 5 líneas usando `StockStrategy`.
4.  **Modelo PVC:** Desacople de producción. Ahora `roofing` se maneja como producto terminado de terceros.

## Próximo Sprint: 6B — Producción Metallic
Objetivo: Implementar el `ProductionEngine` para `metallic-roofing` (conformado).

### 🛑 BLOQUEANTES (Pendiente definir con cliente):
1.  **Métrica de Consumo:** ¿Se reporta en Kg directos, o se calcula vía Metros Lineales × Peso Nominal?
2.  **Flujo de Trabajo:** ¿Requiere plan de corte previo (tipo slitter) o es producción directa por bobina?
3.  **Merma:** ¿Existe merma de despunte fija por rollo o es variable?

## Deuda Técnica Crítica
- **Sprint 7 (Seguridad):** Prioridad máxima. Las `firestore.rules` deben cerrarse por rol. Mover escrituras críticas (`purchases`, `strips_stock`, `cut_orders`) a Cloud Functions para asegurar atomicidad y auditoría.

## Archivos clave:
- `src/core/purchases/service.ts` (Nuevo módulo de compras transversal)
- `src/core/sales/strategies/index.ts` (Estrategias de stock 5 líneas)
- `src/core/registry/businessLineRegistry.ts` (Registro de módulos activos)
- `next.config.ts` (Redirects de rutas legacy)
