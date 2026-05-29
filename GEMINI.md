# CLAUDE.md — AYR Steel ERP

> **Versión:** 6.0 | **Sprint actual:** Producción Metallic (Sprint 6)
> **v6.0:** 5 líneas registradas (`drywall`, `roofing`, `metallic-roofing`, `trading`, `services`). Sprint 5 cerrado. Lint: 0 errors, 170 warnings. Tests: 231/231 passed. Build: error pre-existente en `customers/[id]/page.tsx` (no introducido, TS error). Engines opcionales.
>
> **Cambios v5→v6 (validados contra código real):**
>
> 1. El modelo ahora declara y registra funcionalmente las **5 líneas**.
> 2. `trading` y `services` **están registrados** en `businessLineRegistry.ts` y viven en `src/modules/`.
> 3. ⚠️ `firestore.rules` **está totalmente abierto** — no implementa los roles que esta §5 declara. Ver §5 y §12. Lee esto COMPLETO antes de cualquier cambio.

---

## 1. Contexto del producto

ERP de empresa que vende productos derivados de **acero** (bobina galvanizada/aluzinc) y **PVC**. Diversificación **ya en marcha** — es la realidad de la facturación, no un plan futuro.

**Líneas de negocio (facturación marzo 2026 + estado en código):**

| #   | Línea                                                    | Módulo / `id`      | Registrado                        | Ruta `app/` | Materia prima                  | % ingr mar-26 |
| --- | -------------------------------------------------------- | ------------------ | --------------------------------- | ----------- | ------------------------------ | ------------- |
| 1   | Coberturas **Aluzinc** (metálicas)                       | `metallic-roofing` | ✅ v1 registrado (cat+inv+ventas) | ✅ existe   | Bobina aluzinc/galvanizada     | 74.6%         |
| 2   | **Drywall** (parantes, rieles, omegas)                   | `drywall`          | ✅ sí                             | ✅          | Bobina de acero                | 20.4%         |
| 3   | Coberturas **UPVC / termoacústicos**                     | `roofing`          | ✅ sí                             | ✅          | Plancha UPVC                   | 4.5%          |
| 4   | **Compra-venta** (policarbonato, tubos, autoperforantes) | `trading`          | ✅ registrado (cat+inv+ventas)    | ✅ existe   | Producto terminado de terceros | 0.4%          |
| 5   | **Servicio de conformado**                               | `services`         | ✅ registrado (catálogo x TON)    | ✅ existe   | N/A (mano de obra)             | 0.1%          |

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
| Lint       | ESLint v9 flat config — 0 errors, ~170 warnings aceptables |

```bash
npm run dev              # :3000
npm run emulate          # Firebase emulators + dev juntos
npm run build            # Build producción
npm run lint             # ESLint (debe ser 0 errors)
npx vitest run           # Vitest
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
│       ├── catalog/ inventory/  kardex/  production/  coils/ ← drywall (acero)
│       ├── roofing/                                    ← UPVC ✅ módulo
│       ├── metallic-roofing/                           ← aluzinc ✅ módulo
│       ├── trading/                                    ← reventa ✅ módulo
│       ├── services/                                   ← conformado ✅ módulo
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
│   ├── drywall/           { components, config, domain, engines, hooks, routes, schemas, services }
│   ├── roofing/           { components, config, domain, engines, hooks, schemas, services }
│   ├── metallic-roofing/  { components, config, domain, engines, hooks, routes, schemas, services }
│   ├── trading/           { components, config, domain, engines, hooks, schemas, services }
│   └── services/          { components, config, domain, hooks, schemas, services }
│
├── components/            # UI por dominio (audit, crm, dashboard, forms, inventory,
│                          #  kardex, layout, operator, production, purchases, reports,
│                          #  sales, settings, ui, users)
├── context/  config/  services/  types/  utils/
└── lib/firebase/

```

---

## 4. Colecciones Firestore

