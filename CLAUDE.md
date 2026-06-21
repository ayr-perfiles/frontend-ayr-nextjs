# CLAUDE.md — AYR Steel ERP (v6.6)

> **Sprint actual:** Sprint 8 (SUNAT + Estandarización UI + Flejes v2) — En progreso 🏗️
> **Estado:** Build 🟢 | Functions v2 operativa. UI estandarizada con Kit Reutilizable.
> **v6.6:** Cierre del Sprint 6B (Aluzinc completo). Pipeline conformado, corte y mermas funcional. Handoff de migración y saneo listo para la siguiente sesión.


---

## 1. Contexto del Producto

ERP modular para transformación y comercialización de acero/PVC. 5 líneas de negocio integradas bajo navegación por capacidad operativa. Internamente el sistema **trabaja en kg**.

| # | Línea | Módulo | Estado | Materia Prima | Modelo |
|---|---|---|---|---|---|
| 1 | **Drywall** | `drywall` | ✅ | Bobina (vía Flejes) | Transformación |
| 2 | **Metallic Roofing**| `metallic-roofing` | 🏗️ Sprint 6B (BLOQUEADO) | Bobina (Conformado) | Transformación |
| 3 | **Roofing (UPVC)** | `roofing` | ✅ | Producto Terminado | Compra-Venta |
| 4 | **Trading** | `trading` | ✅ | Terceros | Compra-Venta |
| 5 | **Services** | `services` | ✅ | N/A | No-OP Stock |

---

## 2. Kit Estándar de Tablas (UI) 🆕

Se ha unificado la visualización de datos masivos mediante componentes reutilizables en `@/components/ui/`:

- **`DataTable<T>`:** Genérico tipado con `ColumnDef`. Soporta estados de carga, EmptyState y filas numeradas.
- **`TableFilters`:** Barra de búsqueda inline + Drawer lateral derecho para filtros complejos (`filterGroups`, `dateRange`).
- **`TablePagination`:** Footer consistente con conteo de registros, navegación de páginas y selector de tamaño de lote.
- **`RowActionsMenu`:** Menú de acciones por fila vía Portal (evita cortes por `overflow-hidden`).
- **`useTableData`:** Hook para gestión de búsqueda, filtrado y paginación en el cliente.

**Alcance:** Migradas TODAS las tablas de lista (Ventas, Bobinas, Órdenes de Corte, Inventarios, Catálogos, Compras, Producción, CRM, Kardex, Usuarios, Auditoría).
**Exclusiones:** Reportes (Recharts), tablas de detalle en modales, tickets de impresión y previews de importación.

---

## 3. Módulo de Flejes y Producción (v6.5) 🆕

### 3.1 Flujo Oficial Flejes → Piezas
El flujo antiguo `ConsumeStripForm` (basado en `coil.plannedStrips`) ha sido ELIMINADO. El proceso oficial es:
1. **Inventario de Flejes** (`strips_stock`) → Seleccionar fleje disponible.
2. **`OutsourcedProductionForm`** → Registrar piezas producidas.
3. **`produceFromStrip`** → Acción atómica que descuenta stock de flejes e incrementa stock de producto terminado (Drywall).

### 3.2 Organización de Páginas
- **Inventario Drywall:** Página separada para stock de piezas terminadas (perfiles).
- **Producción:** Enfocada en iniciar procesos y ver historial operativo. Soporta query param `?sku=` para prefiltrado desde el inventario.
- **Recepción de Flejes:** Integrada en `cut-orders` (`ReceiveStripsModal`). La ruta dedicada `strips-reception` fue ELIMINADA por redundancia.

---

## 4. Arquitectura de Datos (Actualizada)

- **`strips_stock`:** Inventario consolidado por `widthMm`. Campos: `{ totalStrips, totalWeight, avgCostPerKg (WAC) }`.
- **`strips_movements`:** Trazabilidad ENTRADA/SALIDA de flejes con `referenceId` y `costPerKg`.
- **`production_logs`:** Incluyen campo `line: "drywall"`. Historial filtra estrictamente por este campo.
- **`coil.plannedStrips`:** Mantenido como histórico. Flejes migrados llevan `migratedToStripsStock: true` + `originalPendingCount`.
- **`cut_orders`:** Punto de entrada para nuevos procesos de corte; no se reconstruye desde logs antiguos.

---

## 5. Módulo SUNAT (v6.4)

### 5.1 Arquitectura y Callables
- **Emisión DIRECTA:** `xmlGenerator`, `xmlSigner`, `apiSunat` (SOAP).
- **Secretos:** Secret Manager (binding mínimo). `functions/.secret.local` para emulador.
- **Consultas:** RUC/DNI vía **decolecta.com** (Authorization Bearer token).

---

## 6. Roadmap

- **HECHO (v6.5):**
  - Kit de tablas estandarizado + Migración de todas las listas.
  - Flujo oficial Flejes → Piezas + Eliminación de flujo `ConsumeStripForm`.
  - Página de Inventario Drywall independiente.
  - Migración "Flejes Atrapados" (sembrado de `strips_stock` desde modelo viejo).
  - Backfill de campo `line` en 143 logs históricos.
  - Sistema `useConfirm` (Modales vs Diálogos nativos).
  - Fixes: RUC en `SendToCut`, botones UI, búsqueda duplicada, visualización de bobina vinculada a orden de corte.
- **PENDIENTE / EN COLA:**
  - **Ventas USD con error:** FFA1-912/913/933 sin `exchangeRate` (Fijar TC real manualmente).
  - **SUNAT BETA:** Prueba real de emisión con certificado `.p12`.
  - **Sprint 7 (Deuda):** `firestore.rules` por rol + Writes críticos a Functions.
  - **Sprint 6B Metallic:** BLOQUEADO por definiciones del cliente.
  - **Futuro:** Import XML en compras/recepción; guard de "número quemado" en SUNAT; idempotencia status-aware en re-import.

---

## 7. UX y Confirmaciones 🆕

Se han reemplazado `confirm()` y `prompt()` nativos por `useConfirm()`:
- **`ConfirmProvider`:** Montado en el layout raíz.
- **`ConfirmDialog`:** Variantes `default`, `danger`, `warning`.
- **`requireInput`:** Soporta campos obligatorios y validación exacta (ej: escribir "ELIMINAR" para resetear BD).
- **22 call sites migrados** incluyendo anulaciones, eliminaciones y acciones críticas.

---

## 8. Log de Migraciones (v6.5) 🆕

- **Flejes Atrapados:** `scripts/migrate-trapped-strips.js`. Migró 32 flejes (36,204 kg) de `plannedStrips` a `strips_stock`. WAC ponderado por peso. Idempotente vía `referenceId: MIGRATION_TRAPPED_v1`.
- **Backfill Line:** `scripts/backfill-production-line.js`. Inyectó `line: "drywall"` en documentos antiguos para habilitar filtrado en Firestore.
