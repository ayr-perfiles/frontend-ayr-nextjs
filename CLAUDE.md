# CLAUDE.md — AYR Steel ERP (v6.15)

> **Sprint actual:** Sprint 7 (Seguridad Capa 2) — CERRADO EN PROD ✅
> **Estado:** Build 🟢 | tsc limpio | 32 unit (bulkUploadLogic) + 14 unit (parseCoilDescription) + integración serializada verde | Functions v2 operativa.
> **v6.15:** voidCoilScrap (callable) CERRADO EN PROD. Reversa de merma mal registrada: restaura peso al costo congelado, marca scrap_log VOIDED, kardex compensatorio SCRAP_REVERSAL, audit VOID_COIL_SCRAP. Filtro de reporte de merma (scrap VOIDED no cuenta en totalMermaSoles). Helper backend determineCoilStatusAfterReversal. UI de mermas PENDIENTE (frente B).
> **v6.14:** deleteCoilDraft (callable + UI) CERRADO EN PROD. Borrado físico de bobina inerte solo si VOIDED y cero movimientos. Fix tsconfig functions-sunat (npm run build local restaurado).
> **v6.13:** WRITE 6 mini-ciclo 2 (`registerCoilsBulk`) desplegado en prod Y test. BulkUpload reescrito thin-client en página dedicada `/admin/coils/bulk-import`. Callable ACTIVE en prod; UI desplegada en master. ⚠️ Runtime PROD end-to-end NO ejercitado aún (validado en test-nube; primera corrida prod real = importación de abril, pendiente como operación). Ver §14.
> **v6.12:** WRITE 6 mini-ciclo 1 (registerCoil) y guardarraíl P1-bis desplegados en prod. Paginación y kit de tablas (v6.9) operativos. Reglas auth Capa 1 y custom claims vigentes.
> **v6.11:** Writes 2-5 (`registerCoilSplit` / `voidCoil` / `updateCoil` / `cancelCoilPlan` / `produceFromCoils` / `produceFromStrip`) desplegados y validados en runtime PROD. Rules claim-only + `scrap_logs` candado (`if false`) en PROD. Agujero auth `@ayrsteel.com` cerrado (código + runtime). Fix `next build`: `src/test` excluido de tsconfig.

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

### 3.6 `deleteCoilDraft` (borrador inerte)

- Callable ADMIN-only. Modelo A: exige status==VOIDED previo (anular antes de borrar).
- 5 guards (todos deben pasar): status==VOIDED; no parentCoilId (no hija de split); cero hijas (coils where parentCoilId==coilId); cero producción (production_logs array-contains coilId); cero scrap (scrap_logs where coilId); cero kardex (kardex_movements where sku==coilId). Cualquiera >0 → failed-precondition con motivo específico.
- Borrado FÍSICO (transaction.delete) + audit_log action DELETE_COIL_DRAFT (shape: action, entityId, userEmail, details, timestamp — espeja voidCoil, NO coilId/deletedBy).
- UI: filtro "Anuladas" (status==VOIDED) en InventoryFilters; en celda de acciones de un VOIDED, ADMIN ve botón "Eliminar borrador" (danger, ConfirmDialog requireInput {matchValue:"ELIMINAR"}); no-ADMIN conserva badge "Sin Efecto". Índice coils[status,createdAt] ya existente (reusado).
- Runtime prod validado (script invoke ayrsteel-2026, happy borra + bloqueo scrap sobrevive).
- Commits: merge cb9d11fc (backend c0245711 + UI 0eabdebe + tsconfig 858126df + docs 34033330).

### 3.7 `voidCoilScrap` (reversa de merma)