> ⚠️ Reglas reales NO distinguen colección ni rol (ver §5). La columna "Escritura" describe la intención de negocio, **no lo que firestore.rules aplica hoy**.

**Existentes:**

| Colección                          | Línea            | Escritura (intención)               |
| ---------------------------------- | ---------------- | ----------------------------------- |
| `users`                            | global           | dueño del doc (`uid == userId`)     |
| `coils`                            | drywall/metallic | ADMIN/SUPERVISOR                    |
| `production_logs`                  | drywall          | ANY create, ADMIN/SUPERVISOR update |
| `inventory_stock`                  | drywall          | ADMIN/SUPERVISOR ⚠️ TEMPORAL        |
| `kardex_movements`                 | drywall          | ADMIN/SUPERVISOR ⚠️ TEMPORAL        |
| `products`                         | drywall          | ADMIN (Catálogo Drywall)            |
| `roofing_catalog`                  | roofing (UPVC)   | ADMIN                               |
| `roofing_stock`                    | roofing (UPVC)   | ADMIN/SUPERVISOR                    |
| `roofing_stock_movements`          | roofing (UPVC)   | ADMIN/SUPERVISOR create, inmutable  |
| `metallic_roofing_catalog`         | metallic-roofing | ADMIN                               |
| `metallic_roofing_stock`           | metallic-roofing | ADMIN/SUPERVISOR                    |
| `metallic_roofing_stock_movements` | metallic-roofing | ADMIN/SUPERVISOR create, inmutable  |
| `trading_catalog`                  | trading          | ADMIN                               |
| `trading_stock`                    | trading          | ADMIN/SUPERVISOR                    |
| `trading_stock_movements`          | trading          | ADMIN/SUPERVISOR create, inmutable  |
| `services_catalog`                 | services         | ADMIN                               |
| `sales`                            | multi            | ADMIN/SUPERVISOR                    |
| `audit_logs`                       | global           | ANY_ROLE ⚠️ TEMPORAL                |
| `customers/contacts`               | global           | ADMIN/SUPERVISOR                    |
| `settings/products`                | global           | ADMIN                               |

> **Nota v6.0:** El catálogo de drywall vive en la colección `products` (top-level) y su UI está en `/admin/catalog` (ruta del módulo drywall). `products` NO se renombró por retrocompatibilidad. La paridad de naming a `drywall_catalog` queda como deuda para Sprint 7 (opcional).

⚠️ TEMPORAL = migrar a Cloud Functions en Sprint 4/7.

---

## 5. Reglas no negociables

### 🔴 Transacciones

- Stock + kardex + ventas → SIEMPRE `runTransaction`
- **LECTURAS PRIMERO → ESCRITURAS DESPUÉS**
- Audit log en la misma transacción

### 🔴 Multi-línea en ventas

- `SaleItem.businessLine`: soporta `'drywall' | 'roofing' | 'metallic-roofing' | 'trading' | 'services'`
- Usar `getStockStrategy(businessLine)` — NUNCA if/else por línea (ver `core/sales/strategies/`)
- `services` → estrategia no-op (no descuenta stock, usa dummy `_noop_stock`)
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

- `npm run lint` = 0 errors siempre. (Actualmente 0 errors, ~170 warnings aceptables).

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

// Roofing / Metallic-roofing / Trading — costo promedio ponderado
newAvgCost =
  (currentQty * currentAvgCost + newQty * newUnitCost) / (currentQty + newQty);
