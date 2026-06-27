# CLAUDE.md — AYR Steel ERP (v6.10)

> **Sprint actual:** Sprint 8 (SUNAT + Estandarización UI + Flejes v2) — En progreso 🏗️
> **Estado:** Build 🟢 | tsc limpio | 463/463 tests (config serializada) | Functions v2 operativa.
> **v6.10:** Estandarización UI de tablas (kit `@/components/ui/`), migración de datos de "flejes atrapados" completada, sistema de confirmación modal (`useConfirm`), flujo oficial Flejes → Producción, backfill de campo `line` en logs históricos. Frente de seguridad Capa 1 y 9 índices desplegados y validados en PROD.

---

## 1. Contexto del Producto

ERP modular para transformación y comercialización de acero/PVC. 5 líneas de negocio. Internamente el sistema **trabaja en kg**.

| #   | Línea                | Módulo             | Estado                     | Materia Prima          | Modelo         |
| --- | -------------------- | ------------------ | -------------------------- | ---------------------- | -------------- |
| 1   | **Drywall**          | `drywall`          | ✅                         | Bobina (vía Flejes)    | Transformación |
| 2   | **Metallic Roofing** | `metallic-roofing` | ✅ Pipeline completo (dev) | Bobina (Conformado A2) | Transformación |
| 3   | **Roofing (UPVC)**   | `roofing`          | ✅                         | Producto Terminado     | Compra-Venta   |
| 4   | **Trading**          | `trading`          | ✅                         | Terceros               | Compra-Venta   |
| 5   | **Services**         | `services`         | ✅                         | N/A                    | No-OP Stock    |

---

## 2. Kit Estándar de Tablas (UI)

Componentes reutilizables en `@/components/ui/`:

- **`DataTable<T>`:** Genérico tipado con `ColumnDef`. Carga, EmptyState, filas numeradas.
- **`TableFilters`:** Búsqueda inline + Drawer. `filterGroups` ahora soporta **`multiple?: boolean`** (multiselect) RETROCOMPATIBLE — default single, sin cambio para filtros existentes (§6).
- **`TablePagination`:** Footer con conteo, navegación, selector de tamaño. ⚠️ El selector SOLO se muestra si recibe `pageSizeOptions` + `onPageSizeChange`. Soporta **`mode: 'pages' | 'cursor'`** (default 'pages'); 'cursor' oculta números, muestra flechas + "mostrando X–Y de Z" (para server-side, §7).
- **`RowActionsMenu`:** Acciones por fila vía Portal.
- **`useTableData`:** Hook de búsqueda/filtrado/paginación en CLIENTE. Default `pageSize=15`. Soporta `customFilter?: (row)=>boolean`. ⚠️ TDZ: `customFilter` debe leer estado de un `useState` PROPIO de la página, NO del retorno de `useTableData` (dependencia circular → "Cannot access X before initialization").
- **`HeaderOptionsMenu`:** 🆕 Menú de opciones en cabecera (dropdown vía portal). Recibe items `{id,label,icon,href/onClick}`. Reutilizable. Hoy usado para "Importar masivo" en catálogo aluzinc.
- **`useConfirm` / `ConfirmDialog`:** Variantes `default`/`danger`/`warning`; `requireInput`.

**Paginación cliente vs server:** tablas con < ~500 registros usan `useTableData` (cliente, slicing en memoria). Tablas de gran volumen (Ventas, Kardex) usan cursores Firestore (`startAfter`/`endBefore`) server-side + `TablePagination mode="cursor"`. NO forzar useTableData (cliente) en server-side — filtraría solo la página visible.

---

## 3. Módulo Aluzinc / Metallic Roofing

Modelo **A2 desacoplado**: producción y ventas independientes. Anular venta NO toca producción/bobina; anular producción NO toca ventas.

### 3.1 Schema de `production_logs` (unificado con Drywall)

| Campo canónico                                                             | Notas                                                                                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `parentCoilIds: string[]`                                                  | **Fuente de verdad.** Siempre array (1 o N).                                                                        |
| `parentCoilId: string`                                                     | Compat legacy. **SIEMPRE = `parentCoilIds[0]`, nunca `null`**.                                                      |
| `perCoilBreakdown: Array<{coilId, mlFromCoil, weightConsumedKg, costPEN}>` | **Fuente de verdad por bobina.** Habilita modal de rendimiento y anulación exacta.                                  |
| `reportedWeight`                                                           | (eliminado alias `weightConsumedKg`).                                                                               |
| `costPerPiece`                                                             | (eliminado alias `costoUnitarioPEN`).                                                                               |
| `averageCostAfter`                                                         | (eliminado alias `avgCostAfter`).                                                                                   |
| `piecesProduced`                                                           | ML si `COBERTURA_ML`, UND si `PLANCHA_UND`. El `quantity` exacto inyectado a stock. ⚠️ Nombre engañoso (Deuda §10). |
| `mlProduced`                                                               | Propio de Aluzinc. Ausencia válida en planchas.                                                                     |
| `line: "metallic-roofing"`                                                 | Filtro del historial.                                                                                               |
| `status: "ACTIVE" \| "VOIDED"`                                             | Sin borrado físico.                                                                                                 |

