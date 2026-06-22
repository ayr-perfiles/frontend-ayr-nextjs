# Handoff — AYR Steel ERP (Siguiente Sesión)

> **Subir SIEMPRE al inicio:** este `HANDOFF.md` + `GEMINI.md` (v6.8).
> **Foco de la próxima sesión:** Revisar y reparar la suite de tests unitarios/integración que se rompieron con los refactors de schemas; luego continuar con migraciones/saneo pendientes, sembrado de datos, y deuda Sprint 7.
> **Preferencias:** Generar **prompts para Claude/Gemini Code** por defecto, NO crear archivos innecesarios. Caveman mode. Preguntar antes de generar si hay dudas. Cada prompt empieza con PASO 0 de reconocimiento (read-only), nunca asumir nombres.

---

## 1. Cierre de la sesión actual (v6.8: Catálogo Aluzinc + Migraciones UI)

**El build (`npm run build`) y TypeScript (`tsc --noEmit`) están 100% verdes, pero `vitest` arrojó 32 tests fallidos**. Debido a esto, **los cambios no fueron commiteados** y el push a Vercel quedó detenido según las reglas de despliegue.

Los logros de esta sesión pendientes de revisión por los tests rotos:
1. **Import Masivo de Catálogo (/admin/catalog/import):**
   - Habilitado solo para aluzinc (`COB*`, `PL*` + `ALUZINC`).
   - Parseo robusto (`SheetJS raw:true` y autodetección de decimales con `parseNumValue`).
   - Selección de acabado vía dropdown dinámico (lee de `coil_finishes`); ignora el `FACTOR` del excel para heredar densidad de la base.
   - Derivación inteligente de longitud (`length`) a partir de códigos como `6MT`, `515`, etc.
2. **Kit de Tablas (UI):**
   - `FilterGroup` ahora soporta `multiple?: boolean` para multiselects (100% retrocompatible).
   - `useTableData` ahora expone `customFilter?: (row) => boolean` para lógicas booleanas avanzadas.
   - Paginación default de 15, selector de cantidad reparado.
3. **Unificación Grupo 1 de Tablas:** Inventarios de metallic-roofing, roofing y trading migrados de manejo manual a `useTableData` completo, erradicando un bug de inicialización (TDZ) aislando los filtros de toggles (stock/negativos).
4. **Layout/Forms:** Unificación de breadcrumbs dinámicos, sidebar layout simplificado, y mudanza del form de producción de conformado a página dedicada (`/new`).

---

## 2. Decisiones de Diseño Lockeadas (NO Revertir)

- **Densidad de bobinas:** NATURAL = `0.00785`. GALVANIZADO = `0.00785`. Prepintados (AZUL/BLANCO/etc) = `0.008`. Única fuente de verdad: el `densityFactor` heredado de `coil_finishes`.
- **Patrón Filter TDZ:** Al usar `customFilter` en `useTableData`, si dicho filtro depende de checkboxes o selects, el state debe vivir en el componente mediante `useState` para evitar una Zona Muerta Temporal (TDZ) que rompe la aplicación en runtime.
- **`perCoilBreakdown` = fuente de verdad por bobina** en logs Aluzinc. Faltarlo = log mal formado = fallo ruidoso.
- **Reversa SIEMPRE al costo congelado** (producción: `sum(costPEN)`; venta: `item.baseCost`), nunca al WAC actual. Drywall ajeno al WAC en devoluciones.
- **Stock/peso negativo permitido** (warning, no bloqueo). Sin borrado físico (VOIDED + audit).

---

## 3. Pendientes Operativos (Ejecutar en Orden)

1. **REPARAR TESTS DE INTEGRACIÓN:** Correr `vitest`, diagnosticar por qué fallaron los tests `salesImport`, `splitCoil`, `salesReversalWAC`, etc. (Posiblemente por la adición de campos requeridos como `finish` o cambio de esquemas recientes no actualizados en los Mocks).
2. **Commit y Deploy:** Una vez verde `vitest`, commitear la sesión v6.8 y hacer push a Vercel.
3. **Migraciones (dry-run → validar → apply):** `migrateFinishDensityFactors`, `migrate-cobertura-metadata`, `fix-density-factor-natural`. 
   - **MIGRACIÓN PROD:** Desplegar desnormalización de `densityFactor` por bobina. Requiere verificar `coil_finishes/GALV` en prod, backup gcloud export, dry-run, luego aplicar.
4. **Sembrar acabados de color** en Test (≥5 base: AZUL/BLANCO/NATURAL/ROJO/VERDE con líneas asignadas). Crear GRIS explícitamente en `coil_finishes`.
5. **Saneo SKUs en PRODUCCIÓN (`fix_skus_prod.ts`):** Dry-run con creds prod → validar → `--apply`.
6. **Validación Ciclo Completo:** (acabado → SKU → bobina → producir → ver historial → anular → vender → anular venta → reporte). Import con CSV real en test.

---

## 4. Deuda Técnica Prioritaria (Sprint 7 & Futuro)

- **Unificación Tablas Grupo 2:** Migrar la apariencia de tablas SSR (Ventas, Prod Drywall, CRM, Kardex, Usuarios) usando `useTableData` pero manteniendo la lógica server-side limpia.
- **Índices Firestore:** Desplegar los 9 índices pendientes (`firebase deploy --only firestore:indexes`).
- **Seguridad DB (Crítico — Sprint 7):** `firestore.rules` abierta. Cerrar por rol + delegar writes críticos a Cloud Functions: `splitCoilAction`, `produceFromCoils`, `voidProductionFromCoils`, `registerCoilScrap`, ventas.
- **Ventas USD sin TC:** FFA1-912/913/933 → fijar TC manual.

---

## 5. Convenciones del Proyecto

- Strict TS: 0 `any` nuevos. Código en inglés; UI/errores/datos en español.
- Patrón Strategy (`getStockStrategy`), no if/else por línea.
- `runTransaction`: lecturas antes de escrituras. Prohibido borrado físico (VOIDED + `audit_logs`).
- Costo en PEN, peso en kg. USD→PEN con TC real, nunca fallback 3.75.
- Reversa al costo congelado; datos mal formados → fallo ruidoso.
- Push directo a `develop` (un solo dev, sin PR).
- Credencial: `serviceAccountKeyTest.json` en raíz → `ayrsteel-test` (NO producción).