- Callable ADMIN-only, molde `voidProductionFromCoils` (runTransaction, lee antes de escribir, idempotente, 0 borrado físico).
- 5 guards pre-escritura: P4 ADMIN-only; scrapLogId presente (invalid-argument); scrap_log existe (not-found); P2 scrap_log.status==VOIDED (failed-precondition, idempotente); P3 coil.status==VOIDED (failed-precondition); P1(b) movimiento POSTERIOR (production_logs array-contains coilId status ACTIVE, o coil hija parentCoilId==coilId, con createdAt.toMillis() > scrap.timestamp.toMillis()). FAIL-CLOSED: sin createdAt comparable → bloquea.
- Escrituras txn costo congelado: coil currentWeight += scrapWeightKg + status determineCoilStatusAfterReversal + updatedAt; scrap_log.status="VOIDED" (campo NUEVO); kardex {sku:coilId, date, type:"SCRAP_REVERSAL", quantity:1, weightKg, costPerKg: scrapCostPEN/scrapWeightKg CONGELADO, balance:newWeight, reference:scrapLogId, user}; audit VOID_COIL_SCRAP.
- costPerKg congelado = scrapCostPEN/scrapWeightKg (scrap_log NO guarda pricePerKg; se deriva). NUNCA re-leer costo del coil (WAC pudo cambiar).
- Helper `determineCoilStatusAfterReversal(newWeight, initialWeight)` en `functions/src/domain/scrap.ts`: newWeight >= initialWeight - 0.01 → AVAILABLE, else IN_PROGRESS. EPSILON 0.01 paridad con cliente voidProductionFromCoils. Coexiste con determineCoilStatusAfterScrap (PROCESSED en peso 0). Reversa nunca da PROCESSED. Test paridad 5 casos.
- Reporte: `calculateTotalMermaSoles(scrapDocs)` función pura en `reportFunctions.ts` filtra IN-MEMORY status==="VOIDED" (no cuenta). Retrocompat: históricos SIN status → CUENTAN. NUNCA where("status","!=","VOIDED"). Consumidor de suma de merma ÚNICO en repo (verificado grep scrapCostPEN).
- Runtime prod ACTIVE ayrsteel-2026 (deploy por nombre CREATE puro). Test-nube validado (invoke_void_scrap_test.cjs): A happy (800→1000, AVAILABLE, VOIDED, kardex 200/2.5/1000, audit), B/C/D failed-precondition. Commits: backend 3bc70a40, reporte 16eff2db, merge 85387553.

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

