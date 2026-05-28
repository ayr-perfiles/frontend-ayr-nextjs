# CLAUDE.md — AYR Steel ERP

> **Versión:** 5.2 | **Sprint actual:** Mejoras + UI (post Sprint 3) **v5.2:** `metallic-roofing` v1 ✅ integrado. Lint 0 errors, 204/204 tests, build = error pre-existente `coils/page.js` (no introducido). Roofing = UPVC-only. Engines opcionales. **Cambios v4→v5 (validados contra código real):**
>
> 1. El modelo declaraba 2 líneas; la facturación (marzo 2026, S/ 1.24M) + el árbol de `src/app/admin/` muestran **5 líneas**: `drywall`, `roofing` (UPVC), `metallic-roofing` (aluzinc — mayor ingreso, 74.6%), `trading`, `services`.
> 2. `metallic-roofing`, `trading` y `services` **ya tienen ruta en** `app/admin/` **pero NO están registrados** en `businessLineRegistry.ts` ni tienen carpeta en `src/modules/`.
> 3. ⚠️ `firestore.rules` **está totalmente abierto** — no implementa los roles que esta §5 declara. Ver §5 y §12. Lee esto COMPLETO antes de cualquier cambio.

---

## 1. Contexto del producto

ERP de empresa que vende productos derivados de **acero** (bobina galvanizada/aluzinc) y **PVC**. Diversificación **ya en marcha** — es la realidad de la facturación, no un plan futuro.

**Líneas de negocio (facturación marzo 2026 + estado en código):**


| #   | Línea                                                    | Módulo / `id`      | Registrado                       | Ruta `app/` | Materia prima                  | % ingr mar-26 |
| --- | -------------------------------------------------------- | ------------------ | -------------------------------- | ----------- | ------------------------------ | ------------- |
| 1   | Coberturas **Aluzinc** (metálicas)                       | `metallic-roofing` | ✅ v1 registrado (cat+inv+ventas) | ✅ existe    | Bobina aluzinc/galvanizada     | 74.6%         |
| 2   | **Drywall** (parantes, rieles, omegas)                   | `drywall`          | ✅ sí                             | ✅           | Bobina de acero                | 20.4%         |
| 3   | Coberturas **UPVC / termoacústicos**                     | `roofing`          | ✅ sí                             | ✅           | Plancha UPVC                   | 4.5%          |
| 4   | **Compra-venta** (policarbonato, tubos, autoperforantes) | `trading`          | ❌ no                             | ✅ existe    | Producto terminado de terceros | 0.4%          |
| 5   | **Servicio de conformado**                               | `services`         | ❌ no                             | ✅ existe    | N/A (mano de obra)             | 0.1%          |


> ⚠️ `roofing` **= SOLO UPVC.** En el código `roofingModule.displayName = 'Coberturas PVC'`. Las coberturas de **Aluzinc (metal)** son `metallic-roofing`, línea aparte y la de mayor ingreso. No mezclar ambas bajo "roofing".

**Dos troncos por materia prima:**

- **ACERO / bobina** → alimenta `drywall` (perfiles) **y** `metallic-roofing` (coberturas). Las bobinas (`BOB045GALV`, `BOB28NAT`) se facturan dentro de la categoría aluzinc.
- **PVC** → `roofing`/UPVC (termoacústicos `TC5`).

**Usuarios:** ADMIN, SUPERVISOR, OPERATOR (custom claims en Firebase Auth)

> ⚠️ Los roles se aplican hoy solo en UI/middleware, **NO en** `firestore.rules` (ver §5).

---

## 2. Stack


| Capa       | Tech                                                       |
| ---------- | ---------------------------------------------------------- |
| Frontend   | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 |
| Backend    | Firebase Auth + Firestore + Storage + Functions            |
| Búsqueda   | Algolia                                                    |
| UI         | lucide-react, react-hot-toast, recharts                    |
| Testing    | Vitest + @testing-library/react                            |
| Validación | Zod                                                        |
| Lint       | ESLint v9 flat config — 0 errors, ~238 warnings aceptables |


