# GEMINI.md — AYR Steel ERP (v6.8)

> **Sprint actual:** Sprint 8 (SUNAT + Estandarización UI + Flejes v2) — En progreso 🏗️
> **Estado:** Build 🟢 | Functions v2 operativa. UI estandarizada con Kit Reutilizable.
> **v6.8:** Import masivo de catálogo aluzinc, unificación tablas Grupo 1, multiselect en kit de tablas, densidad heredada de acabados, layout unificado, correcciones TDZ.

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

## 2. Decisiones de Diseño Lockeadas (v6.8) ⚠️

- **Densidad de bobinas (CORRECCIÓN):** 
  - NATURAL aluzinc = `0.00785` (NO 0.008). 
  - GALVANIZADO = `0.00785`.
  - Prepintados color (AZUL/BLANCO/ROJO/VERDE/GRIS) = `0.008`.
  - **REGLA DE ORO:** Anular afirmación previa "aluzinc natural/colores = 0.008". `densityFactor` se **hereda del acabado** (`coil_finishes`) como fuente única. NO se toma del CSV en los imports. Desnormalizado por bobina.
- **Layout y UI:** Toggle único de sidebar en header (`AdminShell` única fuente). Breadcrumb dinámico (`segmentLabels` + fallback Detalle/Capitalizado) reemplaza el pathname crudo.
- **Patrón de Forms:** Complejo → página dedicada (`/new`); Simple → modal. (Ej: Producción conformado movida a `/production/new`; la página principal aloja historial + botón).

---

## 3. Kit Estándar de Tablas (UI v6.8) 🆕

Se ha unificado la visualización de datos masivos mediante componentes reutilizables en `@/components/ui/`:

- **`DataTable<T>`:** Genérico tipado con `ColumnDef`. Soporta estados de carga, EmptyState y filas numeradas.
- **`TableFilters`:** Barra de búsqueda inline + Drawer lateral derecho.
  - **`FilterGroup`** ahora soporta `multiple?: boolean` (multiselect dinámico). Es **retrocompatible** (default single, sin cambios para tablas existentes).
- **`TablePagination`:** Footer con conteo de registros, navegación, y selector de tamaño (requiere props `pageSizeOptions` + `onPageSizeChange` para mostrar selector). Default `15` global en `useTableData`.
- **`RowActionsMenu`:** Menú de acciones por fila vía Portal (evita cortes por `overflow-hidden`).
- **`useTableData`:** Hook para gestión de búsqueda, filtrado y paginación en el cliente.
  - Expone `customFilter?: (row) => boolean` para lógicas booleanas avanzadas (ej. toggles de stock), evitando dependencias circulares (TDZ) al leer los filtros de states locales.

**Unificación de tablas (en progreso):** 
- **Grupo 1 (HECHO):** 3 inventarios (metallic/roofing/trading) migrados de paginación manual a `useTableData`.
- **Grupo 2 (PENDIENTE):** Server-side con filtros custom (Ventas, Producción Drywall, CRM, Kardex, Usuarios). Migrar solo apariencia manteniendo lógica server-side, caso por caso.
- **Grupo 3:** Ya conforme.

---

## 4. Módulo Import Masivo de Catálogo (/admin/catalog/import) 🆕

- **Acceso:** Botón "Importar masivo" **SOLO** en catálogo aluzinc. (Oculto en otras líneas temporalmente, código comentado para reactivar luego).
- **Filtro del CSV:** Solo si CODIGO empieza `COB*` o `PL*` **Y** `material === ALUZINC`.
- **Funcionamiento:**
  - Editor por ítem (preview editable).
  - Acabado por DROPDOWN dinámico de `coil_finishes` de línea aluzinc (sin match automático).
  - `densityFactor` DERIVADO del acabado seleccionado (se ignora el `FACTOR` del CSV).
  - Duplicados → **SKIP**, nunca merge. Se permite quitar ítems por fila.
  - El guardado delega al `catalogService` de cada línea (no a un shape inventado en el import).
- **Tratamiento de Líneas:**
  - `COB*` → `COBERTURA_ML` (Unidad `METRO`, sin `length`).
  - `PL*` → `PLANCHA_UND` (Unidad `PIEZA`, con `length`). El `length` es derivado del código como SUGERENCIA editable (Ej: `6MT`→6, `515`→5.15, `36`→3.6).