### 3.2 Unidad de stock (`metallic_roofing_stock.quantity`)

**MIXTA por `ProductKind`** (derivado de `family` vía `coverageMetadataParser.ts`):

- `COBERTURA_ML` → ML; `avgCost` en S/·ML⁻¹.
- `PLANCHA_UND` → UND; `avgCost` en S/·UND⁻¹.

`produceFromCoils` resuelve unidad (`coilProduction.ts`) y la persiste en `piecesProduced`. La reversa resta `piecesProduced` sin re-consultar tipo.

### 3.3 `voidProductionFromCoils(logId, userEmail)`

`runTransaction`, lecturas antes de escrituras, idempotente, 0 borrado físico.

- Aborta si `status==='VOIDED'` o falta `perCoilBreakdown`.
- **Bobinas:** devuelve `weightConsumedKg` exacto por bobina. Estado por peso resultante con tolerancia ε=0.01 kg (`>= initialWeight-ε → AVAILABLE`, `0<peso<initialWeight-ε → IN_PROGRESS`). Refleja peso NETO (puede tener otras producciones). Movimiento `IN`.
- **PT:** `quantity -= piecesProduced`; `totalValue -= sum(perCoilBreakdown[].costPEN)` (costo congelado, NO WAC actual); `avgCost` recalculado; movimiento `SALIDA`.
- **Audit:** `VOID_PRODUCTION_FROM_COILS`. Sin scrap (aluzinc quema `scrapWidth:0`).

### 3.4 Historial Aluzinc (`MetallicProductionHistory`)

- `useMetallicProductionLogs` filtra `line==='metallic-roofing'`. Kit estándar + columna multi-bobina propia. `RowActionsMenu` → "Anular" (danger, solo ADMIN, si `status!=='VOIDED'`). VOIDED tachados.
- Form de producción movido a página dedicada `/production/new` (no embebido). Página principal = historial + botón "Nueva Producción" (§5).

### 3.5 Lector de rendimiento (`useCoilYield`/`yieldCalc.ts`)

- `where('parentCoilIds','array-contains',coil.id)`. Suma `mlFromCoil` de la entrada del breakdown de esa bobina (NO el `totalMl` global). Excluye VOIDED. **Fallo ruidoso** si falta breakdown.

---

## 4. Import Masivo de Catálogo Aluzinc (v6.9) 🆕

Página `/admin/catalog/import`. Acceso vía `HeaderOptionsMenu` → "Importar masivo", SOLO en catálogo aluzinc (oculto en otras líneas, código comentado para reactivar — el import volverá con otros filtros).

- **Filtro:** CODIGO empieza `COB*` o `PL*` **Y** `material === 'ALUZINC'`. Excluye BOB*, ACCES*, COB*/PL* de compra-venta. (~55 ítems del Excel actual: 36 COB + 19 PL).
- **Editor por ítem** (preview editable): cada fila editable. Campos de selección como dropdown.
- **Acabado:** DROPDOWN de `coil_finishes` filtrado a aluzinc (sin match auto, el usuario elige por fila).
- **densityFactor:** DERIVADO del acabado seleccionado (lookup coil_finishes). **IGNORA el FACTOR del CSV.** Fuente única de densidad = el acabado.
- **COB\* → COBERTURA_ML** (METRO, sin length). **PL\* → PLANCHA_UND** (UND, con length).
- **length de PL:** SUGERIDO desde el código (editable): `6MT→6`, `5MT→5`, `4MT→4`, `515→5.15`, `366→3.66`, `36→3.6`. Editable por si el parseo se equivoca.
- **Autodetección decimal** (`parseNumValue`): coma o punto → normaliza a punto. ⚠️ **SheetJS `read(..., {raw:true})` es CRÍTICO** — sin `raw:true` SheetJS come la coma ("0,25"→25 creyéndola separador de miles). Con raw:true llega string crudo y parseNumValue lo convierte.
- **Duplicados:** SKIP + marcar, NUNCA merge. **Quitar ítem** por fila. Delega a `catalogService` de cada línea (no shape inventado).