```bash
npm run dev              # :3000
npm run emulate          # Firebase emulators + dev juntos
npm run build            # Build producción
npm run lint             # ESLint (debe ser 0 errors)
npm run test             # Vitest
npm run test:coverage    # Coverage report

```

---

## 3. Arquitectura (real — `find src -maxdepth 3 -type d`)

```
src/
├── app/
│   ├── (auth)/login
│   └── admin/
│       ├── (core)/        ← agrupador
│       ├── audit/  customers/  dashboard/  reports/  sales/  settings/  users/
│       ├── coils/  inventory/  kardex/  production/   ← drywall (acero)
│       ├── roofing/                                    ← UPVC ✅ módulo
│       ├── metallic-roofing/                           ← aluzinc ⚠️ ruta sin módulo
│       ├── trading/                                    ← reventa  ⚠️ ruta sin módulo
│       ├── services/                                   ← conformado ⚠️ ruta sin módulo
│       ├── operator/  setup/
│       └── migrate-kardex/  patch-sales/               ← mantenimiento
│   └── api/  (consulta-doc, tipo-cambio, test-mixed-cart)
│
├── core/                  # Compartido entre líneas
│   ├── config/  contracts/  hooks/  registry/  schemas/
│   └── sales/             # Ventas MULTI-LÍNEA
│       ├── actions/  components/  services/  strategies/
│
├── domain/
│   └── steel/             # Lógica pura SIN Firebase
│
├── modules/
│   ├── drywall/  { components, config, domain, engines, hooks, routes, schemas, services }
│   └── roofing/  { components, config, domain, engines, hooks, schemas, services }
│       # 🔜 FALTAN: metallic-roofing/, trading/, services/
│
├── components/            # UI por dominio (audit, crm, dashboard, forms, inventory,
│                          #  kardex, layout, operator, production, purchases, reports,
│                          #  sales, settings, ui, users)
├── context/  config/  services/  types/  utils/
└── lib/firebase/

```

> Nota v4→v5: `auth/ crm/ audit/ settings/ kardex/ reports/ dashboard/` **no** viven en `core/` (como decía v4) sino en `components/` y `app/admin/`. `domain/` hoy solo tiene `steel/`.

---

## 4. Colecciones Firestore

> ⚠️ Reglas reales NO distinguen colección ni rol (ver §5). La columna "Escritura" describe la intención de negocio, **no lo que firestore.rules aplica hoy**.

**Existentes:**


| Colección                 | Línea            | Escritura (intención)               |
| ------------------------- | ---------------- | ----------------------------------- |
| `users`                   | global           | dueño del doc (`uid == userId`)     |
| `coils`                   | drywall/metallic | ADMIN/SUPERVISOR                    |
| `production_logs`         | drywall          | ANY create, ADMIN/SUPERVISOR update |
| `inventory_stock`         | drywall          | ADMIN/SUPERVISOR ⚠️ TEMPORAL        |
| `kardex_movements`        | drywall          | ADMIN/SUPERVISOR ⚠️ TEMPORAL        |
| `roofing_catalog`         | roofing (UPVC)   | ADMIN                               |
| `roofing_stock`           | roofing (UPVC)   | ADMIN/SUPERVISOR                    |
| `roofing_stock_movements` | roofing (UPVC)   | ADMIN/SUPERVISOR create, inmutable  |
| `sales`                   | multi            | ADMIN/SUPERVISOR                    |
| `audit_logs`              | global           | ANY_ROLE ⚠️ TEMPORAL                |
| `customers/contacts`      | global           | ADMIN/SUPERVISOR                    |
| `settings/products`       | global           | ADMIN                               |


**Por crear para líneas nuevas (⚠️ CONFIRMAR naming contra los services):**


| Colección                           | Línea                |
| ----------------------------------- | -------------------- |
| `metallic_roofing_catalog`          | metallic-roofing     |
| `metallic_roofing_stock`            | metallic-roofing     |
| `metallic_roofing_stock_movements`  | metallic-roofing     |
| `trading_catalog` / `trading_stock` | trading              |
| `services_catalog`                  | services (sin stock) |