- **Parseo Numérico Robusto:** SheetJS lee con `raw:true` (sin raw, "0,25" se convertía malamente a 25). Todas las columnas numéricas pasan por `parseNumValue` para detectar el separador decimal dinámicamente.

---

## 5. Módulo de Flejes y Producción (v6.5+)

### 5.1 Flujo Oficial Flejes → Piezas
El flujo antiguo `ConsumeStripForm` (basado en `coil.plannedStrips`) ha sido ELIMINADO. El proceso oficial es:
1. **Inventario de Flejes** (`strips_stock`) → Seleccionar fleje disponible.
2. **`OutsourcedProductionForm`** → Registrar piezas producidas.
3. **`produceFromStrip`** → Acción atómica que descuenta stock de flejes e incrementa stock de producto terminado (Drywall).

### 5.2 Organización de Páginas
- **Inventario Drywall:** Página separada para stock de piezas terminadas (perfiles).
- **Producción:** Enfocada en iniciar procesos y ver historial operativo. Soporta query param `?sku=` para prefiltrado.
- **Recepción de Flejes:** Integrada en `cut-orders` (`ReceiveStripsModal`). La ruta dedicada `strips-reception` ELIMINADA.

---

## 6. Arquitectura de Datos (Actualizada)

- **`strips_stock`:** Inventario consolidado por `widthMm`. Campos: `{ totalStrips, totalWeight, avgCostPerKg (WAC) }`.
- **`strips_movements`:** Trazabilidad ENTRADA/SALIDA de flejes con `referenceId` y `costPerKg`.
- **`production_logs`:** Incluyen campo `line: "drywall"`. Historial filtra estrictamente por este campo.
- **`coil.plannedStrips`:** Mantenido como histórico. Flejes migrados llevan `migratedToStripsStock: true` + `originalPendingCount`.
- **`cut_orders`:** Punto de entrada para nuevos procesos de corte; no se reconstruye desde logs antiguos.

---

## 7. Módulo SUNAT (v6.4)

### 7.1 Arquitectura y Callables
- **Emisión DIRECTA:** `xmlGenerator`, `xmlSigner`, `apiSunat` (SOAP).
- **Secretos:** Secret Manager (binding mínimo). `functions/.secret.local` para emulador.
- **Consultas:** RUC/DNI vía **decolecta.com** (Authorization Bearer token).

---

## 8. UX y Confirmaciones 🆕

Se han reemplazado `confirm()` y `prompt()` nativos por `useConfirm()`:
- **`ConfirmProvider`:** Montado en el layout raíz.
- **`ConfirmDialog`:** Variantes `default`, `danger`, `warning`.
- **`requireInput`:** Soporta campos obligatorios y validación exacta (ej: escribir "ELIMINAR" para resetear BD).
- **22 call sites migrados** incluyendo anulaciones, eliminaciones y acciones críticas.

---

## 9. Roadmap y Log de Migraciones (v6.8) 🆕

- **HECHO (v6.8):** Import masivo Catálogo Aluzinc. Kit de tablas Multiselect. Unificación tablas Grupo 1. Patrón Forms v2 y Layout centralizado. Correcciones TDZ (Runtime).
- **Migración Coils:** `densityFactor` desnormalizado por bobina heredado de `coil_finishes`, saneo `finish=GALV`. **APLICADO EN TEST** (41 bobinas). **PENDIENTE en PROD** (requiere verificar `coil_finishes/GALV` en prod + backup gcloud export + dry-run).
- **Log Histórico (v6.5):** Flejes Atrapados migrados a `strips_stock` (36,204 kg). Backfill de campo `line: "drywall"` en 143 logs históricos.
- **PENDIENTE / EN COLA:**
  - **Ventas USD con error:** FFA1-912/913/933 sin `exchangeRate` (Fijar TC real manualmente).
  - **SUNAT BETA:** Prueba real de emisión con certificado `.p12`.
  - **Sprint 7 (Deuda):** `firestore.rules` por rol + Writes críticos a Functions.
  - **Futuro:** Import XML en compras/recepción; guard de "número quemado" en SUNAT; idempotencia status-aware en re-import.