---

## 5. Layout y UX (v6.9) 🆕

- **Toggle único de sidebar:** vive en el HEADER. `AdminShell` es la única fuente del estado de colapso (`Sidebar` es controlado). Eliminado el toggle interno duplicado del sidebar.
- **Breadcrumb dinámico:** reemplaza el pathname crudo. Diccionario `segmentLabels` (ruta→label español); IDs/segmentos largos → "Detalle"; residuales → capitalizado.
- **Patrón de forms:** complejo/multi-paso → página dedicada (`/new`); simple → modal. Producción conformado movido a `/production/new`. Barrido confirmó: drywall/catálogos/cut-orders ya en modal (simples); ventas/compras ya en `/new`.

---

## 6. Multiselect en el Kit (v6.9) 🆕

`FilterGroup` extendido con `multiple?: boolean` (default false → comportamiento single idéntico, RETROCOMPATIBLE). Con `multiple:true`: value es `string[]`, render de checkboxes/chips, matcher `selectedValues.includes(row[field])` (OR). Solo opt-in lo usa; tablas existentes sin cambio.

**Filtros tabla catálogo aluzinc:** `finish` (multiselect dinámico de coil_finishes), `family/productKind`, `thickness` (dinámico), `status`, search. Eliminado el `colorFilter` custom de extraContent.

---

## 7. Unificación de Tablas + Ventas Server-Side (v6.9) 🆕

**Auditoría global:** 3 grupos.

- **Grupo 1 (HECHO):** 3 inventarios (metallic/roofing/trading) tenían paginación manual (useState + slice + currentPage fijo). Migrados a `useTableData`. Default 15, selector visible (con pageSizeOptions + onPageSizeChange).
- **Grupo 2 (EN PROGRESO — server-side):** Ventas, Producción Drywall, CRM, Kardex, Usuarios. Paginan por cursor Firestore (volumen). NO migrar a useTableData cliente. Solo unificar lo VISUAL (TablePagination mode cursor + TableFilters), manteniendo motor server-side.
- **Grupo 3 (ya conforme):** catálogos, inventarios drywall/flejes/bobinas, producción aluzinc, órdenes de corte, compras.

**Piloto Ventas (HECHO):**

- Paginación **cursor** (startAfter/endBefore). `TablePagination mode="cursor"` — flechas, no números (arregla el bug de desfase página↔datos). Selector de pageSize funciona reseteando a página 1 (descarta cursores viejos, re-consulta con nuevo limit).
- **Totales reales** vía `getAggregateFromServer` (count + sum de totalAmount/totalProfit/totalWeight) sobre el set FILTRADO completo (no la página). Recalcula solo al cambiar filtro (cachea al paginar, flag `skipAggregates`).
- **Degradación Algolia:** con búsqueda de texto activa, Firestore aggregation no aplica → ocultar las 3 tarjetas de dinero, mostrar solo Cantidad (nbHits de Algolia) + mensaje "Totales no disponibles en búsqueda por texto".
- Índice SUNAT (`sales: sunat.estado + timestamp`) añadido.

---

## 8. Seguridad — Capa 1 (v6.10) 🆕 DESPLEGADO Y VALIDADO EN PROD

Modelo de 3 capas: (1) firestore.rules = seguridad real; (2) verificación server-side / writes a Functions; (3) guard de cliente (UX).

Seguridad Capa 1 está DESPLEGADA Y VALIDADA EN PROD (ayrsteel-2026).
- **Claims validados:** 4/4 usuarios clave actualizados y operativos (`frankrodrimilla` ADMIN, `doramc68` SUPERVISOR, `gsinuiri` ADMIN, `aalvarez` ADMIN).
- **Índices en PROD:** 9 índices nuevos + configuración SUNAT habilitada en producción.
- **Flujos críticos:** Anulación de venta (cadena `status` + `stock` + `movements`) validada en runtime sin errores de `permission-denied`.
- **Frontend:** Alineado vía merge a master.
- **Cierre parcial:** Las reglas de la FASE 2 (campos operativos en `sales.status`, `coils/*`, `*_stock` relajados) siguen abiertas. El candado definitivo se implementará en el Sprint 7 con Functions.

### 8.1 Fix de sesión zombie (auth resiliente)

`AuthContext` catch ya NO traga el error silenciosamente. Ante token inválido: intenta `getIdToken(true)` (refresh); si falla → `signOut` + limpiar estado → login. Distingue token-muerto de red transitoria (esta última expone `authError` recuperable, NO desloguea). `AuthGuard` no queda colgado (user sin role → signOut+login; authError → pantalla de error con reintentar).