⚠️ TEMPORAL = migrar a Cloud Functions en Sprint 4.

---

## 5. Reglas no negociables

### 🔴 Transacciones

- Stock + kardex + ventas → SIEMPRE `runTransaction`
- **LECTURAS PRIMERO → ESCRITURAS DESPUÉS**
- Audit log en la misma transacción

### 🔴 Multi-línea en ventas

- `SaleItem.businessLine`: ampliar a `'drywall' | 'roofing' | 'metallic-roofing' | 'trading' | 'services'`
- Usar `getStockStrategy(businessLine)` — NUNCA if/else por línea (ver `core/sales/strategies/`)
- `services` → estrategia no-op (no descuenta stock)
- `trading` → descuenta stock de producto terminado (sin producción)
- Una sola transacción aunque haya N líneas

### 🔴 Stock negativo PERMITIDO

- No bloquear ventas — decisión de negocio. Warning visual cuando stock < 0. Todas las líneas.

### 🔴 Seguridad — ⚠️ DESALINEADA CON EL CÓDIGO

- **Estado real:** `firestore.rules` usa `match /{document=**} { allow read, write: if request.auth != null }`. Es decir, **cualquier autenticado lee/escribe todo**. No hay roles en Firestore.
- **Regla:** NUNCA abrir rules "para que pase". Hoy están abiertas → **deuda de seguridad crítica**, priorizar.
- Los 3 lugares que deben sincronizarse (layout + firestore.rules + middleware) hoy solo coinciden en 2 (layout + middleware vía `RRolePermissionMap`). Firestore es el eslabón abierto.
- Roles en custom claims: ADMIN, SUPERVISOR, OPERATOR.

### 🔴 Tipado

- NUNCA introducir `any` nuevo. ~47 any's actuales con justificación (varios en `contracts` con `eslint-disable` y comentario "migrar cuando cada módulo defina su tipo concreto").

### 🟠 ESLint

- `npm run lint` = 0 errors siempre. ~238 warnings aceptables, reducir sprint a sprint.

---

## 6. SKU Conventions (verificado contra facturación marzo)

```
Drywall (perfiles, acero galvanizado):
  P38GALV045 P64GALV045 P89GALV045   # Parantes
  R39GALV045 R65GALV045 R90GALV045   # Rieles
  OMEGA045  ESQ30                    # Omega, Esquinero

Metallic-roofing (coberturas aluzinc):
  COB[ESPESOR][COLOR]        → COB030ROJO COB030AZUL COB035ROJO COB040NATURAL
  PL[ESPESOR][COLOR][LARGO]  → PL030RJ6MT PL040X6MT PL040NT6MT
  BOB[ESPESOR][TIPO]         → BOB045GALV BOB28NAT   (bobina = materia prima)
  ACCES030ROJO               → accesorios (cumbreras, etc.)

Roofing (UPVC / termoacústicos):
  [MATERIAL][LARGO]MT[COLOR_SI_NO_ES_ROJO]
  UPVC6MT UPVC6MTAZUL UPVC36MT UPVC36MTAZUL    # TC5 1.5mm x 1.075

Trading (reventa):
  POLI600 COBPOLI (policarbonato) ANTI (anticipos), tubos, autoperforantes

Services:
  CONFORMADO   (unidad: TONELADA)

```

---

## 7. Fórmulas críticas

```ts
// Drywall — piezas máximas
const totalMeters =
  weightKg / (thicknessMm * widthMm * (STEEL_DENSITY_G_CM3 / 1000));
const maxPieces = Math.ceil(
  Math.floor(totalMeters / pieceLength) * PRODUCTION_TOLERANCE_FACTOR,
);

// Drywall — costo por mm
const costPerMm =
  leftover <= LEFTOVER_THRESHOLD_MM && leftover > 0
    ? totalCost / totalPlannedWidth
    : totalCost / masterWidth;

// Roofing / Metallic-roofing — costo promedio ponderado
newAvgCost =
  (currentQty * currentAvgCost + newQty * newUnitCost) / (currentQty + newQty);

```