```

> ⚠️ Metallic-roofing: definir si su `ProductionEngine` comparte la fórmula de bobina con drywall (mismo insumo) o si solo inventaría cobertura ya conformada.

---

## 8. Contrato BusinessLineModule (`core/contracts`)

Cada línea registrada DEBE implementar:

```ts
interface BusinessLineModule {
  id: string; // 'drywall' | 'roofing' | 'metallic-roofing' | ...
  displayName: string; // 'Coberturas PVC'
  icon: string; // lucide-react: 'Factory' | 'Home' | ...
  productionEngine?: ProductionEngine; // plan/execute/cancel/getStatus (Opcional)
  inventoryEngine?: InventoryEngine; // getInventoryView / calculateMetrics (Opcional)
  catalogSchema: z.ZodSchema;
  routes: RouteConfig[];
  sidebarItems: MenuItem[];
  permissions: RolePermissionMap; // canView/Create/Edit/Delete/Void por rol
}
```

### Registro de Líneas

Están registradas y activas en `core/registry/businessLineRegistry.ts`:

```ts
export const businessLines: BusinessLineModule[] = [
  drywallModule,
  roofingModule,
  metallicRoofingModule,
  tradingModule, // Sin productionEngine
  servicesModule, // Sin productionEngine ni inventoryEngine
];
```

Patrón de errores: `Result<T, DomainError>` (Railway), no excepciones para errores de dominio.

---

## 9. Strategy Pattern en ventas

```ts
// ❌ NUNCA if/else por línea
// ✅ SIEMPRE strategy  (core/sales/strategies/)
const strategy = getStockStrategy(item.businessLine);
await strategy.writeSaleDecrement(params, snap, transaction);
```

Estrategias operativas para las 5 líneas: `drywall`, `roofing`, `metallic-roofing`, `trading`, `services` (no-op).

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

---

## 11. Roadmap

| Sprint | Estado | Foco                                                                           |
| ------ | ------ | ------------------------------------------------------------------------------ |
| 0-3    | ✅     | Base, drywall, template, roofing (UPVC) ventas                                 |
| 4      | ✅     | `metallic-roofing` v1 registrado + roofing = UPVC-only                         |
| 5      | ✅     | `trading` (reventa) + `services` (sin engines). Catálogos unificados y UI.     |
| 6      | 🔜     | `metallic-roofing` producción (conformado desde bobina)                        |
| 7      | 🔜     | 🔴 Cerrar `firestore.rules` por colección+rol; migrar stock/kardex a Functions |

---

## 12. Checklist pre-commit

- [x] `npm run lint` → 0 errors
- [x] `npm run test` → 0 failing
- [ ] `npm run build` → sin errores
- [x] Transacciones: lecturas antes que escrituras
- [x] Stock negativo: warning visual
- [x] Multi-línea: Strategy, no if/else
- [x] Sin `any` nuevos
- [x] Errores en español
- [x] Audit log en operaciones sensibles
- [x] `businessLine` cubre las 5 líneas en enum/schemas/strategies
- [ ] 🔴 firestore.rules NO se dejó más abierto de lo que ya está (idealmente, se cerró un poco)

---

## 13. Decisiones resueltas

### v6.0: Sprint 5 cerrado ✅ (Trading + Services + Catálogos)

1. **Módulo `trading`:** Reventa de terceros. Clon simplificado de `metallic-roofing` **sin** producción. SKU manual y usa motor de inventario propio.
2. **Módulo `services`:** Mano de obra (conformado). **Sin** motores (ni producción ni inventario). Estrategia de stock es **no-op** para no afectar inventario en ventas. SKU manual, unidad fija TONELADA.
3. **ProductModal Unificado:** Se fusionaron `AddProductModal` y `EditProductModal` en un solo componente manejado por prop `mode` (aplicado a `metallic-roofing`, `roofing`, `trading`, `services`).
4. **Catálogo Drywall reubicado:** El gestor de catálogo salió de Configuraciones Globales hacia su propia ruta `/admin/catalog` del módulo Drywall. La colección sigue siendo `products`.

### v5.2: `metallic-roofing` v1 ✅

1. **Engines opcionales** en `BusinessLineModule` (no no-op). Consumidores hacen null-check.
2. `metallic-roofing` **v1 = catálogo + inventario + ventas, SIN producción.** El conformado desde bobina se modela en sprint posterior.
3. **Colecciones:** `metallic_roofing_catalog`, `metallic_roofing_stock`, `metallic_roofing_stock_movements`.
4. **SKU manual con override**; `generateSKU` solo de conveniencia.