> ⚠️ NOTA: el bug "redirige a /dashboard 404, solo funciona en incógnito" que se investigó NO era de código — era **caché de redirect 308** en el navegador (de un proyecto viejo en localhost:3000). Se resuelve con DevTools "Disable cache" o limpieza profunda. El fix de zombie es mejora legítima aparte.

### 8.2 Custom claims sincronizados — trigger `onUserWritten`

Function v2 `onDocumentWritten('users/{uid}')`: inyecta `setCustomUserClaims(uid, {role})` al crear/cambiar. Idempotente (no reescribe si igual; no hace loop — escribe en Auth, no en el doc). **Revoca refresh tokens** en TODO downgrade (ADMIN→cualquiera, SUPERVISOR→OPERATOR) y en `isActive:false`. Delete del doc → limpia claims. Validado en emulador (11 casos).

- ⚠️ Propagación: el claim no llega al token hasta refresh (hasta 1h). Cambios de rol → el usuario debe re-loguear o `getIdToken(true)`.

### 8.3 Endpoint de roles asegurado

`/api/scripts/migrate-roles` ahora exige Bearer token verificado con `role==='ADMIN'`. Ya no es público. Sirve de backfill de claims. Script `scripts/backfill-claims-test.cjs` apunta a test.

### 8.4 firestore.rules Fase 1 (DESPLEGADO Y VALIDADO EN PROD)

Helpers blindados: `isSignedIn`, `hasRole`, `isAdmin`, `isStaff` — **todos verifican `'role' in request.auth.token` ANTES de leer el claim** (sin esto, usuario sin claim hace que la rule lance error CEL en vez de denegar limpio).