> ⚠️ Metallic-roofing: definir si su `ProductionEngine` comparte la fórmula de bobina con drywall (mismo insumo) o si solo inventaría cobertura ya conformada.

---

## 8. Contrato BusinessLineModule (`core/contracts`)

Cada línea registrada DEBE implementar:

```ts
interface BusinessLineModule {
  id: string;                  // 'drywall' | 'roofing' | 'metallic-roofing' | ...
  displayName: string;         // 'Coberturas PVC'
  icon: string;                // lucide-react: 'Factory' | 'Home' | ...
  productionEngine: ProductionEngine;   // plan/execute/cancel/getStatus
  inventoryEngine: InventoryEngine;     // getInventoryView / calculateMetrics
  catalogSchema: z.ZodSchema;
  routes: RouteConfig[];
  sidebarItems: MenuItem[];
  permissions: RolePermissionMap;       // canView/Create/Edit/Delete/Void por rol
}

```

Patrón de errores: `Result<T, DomainError>` (Railway), no excepciones para errores de dominio.

### Cómo registrar una línea nueva

1. Crear `src/modules/<id>/` con engines, schema, routes, config (espejar `roofing/`).
2. Exportar `<id>Module: BusinessLineModule` desde `src/modules/<id>/index.ts`.
3. Importarlo y añadirlo al array en `core/registry/businessLineRegistry.ts`.

```ts
// businessLineRegistry.ts
export const businessLines: BusinessLineModule[] = [
  drywallModule,
  roofingModule,
  metallicRoofingModule,   // 🔜
  tradingModule,           // 🔜  (ver decisión abajo)
  servicesModule,          // 🔜  (ver decisión abajo)
];

```

> ✅ **DECISIÓN RESUELTA (v5.1):** `productionEngine` e `inventoryEngine` pasan a ser **opcionales** en `BusinessLineModule` (ver patch en §13). Los consumidores hacen null-check. Así `trading` (sin producción), `services` (sin producción ni stock) y `metallic-roofing` v1 (sin producción todavía) se registran sin engines falsos. `catalogSchema`, `routes`, `sidebarItems` y `permissions` siguen obligatorios.

---

## 9. Strategy Pattern en ventas

```ts
// ❌ NUNCA if/else por línea
// ✅ SIEMPRE strategy  (core/sales/strategies/)
const strategy = getStockStrategy(item.businessLine);
await strategy.decrementStock(item.sku, item.quantity, transaction);

```

Estrategias esperadas: `drywall`, `roofing`, `metallic-roofing`, `trading`, `services` (no-op).

---

## 10. Trampas conocidas

1. Firestore: `where("in")` + rango fechas = error. Ver workaround en inventoryService.
2. Algolia: Siempre hidratar con getDocs.
3. runTransaction: No metas side effects — reintenta automáticamente.
4. Custom claims: Usar `getIdToken(true)` para refrescar.
5. Coils L58: Validar status solo si viene en payload.
6. Stock negativo: Feature, no bug.
7. ESLint: `no-undef` off, `no-unused-vars` off (usar versión TS).
8. **"roofing" ≠ aluzinc.** `roofing` = UPVC; aluzinc = `metallic-roofing`. Separar por SKU/categoría.
9. **Bobinas compartidas:** una bobina se consume para drywall o metallic-roofing; imputar costo a la línea que la conforma.
10. **Rutas huérfanas:** `trading`, `services` tienen página pero no módulo registrado. `metallic-roofing` ya registrado ✅.

---

## 11. Roadmap


| Sprint | Estado | Foco                                                                           |
| ------ | ------ | ------------------------------------------------------------------------------ |
| 0-3    | ✅      | Base, drywall, template, roofing (UPVC) ventas                                 |
| Actual | 🚧     | Mejoras generales + UI/UX                                                      |
| 4      | ✅      | `metallic-roofing` v1 registrado + roofing = UPVC-only                         |
| 5      | 🔜     | `trading` (reventa, sin productionEngine) + `services` (sin engines)           |
| 6      | 🔜     | `metallic-roofing` producción (conformado desde bobina)                        |
| 7      | 🔜     | 🔴 Cerrar `firestore.rules` por colección+rol; migrar stock/kardex a Functions |