- **`isAdmin` / `isStaff`: CLAIM-ONLY en prod.** El bypass por email (`@ayrsteel.com`) que existía en develop para tests NUNCA fue a prod y fue eliminado del código en v6.11. Los tests de integración siembran custom claims via `adminApp.auth().setCustomUserClaims()` + `getIdToken(true)`.
- **Lectura por rol:** users (owner+admin), catálogos/stock/kardex/customers (isStaff), purchases (admin/supervisor), audit/settings (admin).
- **Campos snapshot PROTEGIDOS contra update** (nadie los altera, ni ADMIN): sales (totalAmount/igv/items), production_logs (piecesProduced/baseCost/sku), users (role/isActive). Grietas cerradas gratis.
- **Campos operativos RELAJADOS** (el cliente los muta hoy, // FASE 2): sales.status, production status, coils weight/status, \*\_stock stock/wac. Se cerrarán a `if false` cuando las Functions tomen esos writes Y todos los escritores de esa colección estén migrados. Es multi-sprint. NO marcar como cerrado hasta que cada colección tenga 0 escritores cliente.
- **`audit_logs` / `*_movements`:** append-only (`update,delete: if false` para TODOS, incluso ADMIN).
- **`scrap_logs`:** `create: if false` → DESPLEGADO EN PROD (v6.11). `registerCoilScrap` Callable es el único escritor. Rule candada.
- **`_noop_stock`:** `read: if isStaff(); write: if false` — colección dummy referenciada por `servicesStockStrategy.getStockRef()` para que `tx.get()` en ventas de línea `services` no lance permission-denied.
- Validado: tests de emulador (85 passed / 3 skipped) + caso sin-claim deniega limpio. Desplegado y validado en PROD (`ayrsteel-2026`).
- ⚠️ **Auto-bloqueo evitado:** ni ADMIN edita status/wac directo (fuerza lógica por backend). Prerequisito: usuario semilla necesita claim ADMIN a mano (huevo-gallina: migrate-roles exige ADMIN).

---

## 9. Roadmap

**HECHO (v6.10):**

- **Despliegue de Seguridad Capa 1 en PROD:** Deploy exitoso de rules + 9 índices nuevos + custom claims de roles.
- **Migración de Coils (Bobinas) en PROD:** 41/41 bobinas migradas a `finish=GALV` y `densityFactor=0.00785` (con backup local en `scripts/coils_backup_*.json`, gitignored), con idempotencia probada y runtime OK (cálculo de peso ↔ ML).
- **Import masivo Aluzinc:** Editor por ítem con `densityFactor` derivado del acabado.
- **Estandarización de Tablas:** Grupo 1 de tablas con unificación visual, y piloto de Ventas server-side con paginación cursor, agregación en tiempo real y soporte Algolia degradado.
- **UX y confirmaciones:** Sistema `useConfirm` (Provider + Dialogs) para anulación y acciones críticas en producción/ventas.

**HECHO (v6.11):**

- **Writes 2-5 desplegados y validados en runtime PROD:** `registerCoilSplit`, `voidCoil`, `updateCoil`, `cancelCoilPlan`, `produceFromCoils`, `produceFromStrip`. Thin-clients en master.
- **Agujero auth cerrado:** bypass `@ayrsteel.com` eliminado de 7 callables + rules (código + runtime). Commit `837cca82`.
- **Rules v6.11 en PROD:** `isAdmin`/`isStaff` claim-only, `scrap_logs` candada (`if false`), `_noop_stock` rule añadida.
- **Fix `next build`:** `src/test` excluido de tsconfig. Incidente invisible en develop (Vercel solo buildea master) resuelto. Commit `5b3c75f3`.
- **Guardarraíl voidCoil (dirección-hijo):** bloquea anular hijas de split (`parentCoilId` presente) → `failed-precondition` antes del check de status. Audit string neutralizado. Commit `920dce8f`, merge `2b9c57a9`, validado en prod incógnito.

**HECHO (v6.12):**

- **P1-bis guardarraíl voidCoil (dirección-madre):** bloquea anular madre con hijos de split vivos (query `parentCoilId==coilId` & `status!=VOIDED`, pre-tx). Índice compuesto `coils(parentCoilId,status)` deployado. Commits 7b8e0fd2/52d8b92f, validado prod.
- **WRITE 6 mini-ciclo 1 — registerCoil:** alta de coils server-side (AddCoilForm + PurchaseCoilFromXml thin-clients). Recalcula pricePerKg/currentWeight/status/id; dedup atómico; valida finish vs coil_finishes; TC USD rango [2,7]; gate ADMIN+SUPERVISOR. Validado en test (pruebas 1-4). BulkUpload oculto + seedFinishes eliminado.

**HECHO (v6.13) — WRITE 6 mini-ciclo 2 (`registerCoilsBulk`):**

- **Callable `registerCoilsBulk`** (`functions/src/callables/coilBulkRegistration.ts`): alta masiva server-side. Gate ADMIN/SUPERVISOR, thin-client. **Atómico POR FACTURA** (una txn por factura, dedup adentro), tolerancia a fallo parcial entre facturas. Dedup por existencia de doc (skip-factura entero, ciego a VOIDED). Recalcula pricePerKg/currentWeight/status/id.toUpperCase()/registeredBy. Guards: finish vs `coil_finishes`, TC USD [2,7] (PEN→1), fecha YYYY-MM-DD (regex + validación componentes real, rechaza 2026-13-45), dimensiones width/thickness>0. Reporte por factura `{invoice,status:created|skipped-dup|failed,count,reason}`. `audit_log` `REGISTER_COIL_BULK` (coilIds en raíz). 12 tests integración. ACTIVE en prod Y test.
- **`parseCoilDescription`** (`src/core/coils/parseCoilDescription.ts`): parser puro cliente-side de texto libre → `{finishToken, thickness, width, flags}`. Token SEMÁNTICO (`GALV|NATURAL|AZUL|BLANCO|ROJO|VERDE|null`), NO la llave de BD. Cero fallback silencioso (no encuentra → null + flag). width literal (1219≠1220). Ambiguo (aluzinc/prepintada sin color) → null. 14 tests.
- **`bulkUploadLogic`** (`src/core/coils/bulkUploadLogic.ts`): lógica pura UI. `validateCoilRow`, `buildInvoicesPayload`, `parseWeightToKg`, `TOKEN_TO_FINISH`. Guard rango peso **[2000-7000] kg** (atrapa mal-parseo de formato). value monetario redondeado a **2 decimales** (XLSX raw:true trae floats sucios de celdas Excel calculadas). Unidad→kg: TON→×1000, KG→passthrough, ROLLO/UNIDAD→inválida. Moneda no reconocida→inválida (no default PEN). 32 tests.
- **UI `BulkUploadCoils.tsx`** reescrito de writeBatch directo a thin-client, en **página dedicada `/admin/coils/bulk-import`** (no modal). Preview editable por fila, dropdown finish vivo (`useFinishes`, muestra label / envía id), peso kg editable, TC editable + botón "Sugerir TC" (api `/api/tipo-cambio` como asistente, pre-llena por factura). Finish por-fila (preselección token→llave). Botón HeaderOptions navega a página (gate ADMIN/SUPERVISOR). Modal viejo extirpado de InventoryModals. Breadcrumb `bulk-import`→"Importación masiva".
- **Config:** `NEXT_PUBLIC_USE_EMULATOR` desacopla emulador de NODE_ENV (default emulador; `"false"` → dev apunta a nube). `vitest.config testTimeout 15000` (suite creció). `scripts/local/` gitignored (scripts throwaway con credenciales).
- Commits (develop→master): backend `31236045`, lógica pura `38fe1df6`, UI `2cac4082`, infra `79ed7be2`.
- ⚠️ **Runtime PROD end-to-end NO ejercitado.** Validado a fondo en test-nube (doc E001-6498-01: pricePerKg 2.906779 = value×tc/weight, TON→kg 4820, originalCurrencyValue 4003.05 a 2 dec). Callable ACTIVE en prod, UI en master. La primera corrida real de prod = importación de abril (§14).

**HECHO (v6.14) — `deleteCoilDraft` + Deuda:**

- **`deleteCoilDraft` (callable + UI):** Borrado físico de bobina SOLO si cero movimientos (sin producción/split/venta/consumo). Distingue borrador inerte de bobina con efecto contable. Guards 100% atómicos. UI con confirmación estricta y filtro de anuladas. Validado en runtime PROD (script 2026).
- **Fix tsconfig functions-sunat:** `npm run build` local restaurado como señal válida antes de merge.
- **Importación de abril:** DESBLOQUEADA (deleteCoilDraft es la red de re-importación: importar mal → anular → borrar → re-importar).

**HECHO (v6.15) — `voidCoilScrap`:**
- **`voidCoilScrap` (callable):** Reversa de merma mal registrada. Restaura peso al costo congelado, marca scrap_log VOIDED, kardex compensatorio SCRAP_REVERSAL, audit VOID_COIL_SCRAP. Filtro de reporte de merma (scrap VOIDED no cuenta en totalMermaSoles). Helper backend determineCoilStatusAfterReversal. CERRADO EN PROD. (Ver §3.7).

**PENDIENTE / EN COLA (orden sugerido):**

1. **`PurchaseCoilFromXml` finish por-fila:** hoy usa select global por factura (L49/234/404 → mismo acabado a todas las bobinas del XML, ignora colores mixtos). Patrón muerto preexistente. Fix: mover a por-fila como BulkUpload (parseCoilDescription + dropdown por fila). Ver §11.
3. **Reversa de split (WRITE nuevo, ¿7.5?):** restaurar madre + VOIDED hijo + reversa `kardex_movements`. Operación distinta de `voidProductionFromCoils`.
4. **WRITE 7:** `voidProductionFromCoils` metallic+drywall (costo congelado del `production_log`).
5. **WRITE 8:** `cutOrder` (monstruo: WAC+prorrateo, 5 funciones).
6. **WRITE 9:** `salesService` (payload crítico precio/correlativo). Desbloquea 3 tests `salesReimport` skipped.
7. **Candado final rules Fase 2:** cerrar `coils`/`kardex`/`audit` a `if false` colección por colección, solo cuando 0 escritores cliente queden.
8. **Capa 2 server-side / Infraestructura:** session cookies + `proxy.ts`. Actualizar Next 16.1.7 → **16.2.6** (parchea 13 CVEs, 3 de bypass de auth). proxy.ts es UX, NO seguridad.
9. **Saneamiento infra test↔prod:** SUNAT solo en test, Algolia solo en prod, voidCoil viejo en test, metadata codebase test rota. Deuda multi-sprint, riesgo de borrado accidental alto hasta resolver.
10. **Resto Grupo 2 tablas (mode cursor):** Kardex, Usuarios, Compras, Producción Drywall.
11. **Backlog cosmético:** `piecesProduced` naming; redirects `permanent:true` → `false`; `HeaderOptionsMenu` reuso en sales; ACCESORIO → Trading; barrel muerto `src/components/purchases/BulkUploadCoils.tsx`.
12. **Otros:** ventas USD sin TC (FFA1-912/913/933); SUNAT BETA .p12; PDF reportes.

---

## 10. Decisiones de Diseño (Sprint 7 - ADRs)

- **Cloud Functions Callable onCall v2:** NO server actions (razón: serviceAccountKey fuera de Vercel + request.auth nativo).
- **Estructura de Writes:** 6 Functions separadas, una por write. Orden: scrap→split→produce→void→sale→annul.
- **Payload thin client/fat backend:** baseCost/unitWeight/densityFactor/correlativo RE-LEÍDOS de fuente; unitPrice input vendedor, piso=costo, ADMIN lo cruza.
- **Dominio puro:** copia canónica en `functions/src/domain/` + TEST DE PARIDAD vs copia cliente.
- **Estrategias stock acopladas a db:** reimplementar I/O con admin SDK, extraer cálculo puro.
- **Tests:** integración en `src/test/integration` contra emulador (`test:emu`).
- **Candado rules:** cerrar FASE 2 a `if false` SOLO cuando Function validada runtime prod Y todos los escritores de esa colección migrados. Último paso de cada write.
- **Reversa de split ≠ voidCoil (v6.11):** `voidCoil` = baja de ingreso (status AVAILABLE → VOIDED, sin tocar genealogía de splits). La reversa de split (restaurar madre + VOIDED hijo + reversa kardex) es un WRITE futuro separado. Mientras tanto `voidCoil` debe BLOQUEARSE si `coil.parentCoilId` existe (`failed-precondition`), nunca permitir pérdida silenciosa de masa. [DEUDA P1]
- **Auth de callables (v6.11):** bypass por dominio de email PROHIBIDO en prod (`@ayrsteel.com` = dominio real → cualquier empleado sin claim pasaría el check de rol). Solo `@example.com` (emulador, inerte en prod) es aceptable. Rol SIEMPRE por custom claim (`request.auth.token.role`).
- **Deploy a tests (v6.12):** Deploy a `ayrsteel-test` SIEMPRE por función específica (`--only functions:NOMBRE`), NUNCA `--only functions:default` (propone borrar funciones legacy incl. SUNAT por metadata de codebase desincronizado).
- **Bulk atomicidad (v6.13):** `registerCoilsBulk` es atómico POR FACTURA, no todo-o-nada global. Razón: 490 coils × (read dedup + write) rebasa el tope de 500 ops/txn; todo-o-nada exigiría saga+compensación con borrado físico (viola no-borrado). La unidad contable real = la factura. Fallo parcial entre facturas tolerado (migración histórica "lo que entró, entró"). Dedup por factura = skip-factura entero (no parcial dentro de factura).
- **Token semántico vs llave BD (v6.13):** `parseCoilDescription` emite TOKEN semántico (`GALV|NATURAL|AZUL|...`), desacoplado de la llave viva de `coil_finishes` (`GALV|ALU-NATURAL|ALU-AZUL|...`). El mapeo token→llave (`TOKEN_TO_FINISH`) vive en la UI SOLO para preseleccionar; el dropdown se puebla de `coil_finishes` VIVO (single source of truth). NO reescribir el parser para emitir llaves — la separación de capas es intencional.
- **Guard de rango como robustez de formato (v6.13):** `parseNumValue` interpreta el punto como decimal o miles según si coexiste una coma (heurística ambigua: `"11.214"` sin coma → 11.214, PERO `"3.708,"` → 3708). Para bobinas el guard de peso [2000-7000] kg atrapa cualquier mal-parseo (un peso de 11 kg o 11 millones cae fuera → fila inválida). El guard es la robustez real, no confiar en el parseo. Guard en UI (validate), NO en callable (bobina legítima atípica no debe hard-blockearse; callable mantiene weight>0).
- **Emulador opt-out (v6.13):** `clientApp.ts` usa `NEXT_PUBLIC_USE_EMULATOR !== "false" && (NODE_ENV dev|test)`. Default = emulador (preserva todos los flujos). `"false"` en `.env.local` → `npm run dev` apunta a TEST-nube (para runtime local contra callable real). `test:emu` (emulators:exec) setea sus propios HOST, ignora la var. Scripts node puros NO cargan dotenv → van a nube vía serviceAccountKey directo.

---

## 11. Deuda Técnica Menor (Backlog)

- **`piecesProduced` nombre engañoso** (carga ML en coberturas). Decisión: NO renombrar (canónico compartido con Drywall).
- **Redirects `permanent: true`** en next.config (308 cacheables): considerar pasarlos a `permanent: false` (307) para evitar que un redirect viejo se pegue al navegador.
- **Línea ACCESORIO → Trading:** migración transversal.
- **`HeaderOptionsMenu`:** sales/page.tsx tenía menú inline del que se extrajo; podría reusar el componente nuevo (evitar duplicación).

### Deudas destapadas en v6.15 (voidCoilScrap)

- **Frente B UI de mermas PENDIENTE:** no existe vista que liste mermas de una bobina; scrap invisible fuera de reportes; voidCoilScrap solo se invoca por script. Falta pestaña/lista "Mermas" en detalle de bobina + botón ADMIN "Anular merma". Hueco operativo resuelto en BACKEND, no en operador.
- **Gap runtime P4:** guard ADMIN-only NO probado en runtime (falta usuario no-admin en test). Cubierto por test integración 7, no por runtime. Cubrir en frente B.
- **DEUDA KardexTab binario IN/OUT (preexistente, agravada):** `src/components/reports/tabs/KardexTab.tsx` renderiza cualquier type ≠ "IN" como rojo/SALIDA. SCRAP_REVERSAL (entrada +) se verá rojo/salida. Ya afecta SCRAP/AJUSTE. Reporte NO lee kardex → datos correctos, solo tabla visual miente. Fix = frente aparte (mapa type→signo/color).
- **registerCoilScrap guarda scrap_log SIN campo status:** (undefined=activo, "VOIDED"=anulado). Por eso filtro reporte es in-memory retrocompat. Intencional.

### Deudas destapadas en v6.13 (WRITE 6 mc2)

- **Fix tsconfig functions-sunat (CERRADA v6.14):** .vercelignore excluía functions+functions-sunat pero el exclude del tsconfig raíz solo tenía functions → npm run build local roto (rojo que Vercel no sufría). RESUELTO en 858126df: añadido functions-sunat al exclude. npm run build local = señal válida otra vez.
- **Fecha `T12:00:00Z` (mediodía UTC) en single + bulk:** ambos concatenan `T12:00:00` a la fecha YYYY-MM-DD y la persisten como Timestamp. Funciona para Perú (UTC-5 → 07:00 sigue siendo el día correcto), pero es frágil ante lectura en otras zonas / agrupación por día. Artefacto heredado, no decisión consciente. Compartido single+bulk.
- **`registerCoil` single SIN guards de fecha ni dimensiones:** el bulk (v6.13) valida fecha (regex+componentes) y width/thickness>0; el single NO. Bug latente: fecha basura o dimensión 0/null enviada al single → crash Firestore Timestamp o doc con dimensión inválida. Portar los guards del bulk al single.
- **`migrateFinishDensityFactors` + scripts backfill esperan naming MUERTO:** `finishService.ts` (`migrateFinishDensityFactors`), `scripts/backfillCoilFinish.ts`, `scripts/check_finishes.ts` usan `GALVANIZADO`/`NATURAL` (español completo). La BD VIVA usa `GALV`/`ALU-NATURAL`. Correr esas migraciones hoy crearía finishes basura o fallaría. Auditar y corregir/enterrar.
- **`PurchaseCoilFromXml` finish global** (ver §9 pendiente #1).
- **Barrel muerto** `src/components/purchases/BulkUploadCoils.tsx` (re-export no montado por nadie).
- **ADMIN de test = `demo@cliente.com`** (uid `1e3aV7XEmvdLjMally7g1zQJ6Fu1`, claim `{role:ADMIN}` real). Naming engañoso (email "cliente" con rol ADMIN), no bug.

---

## 11. Convenciones

### densityFactor por acabado (referencia, fuente seedFinishes eliminada)

GALVANIZADO (drywall) 0.00785; ALUZINC/NATURAL/AZUL/BLANCO/ROJO/VERDE (metallic) 0.008.
Runtime: lookup desde `coil_finishes`, throw si falta.

- 0 `any` nuevos · nombres en inglés, datos/errores de usuario en español.
- Patrón Strategy (`getStockStrategy`), no if/else por línea.
- `runTransaction`: lee antes de escribir. NUNCA borrado físico (VOIDED + audit_logs).
- Todo monto en **PEN**, peso en **kg**. USD→PEN con TC real, nunca fallback 3.75.
- **Densidad: UNA por acabado** (`coil_finishes`, fuente única, heredada vía lookup; nunca hardcodear). **Valores: GALVANIZADO 0.00785; Aluzinc NATURAL 0.00785; Aluzinc prepintados color (AZUL/BLANCO/ROJO/VERDE/GRIS) 0.008.** ⚠️ CORRECCIÓN v6.9: NATURAL es 0.00785 (NO 0.008 como decía v6.7). Sí hay dos factores en aluzinc: natural 0.00785, colores 0.008.
- Stock negativo permitido (warning, no bloqueo).
- **Reversa siempre al costo congelado** de la transacción, nunca al WAC actual.
- **Datos mal formados → fallo ruidoso** (throw / badge visible), nunca fallback silencioso.
- **Rango de peso de bobina [2000-7000] kg** (guard UI en bulk, v6.13): fuera de rango → fila inválida (atrapa mal-parseo de formato numérico). Es guard de validación, no hard-block de backend (bobina atípica legítima posible).
- **Value monetario → 2 decimales** (v6.13): XLSX `raw:true` extrae floats de precisión larga de celdas Excel calculadas; redondear en `buildInvoicesPayload` (`.toFixed(2)`). La verdad contable es el VALOR TOTAL facturado, no el flotante crudo.
- **Unidad→kg (bulk, v6.13):** TONELADA→×1000, KILOGRAMO→passthrough, ROLLO/UNIDAD/desconocido→null (fila inválida, usuario ingresa kg a mano). NUNCA adivinar factor de conversión.
- **Tests:** `fileParallelism: false` (los de integración comparten emulador; en paralelo colisionan). Correr serializado para verde real (463/463).
- **Build de Vercel = build SIN credenciales** (serviceAccountKey gitignored). Scripts de migración EXCLUIDOS del build Next (tsconfig exclude) — importan serviceAccountKey que no existe en Vercel. Verificar build renombrando la credencial localmente.
- **Git:** push directo a `develop`. Push dispara Vercel. Credenciales (serviceAccountKey*, .env*) y \*.log en .gitignore.
- ⚠️ **REGLA DE ORO (Functions):** Functions ACTIVE en functions:list = desplegada, NO validada. Como tsc verde. Validar runtime (invocar real en prod) antes de cerrar. Esta sesión: deploy bloqueado por secretos SUNAT acoplados; NUNCA secreto dummy en prod (rompe Algolia/APIs/SUNAT en runtime silenciosamente); NUNCA index.ts mutilado temporal; separar codebases es el fix correcto.
- ⚠️ **`npm run build` LOCAL obligatorio antes de merge a master.** `tsc` verde + `test:emu` verde NO atrapan fallos de `next build` (test-only code que entra al bundle, imports server-only, paths crudos a `node_modules` anidados). Incidente v6.11: `firestore-helpers.ts` importaba `firebase-admin` con path crudo a `functions/node_modules` → `next build` roto, invisible en `develop` (Vercel solo buildea `master`). Fix: `"src/test"` en `exclude` de `tsconfig.json`. Tests fuera del bundle de prod siempre. Los 5 callable test files conservan path crudo a `functions/node_modules/firebase-admin` a propósito (identidad de módulo con los callables que prueban).
- ⚠️ **firestore.indexes.json = fuente de verdad declarativa de edición MANUAL ADITIVA.** NUNCA sobrescribir con volcado de `firebase firestore:indexes` — el volcado pisa direcciones (ASC→DESC) y omite índices, causando deploys que BORRAN índices vivos. Incidente v6.10: un commit de 'formateo' sobrescribió el archivo → perdió `sales[status ASC,timestamp ASC]` → TUMBÓ todos los reportes de prod (`getProductSalesReport`, `reportFunctions sales-kpi/by-line`) con `FAILED_PRECONDITION`. El re-diff atrapó que el deploy correctivo además iba a borrar `coils[status ASC,createdAt ASC]` huérfano. SIEMPRE: `--dry-run` antes de deploy de índices, revisar sección `DELETE`, y `grep` del consumidor antes de dejar morir cualquier índice. OJO trampa Firestore: where de rango sin orderBy explícito → exige índice ASC implícito.

---

## 13. Migraciones y Backups de Datos

- **Migración de Coils (v6.10 - PROD):** Se migraron 41/41 bobinas en producción para asegurar que tengan `finish = "GALV"` y `densityFactor = 0.00785`. Idempotencia probada y runtime verificado (cálculo de peso ↔ ML).
  - **Acabados `coil_finishes` VIVOS (test = prod, confirmado leyendo Firestore directo, v6.13):** `GALV` (0.00785), `ALU-NATURAL` (0.00785), `ALU-AZUL`/`ALU-BLANCO`/`ALU-ROJO`/`ALU-VERDE`/`ALU-GRIS` (0.008 cada uno). `ALU-GRIS` SÍ existe. Test y prod NO divergen en finishes. Estas son las LLAVES reales — cualquier código que use `GALVANIZADO`/`NATURAL`/`AZUL` (sin prefijo ALU-) está roto (ver deuda §11).
  - **Backups:** Dado que `gcloud CLI` NO está instalado en el entorno, los backups de Firestore se realizan mediante un script JSON local (`scripts/coils_backup_*.json`, gitignored), lo cual es suficiente para volúmenes pequeños como 41 documentos. El backup local es restaurable ante fallos.

---

## 14. Importación real de abril a PROD (PENDIENTE — operación, no código)

El bulk (`registerCoilsBulk` + UI) está listo y validado en test-nube. La importación real del itemizado de abril a PROD es una **operación de curación**, NO un clic, y NO se ha ejecutado. Es también la primera corrida runtime prod end-to-end del bulk.

**Realidades del CSV real de abril (itemizado completo, ~220 filas):**

- Solo ~60 filas son bobinas (el resto = consumibles/servicios/ruido). Usuario debe **pre-filtrar a coil-only** antes de subir (diseño B). "FLEJADO DE BOBINA" es servicio, no bobina (falso positivo de "BOB").
- **Filas F001/TREAM PERU:** descripción sin color explícito → `parseCoilDescription` devuelve finish null → fila inválida hasta que el usuario ELIJA el acabado a mano en el dropdown. ~40 filas así.
- **Filas E001/MARELIAC:** limpias (color NATURAL explícito, TONELADA), se importan directo. Verificadas en test (pricePerKg cuadra).
- **Filas F013/F006/JAVISAC en UNIDAD:** son **líneas de factura agrupadas** (CANTIDAD tipo "31.202" = peso total en toneladas de VARIAS bobinas en una línea, no una bobina). El bulk las marca inválidas (UNIDAD no resuelve kg) — CORRECTO, no adivina. Requieren desglose manual (una fila por bobina física con su kg) o tratamiento aparte. El bulk es 1-fila-1-bobina; estas no encajan.
- **Filas SOL (PEN):** existen (ej E001-739), TC=1, value en soles.

**Recomendación:** hacer la importación real como sesión operativa dedicada, con calma, curando finishes fila por fila y decidiendo qué hacer con las líneas UNIDAD agrupadas. NO es cierre de código. Idealmente hacer un backup de `coils` prod antes (script JSON local).