- **Lectura por rol:** users (owner+admin), catálogos/stock/kardex/customers (isStaff), purchases (admin/supervisor), audit/settings (admin).
- **Campos snapshot PROTEGIDOS contra update** (nadie los altera, ni ADMIN): sales (totalAmount/igv/items), production_logs (piecesProduced/baseCost/sku), users (role/isActive). Grietas cerradas gratis.
- **Campos operativos RELAJADOS** (el cliente los muta hoy, // FASE 2): sales.status, production status, coils weight/status, \*\_stock stock/wac. Se cerrarán a `if false` en Sprint 7 cuando las Functions tomen esos writes.
- **audit_logs / \*\_movements / scrap_logs:** append-only (`update,delete: if false` para TODOS, incluso ADMIN).
- Validado: tests de emulador (15+ casos) + caso sin-claim deniega limpio. Desplegado y validado en PROD (`ayrsteel-2026`).
- ⚠️ **Auto-bloqueo evitado:** ni ADMIN edita status/wac directo (fuerza lógica por backend). Prerequisito: usuario semilla necesita claim ADMIN a mano (huevo-gallina: migrate-roles exige ADMIN).

---

## 9. Roadmap

**HECHO (v6.10):**
- **Despliegue de Seguridad Capa 1 en PROD:** Deploy exitoso de rules + 9 índices nuevos + custom claims de roles.
- **Migración de Coils (Bobinas) en PROD:** 41/41 bobinas migradas a `finish=GALV` y `densityFactor=0.00785` (con backup local en `scripts/coils_backup_*.json`, gitignored), con idempotencia probada y runtime OK (cálculo de peso ↔ ML).
- **Import masivo Aluzinc:** Editor por ítem con `densityFactor` derivado del acabado.
- **Estandarización de Tablas:** Grupo 1 de tablas con unificación visual, y piloto de Ventas server-side con paginación cursor, agregación en tiempo real y soporte Algolia degradado.
- **UX y confirmaciones:** Sistema `useConfirm` (Provider + Dialogs) para anulación y acciones críticas en producción/ventas.

**PENDIENTE / EN COLA (orden sugerido):**

1. **Verificaciones del import masivo:** crear GRIS en `coil_finishes` (0.008) + probar import con CSV real en test (55 ítems, densityFactor derivado, length PL).
2. **Sprint 7 (Seguridad Capa 2 — Fase 2 de rules):** migrar writes críticos a Cloud Functions (`splitCoilAction`, `produceFromCoils`, `voidProductionFromCoils`, `registerCoilScrap`, ventas/anulación) y luego cerrar las rules de Fase 2 (relajadas) a `if false` (candado final).
3. **Capa 2 server-side / Infraestructura:** session cookies + `proxy.ts`. Actualizar Next 16.1.7 → **16.2.6** (parchea 13 CVEs, 3 de bypass de auth). proxy.ts es UX, NO seguridad.
4. **Resto Grupo 2 tablas (mode cursor):** Kardex, Usuarios, Compras, Producción Drywall (replican mode cursor + agregación del piloto Ventas; unificación visual).
5. **Backlog cosmético:** `piecesProduced` naming; redirects `permanent:true` → `false`; `HeaderOptionsMenu` reuso en sales; ACCESORIO → Trading.
6. **Otros:** ventas USD sin TC (FFA1-912/913/933); SUNAT BETA .p12; PDF reportes.

---

## 10. Deuda Técnica Menor (Backlog)

- **`piecesProduced` nombre engañoso** (carga ML en coberturas). Decisión: NO renombrar (canónico compartido con Drywall).
- **Redirects `permanent: true`** en next.config (308 cacheables): considerar pasarlos a `permanent: false` (307) para evitar que un redirect viejo se pegue al navegador.
- **Línea ACCESORIO → Trading:** migración transversal.
- **`HeaderOptionsMenu`:** sales/page.tsx tenía menú inline del que se extrajo; podría reusar el componente nuevo (evitar duplicación).

---

## 11. Convenciones

- 0 `any` nuevos · nombres en inglés, datos/errores de usuario en español.
- Patrón Strategy (`getStockStrategy`), no if/else por línea.
- `runTransaction`: lee antes de escribir. NUNCA borrado físico (VOIDED + audit_logs).
- Todo monto en **PEN**, peso en **kg**. USD→PEN con TC real, nunca fallback 3.75.
- **Densidad: UNA por acabado** (`coil_finishes`, fuente única, heredada vía lookup; nunca hardcodear). **Valores: GALVANIZADO 0.00785; Aluzinc NATURAL 0.00785; Aluzinc prepintados color (AZUL/BLANCO/ROJO/VERDE/GRIS) 0.008.** ⚠️ CORRECCIÓN v6.9: NATURAL es 0.00785 (NO 0.008 como decía v6.7). Sí hay dos factores en aluzinc: natural 0.00785, colores 0.008.
- Stock negativo permitido (warning, no bloqueo).
- **Reversa siempre al costo congelado** de la transacción, nunca al WAC actual.
- **Datos mal formados → fallo ruidoso** (throw / badge visible), nunca fallback silencioso.
- **Tests:** `fileParallelism: false` (los de integración comparten emulador; en paralelo colisionan). Correr serializado para verde real (463/463).
- **Build de Vercel = build SIN credenciales** (serviceAccountKey gitignored). Scripts de migración EXCLUIDOS del build Next (tsconfig exclude) — importan serviceAccountKey que no existe en Vercel. Verificar build renombrando la credencial localmente.
- **Git:** push directo a `develop`. Push dispara Vercel. Credenciales (serviceAccountKey*, .env*) y \*.log en .gitignore.
- ⚠️ **firestore.indexes.json = fuente de verdad declarativa de edición MANUAL ADITIVA.** NUNCA sobrescribir con volcado de `firebase firestore:indexes` — el volcado pisa direcciones (ASC→DESC) y omite índices, causando deploys que BORRAN índices vivos. Incidente v6.10: un commit de 'formateo' sobrescribió el archivo → perdió `sales[status ASC,timestamp ASC]` → TUMBÓ todos los reportes de prod (`getProductSalesReport`, `reportFunctions sales-kpi/by-line`) con `FAILED_PRECONDITION`. El re-diff atrapó que el deploy correctivo además iba a borrar `coils[status ASC,createdAt ASC]` huérfano. SIEMPRE: `--dry-run` antes de deploy de índices, revisar sección `DELETE`, y `grep` del consumidor antes de dejar morir cualquier índice. OJO trampa Firestore: where de rango sin orderBy explícito → exige índice ASC implícito.

---

## 12. Migraciones y Backups de Datos
- **Migración de Coils (v6.10 - PROD):** Se migraron 41/41 bobinas en producción para asegurar que tengan `finish = "GALV"` y `densityFactor = 0.00785`. Idempotencia probada y runtime verificado (cálculo de peso ↔ ML).
  - Acabados `coil_finishes` en PROD completo: `GALV` (0.00785), `ALU-NATURAL` (0.00785) y 5 colores `ALU-*` (0.008).
  - **Backups:** Dado que `gcloud CLI` NO está instalado en el entorno, los backups de Firestore se realizan mediante un script JSON local (`scripts/coils_backup_*.json`, gitignored), lo cual es suficiente para volúmenes pequeños como 41 documentos. El backup local es restaurable ante fallos.