---

## 12. Checklist pre-commit

- [ ] `npm run lint` → 0 errors
- [ ] `npm run test` → 0 failing
- [ ] `npm run build` → sin errores
- [ ] Transacciones: lecturas antes que escrituras
- [ ] Stock negativo: warning visual
- [ ] Multi-línea: Strategy, no if/else
- [ ] Sin `any` nuevos
- [ ] Errores en español
- [ ] Audit log en operaciones sensibles
- [ ] `businessLine` cubre las 5 líneas en enum/schemas/strategies
- [ ] 🔴 firestore.rules NO se dejó más abierto de lo que ya está (idealmente, se cerró un poco)

---

## 13. Decisiones resueltas + módulo `metallic-roofing` v1 ✅ (v5.2)

**Estado:** integrado, lint 0, 204/204 tests, roofing sin regresión. Build: error pre-existente `coils/page.js`, no introducido.

**Decisiones tomadas:**

1. **Engines opcionales** en `BusinessLineModule` (no no-op). Ver §8 y el patch.
2. `metallic-roofing` **v1 = catálogo + inventario + ventas, SIN producción.** El conformado desde bobina se modela en sprint posterior (igual que roofing hizo ventas antes que producción).
3. **Colecciones:** `metallic_roofing_catalog`, `metallic_roofing_stock`, `metallic_roofing_stock_movements` (espejo exacto del patrón roofing).
4. **SKU manual con override**; `generateSKU` solo de conveniencia (los SKU reales de aluzinc son irregulares: `BOB28NAT` vs `BOB045GALV`, `PL040X6MT`).
5. **Familias** modeladas con enum `family`: `COBERTURA | PLANCHA | BOBINA | ACCESORIO` (`length` requerido solo en `PLANCHA`).

**Archivos generados (pegar en** `src/modules/metallic-roofing/`**):**

```
types.ts
schemas/catalog.ts
domain/skuGenerator.ts
services/{catalogService,inventoryService,stockAdjustmentService}.ts   ← espejo fiel de roofing
engines/{inventory,production}.ts   ← production es stub, NO se exporta en index aún
config/{sidebar,permissions}.ts
routes.ts
index.ts   ← exporta metallicRoofingModule (sin productionEngine)

```

**Patches al core (en** `_patches/`**):**

- `core-contracts/PATCH-BusinessLineModule.md` → hacer engines opcionales + null-checks.
- `core-registry/businessLineRegistry.ts` → añade `metallicRoofingModule` al array.
- `core-sales-strategies/metallicRoofingStrategy.ts` → **SKETCH**, ajustar a la interfaz real `StockStrategy`/`getStockStrategy` (no la tuve a la vista).

**Pasos de integración:**

1. Aplicar el patch del contrato (engines opcionales) y blindar consumidores con null-check.
2. Copiar `src/modules/metallic-roofing/` y crear los componentes UI (`components/catalog/`, `components/inventory/`) — NO generados aquí, espejar los de `roofing/components/`.
3. Reemplazar `businessLineRegistry.ts` por la versión del patch.
4. Registrar la estrategia de stock de aluzinc en `core/sales/strategies/` (ajustar el sketch).
5. Ampliar el enum `SaleItem.businessLine` a `'metallic-roofing'` en schemas/tipos de ventas.
6. `npm run lint && npm run test && npm run build`.

**Pendiente de verificar (no tuve los archivos):** `RoofingProductSchema`, `roofing/types.ts`, `skuGenerator` real, engines de roofing, interfaz `StockStrategy`, y los componentes UI. Si los compartes, alineo el módulo 1:1 y completo la UI.

**Siguiente recomendado:** repetir el patrón para `trading` (sin `productionEngine`) y luego `services` (sin `productionEngine` ni `inventoryEngine`, catálogo de servicios por tonelada).