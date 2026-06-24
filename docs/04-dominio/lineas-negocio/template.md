# Guía: Agregar una nueva línea de negocio

> Esta guía usa **tubing (tubería)** como ejemplo concreto en cada paso.  
> Tiempo estimado: 12–18 horas (1.5 – 2 sprints).

---

## Contexto arquitectónico

Cada línea de negocio es un **módulo autocontenido** que implementa el contrato
`BusinessLineModule` definido en `src/core/contracts/BusinessLineModule.ts`.

```
src/modules/<linea>/
├── index.ts                    ← Punto de entrada: objeto BusinessLineModule
├── types.ts                    ← Re-exporta tipos públicos del módulo
├── engines/
│   ├── production.ts           ← Implementa ProductionEngine
│   └── inventory.ts            ← Implementa InventoryEngine
├── schemas/
│   └── catalog.ts              ← Zod schema para productos de esta línea
├── config/
│   ├── sidebar.ts              ← MenuItem[] para el sidebar
│   └── permissions.ts         ← RolePermissionMap
├── routes.ts                   ← RouteConfig[] con paths de Next.js
├── domain/                     ← Lógica pura (sin Firebase, sin React)
│   ├── <proceso>.ts            ← Ej: rollForming.ts, costing.ts
│   └── validation.ts
├── services/                   ← Acceso a Firebase/Algolia
│   ├── productionService.ts
│   └── inventoryService.ts
├── components/                 ← Componentes React específicos
│   ├── forms/
│   ├── tables/
│   └── modals/
└── hooks/                      ← Hooks de fetching
```

La línea se activa en **dos lugares** solamente:
1. `src/context/BusinessLineContext.tsx` (array `ACTIVE_MODULES`)
2. Sus propias páginas en `src/app/admin/<linea>/`

El sidebar y el selector se actualizan automáticamente.

---

## Paso 1 — Estructura de carpetas (10 min)

```bash
mkdir -p src/modules/tubing/{components/forms,components/tables,services,domain,hooks,engines,schemas,config,routes}
mkdir -p src/app/admin/tubing
```

Crea `src/modules/tubing/types.ts` vacío como placeholder:

```typescript
// tubing/types.ts — tipos públicos del módulo
// Agrega re-exports a medida que crees los servicios
```

---

## Paso 2 — Schema del catálogo (30 min)

`src/modules/tubing/schemas/catalog.ts`

Define los campos específicos de los productos de esta línea. Para tubería:

```typescript
import { z } from 'zod';

// Los SKUs de tubería siguen el patrón TUB_{diametro}_{espesor}
// Ej: TUB_1/2_0.40, TUB_3/4_0.60, TUB_1_0.80
export const tubingCatalogSchema = z.object({
  sku: z
    .string()
    .min(1, 'El SKU es obligatorio')
    .regex(/^TUB_/, 'Los SKUs de tubería deben empezar con TUB_'),

  name: z.string().min(1, 'El nombre es obligatorio'),

  // Diámetro exterior en pulgadas (ej: 0.5, 0.75, 1.0, 1.5)
  outerDiameterInch: z
    .number()
    .positive('El diámetro debe ser mayor a 0'),

  // Espesor de pared en mm (rango típico: 0.40 – 2.00 mm)
  wallThickness: z
    .number()
    .min(0.4, 'Espesor mínimo: 0.40mm')
    .max(2.0,  'Espesor máximo: 2.00mm'),

  // Largo estándar del tubo en metros (ej: 6.0)
  lengthMeters: z
    .number()
    .positive('El largo debe ser mayor a 0'),

  // Peso por metro lineal en kg (derivado, pero se guarda para ventas)
  weightPerMeter: z
    .number()
    .positive('El peso por metro debe ser mayor a 0'),

  isActive: z.boolean(),
});

export type TubingCatalogItem = z.infer<typeof tubingCatalogSchema>;
```

---

## Paso 3 — Dominio puro (2–3 horas)

`src/modules/tubing/domain/rollForming.ts`

Contiene las fórmulas específicas de esta línea, **sin acceso a Firebase ni React**.
Sigue el mismo patrón que `drywall/domain/slitter.ts`.

```typescript
import { STEEL_DENSITY_FACTOR } from '@/domain/steel/constants';

// Solapado de soldadura en conformadora de tubería (mm)
const WELD_OVERLAP_MM = 1.5;

/**
 * Calcula el ancho de fleje necesario para formar un tubo.
 * Fórmula: π × D_exterior + solapado_soldadura
 */
export function calcStripWidthForTube(outerDiameterMm: number): number {
  return Math.ceil(Math.PI * outerDiameterMm + WELD_OVERLAP_MM);
}

/**
 * Convierte diámetro en pulgadas a mm.
 */
export function inchToMm(inches: number): number {
  return inches * 25.4;
}

/**
 * Calcula metros de tubo producibles por unidad de peso de fleje.
 * Usa la misma densidad del acero que drywall.
 */
export function calcTubeMetersFromStrip(params: {
  stripWeightKg: number;
  outerDiameterMm: number;
  wallThicknessMm: number;
}): number {
  const { stripWeightKg, outerDiameterMm, wallThicknessMm } = params;
  // Área de sección transversal del tubo (mm²)
  const innerDiameter = outerDiameterMm - 2 * wallThicknessMm;
  const sectionArea =
    (Math.PI / 4) * (outerDiameterMm ** 2 - innerDiameter ** 2);
  // Peso por metro lineal (kg/m)
  const weightPerMeter = sectionArea * STEEL_DENSITY_FACTOR * 1000; // cm³→dm³→kg
  return stripWeightKg / weightPerMeter;
}

export interface TubingPlanItem {
  sku: string;
  quantity: number;           // tubos a producir
  outerDiameterMm: number;
  wallThicknessMm: number;
  lengthMeters: number;
}
```

`src/modules/tubing/domain/validation.ts`

```typescript
import { TubingPlanItem, calcStripWidthForTube } from './rollForming';

export function validateTubingPlan(
  items: TubingPlanItem[],
  coilWidth: number,
): void {
  for (const item of items) {
    const requiredWidth = calcStripWidthForTube(item.outerDiameterMm);
    if (requiredWidth > coilWidth) {
      throw new Error(
        `El tubo ${item.sku} requiere un fleje de ${requiredWidth}mm pero la bobina solo tiene ${coilWidth}mm de ancho.`,
      );
    }
    if (item.quantity <= 0) {
      throw new Error(`La cantidad para ${item.sku} debe ser mayor a 0.`);
    }
  }
}
```

---

## Paso 4 — Servicios Firebase (2–3 horas)

`src/modules/tubing/services/productionService.ts`

Copia `drywall/services/productionService.ts` como base y adapta:

| Función drywall             | Equivalente tubing              | Diferencia clave                            |
|-----------------------------|---------------------------------|---------------------------------------------|
| `saveCuttingPlan`           | `saveTubingPlan`                | Items tienen `outerDiameterMm` + `wallThickness` |
| `processSingleStrip`        | `processTubeRun`                | Produce "metros de tubo" además de piezas   |
| `cancelCuttingPlan`         | `cancelTubingPlan`              | Mismo patrón, diferente colección           |

> ⚠️ Recuerda las reglas no negociables:
> - Todo cambio a stock/kardex → `runTransaction`
> - Lecturas antes que escrituras dentro de la transacción
> - Audit log en la misma transacción

`src/modules/tubing/services/inventoryService.ts`

```typescript
// Mismo patrón que drywall/services/inventoryService.ts
// Cambia el índice Algolia por el de tubería cuando exista
// Por ahora reutiliza el mismo índice 'coils' con filtro de tipo
```

---

## Paso 5 — Motor de producción (1 hora)

`src/modules/tubing/engines/production.ts`

```typescript
import { db } from '@/lib/firebase/clientApp';
import { doc, getDoc } from 'firebase/firestore';
import type {
  ProductionEngine,
  PlanInput,
  Plan,
  ExecutionData,
  Output,
  OperationStatus,
  DomainError,
  Result,
} from '@/core/contracts';
import { Coil } from '@/types';
import {
  saveTubingPlan,
  processTubeRun,
  cancelTubingPlan,
} from '../services/productionService';

export interface TubingPlanInput extends PlanInput {
  coilId: string;
  items: {
    sku: string;
    quantity: number;
    outerDiameterMm: number;
    wallThicknessMm: number;
    lengthMeters: number;
  }[];
}

export interface TubingExecutionData extends ExecutionData {
  sku: string;
  tubeCount: number;
  operatorId: string;
}

function toDomainError(e: unknown): DomainError {
  const message =
    e instanceof Error ? e.message : 'Error desconocido en producción tubería';
  return { code: 'TUBING_PRODUCTION_ERROR', message };
}

export const tubingProductionEngine: ProductionEngine = {
  async planOperation(input: PlanInput): Promise<Result<Plan, DomainError>> {
    const { coilId, items } = input as TubingPlanInput;
    try {
      await saveTubingPlan(coilId, items);
      return { success: true, data: { id: coilId, status: 'IN_PROGRESS' } };
    } catch (e) {
      return { success: false, error: toDomainError(e) };
    }
  },

  async executeOperation(
    planId: string,
    executionData: ExecutionData,
  ): Promise<Result<Output, DomainError>> {
    const { sku, tubeCount, operatorId } = executionData as TubingExecutionData;
    try {
      await processTubeRun(planId, sku, tubeCount, operatorId);
      return {
        success: true,
        data: { producedItems: [{ sku, quantity: tubeCount, cost: 0 }] },
      };
    } catch (e) {
      return { success: false, error: toDomainError(e) };
    }
  },

  async cancelOperation(
    operationId: string,
    reason: string,
  ): Promise<Result<void, DomainError>> {
    try {
      await cancelTubingPlan(operationId, reason);
      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: toDomainError(e) };
    }
  },

  async getStatus(operationId: string): Promise<OperationStatus> {
    const snap = await getDoc(doc(db, 'coils', operationId));
    if (!snap.exists()) return { id: operationId, status: 'NOT_FOUND', progress: 0 };
    const coil = snap.data() as Coil;
    const strips = coil.plannedStrips ?? [];
    const total = strips.reduce((s, x) => s + x.initialCount, 0);
    const pending = strips.reduce((s, x) => s + x.pendingCount, 0);
    const progress = total === 0 ? 0 : Math.round(((total - pending) / total) * 100);
    return { id: operationId, status: coil.status, progress };
  },
};
```

`src/modules/tubing/engines/inventory.ts`

```typescript
// Mismo patrón que drywall/engines/inventory.ts
// Sustituir fetchInventory por el de tubing cuando exista
import type { InventoryEngine, InventoryFilters, InventoryView, StockMetrics } from '@/core/contracts';
import { db } from '@/lib/firebase/clientApp';
import { doc, getDoc } from 'firebase/firestore';
import { fetchInventory } from '../services/inventoryService';

export const tubingInventoryEngine: InventoryEngine = {
  async getInventoryView(filters: InventoryFilters): Promise<InventoryView> {
    const result = await fetchInventory({
      pageSize: 10,
      statusFilter: filters.status ?? 'ALL',
      searchTerm: filters.searchTerm ?? '',
      startDate: filters.startDate,
      endDate: filters.endDate,
      direction: 'first',
      cursorDoc: null,
      page: 0,
    });
    return { items: result.coils, totalCount: result.totalCount ?? 0 };
  },

  async calculateMetrics(sku: string): Promise<StockMetrics> {
    const snap = await getDoc(doc(db, 'inventory_stock', sku));
    if (!snap.exists()) return { totalQuantity: 0, totalValue: 0 };
    const data = snap.data()!;
    const totalQuantity = Number(data.totalQuantity ?? 0);
    const lastCostPerPiece = Number(data.lastCostPerPiece ?? 0);
    return {
      totalQuantity,
      totalValue: Number((totalQuantity * lastCostPerPiece).toFixed(2)),
    };
  },
};
```

---

## Paso 6 — Configuración del módulo (30 min)

`src/modules/tubing/config/permissions.ts`

```typescript
import type { RolePermissionMap } from '@/core/contracts';

export const tubingPermissions: RolePermissionMap = {
  ADMIN:      { canView: true, canCreate: true, canEdit: true,  canDelete: true,  canVoid: true  },
  SUPERVISOR: { canView: true, canCreate: true, canEdit: true,  canDelete: false, canVoid: true  },
  OPERATOR:   { canView: true, canCreate: true, canEdit: false, canDelete: false, canVoid: false },
};
```

`src/modules/tubing/config/sidebar.ts`

```typescript
import type { MenuItem } from '@/core/contracts';

export const tubingSidebarItems: MenuItem[] = [
  {
    label: 'Inventario',
    href: '/admin/tubing/inventory',
    icon: 'Database',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Producción',
    href: '/admin/tubing/production',
    icon: 'Factory',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Terminal Móvil',
    href: '/admin/tubing/operator',
    icon: 'Smartphone',
    roles: ['ADMIN', 'SUPERVISOR', 'OPERATOR'],
  },
];
```

`src/modules/tubing/routes.ts`

```typescript
import type { RouteConfig } from '@/core/contracts';

export const tubingRoutes: RouteConfig[] = [
  {
    path: '/admin/tubing/inventory',
    component: 'modules/tubing/routes/inventory/page',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    path: '/admin/tubing/production',
    component: 'modules/tubing/routes/production/page',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  {
    path: '/admin/tubing/operator',
    component: 'modules/tubing/routes/operator/page',
    protected: true,
    roles: ['ADMIN', 'SUPERVISOR', 'OPERATOR'],
  },
];
```

---

## Paso 7 — Punto de entrada del módulo (15 min)

`src/modules/tubing/index.ts`

```typescript
import type { BusinessLineModule } from '@/core/contracts';
import { tubingProductionEngine } from './engines/production';
import { tubingInventoryEngine } from './engines/inventory';
import { tubingCatalogSchema } from './schemas/catalog';
import { tubingRoutes } from './routes';
import { tubingSidebarItems } from './config/sidebar';
import { tubingPermissions } from './config/permissions';

export const tubingModule: BusinessLineModule = {
  id: 'tubing',
  displayName: 'Tubería',
  icon: 'Package',

  productionEngine: tubingProductionEngine,
  inventoryEngine: tubingInventoryEngine,
  catalogSchema: tubingCatalogSchema,

  routes: tubingRoutes,
  sidebarItems: tubingSidebarItems,
  permissions: tubingPermissions,
};
```

---

## Paso 8 — Rutas de Next.js (1–2 horas)

Crea las páginas siguiendo exactamente el mismo patrón de drywall.  
Las rutas de tubing van en `src/app/admin/tubing/` **separadas** de las de drywall.

```
src/app/admin/tubing/
├── inventory/page.tsx      ← Copia de drywall/routes/inventory/page.tsx adaptada
├── production/page.tsx     ← Copia de drywall/routes/production/page.tsx adaptada
└── operator/page.tsx       ← Copia de drywall/routes/operator/page.tsx adaptada
```

> No compartas páginas entre líneas. Aunque parezcan iguales hoy, divergirán.

Actualiza `ROUTE_PERMISSIONS` en `src/app/admin/layout.tsx`:

```typescript
const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  // ... existentes ...

  // Tubería
  "/admin/tubing/inventory":  ["ADMIN", "SUPERVISOR"],
  "/admin/tubing/production": ["ADMIN", "SUPERVISOR"],
  "/admin/tubing/operator":   ["ADMIN", "SUPERVISOR", "OPERATOR"],
};
```

---

## Paso 9 — Registrar el módulo (15 min)

`src/context/BusinessLineContext.tsx` — **un solo cambio**:

```typescript
// Antes:
import { drywallModule } from '@/modules/drywall';
const ACTIVE_MODULES: BusinessLineModule[] = [drywallModule];

// Después:
import { drywallModule } from '@/modules/drywall';
import { tubingModule } from '@/modules/tubing';        // ← agregar
const ACTIVE_MODULES: BusinessLineModule[] = [drywallModule, tubingModule]; // ← agregar
```

El selector del sidebar y el menú dinámico funcionarán automáticamente.

---

## Paso 10 — Agregar ícono al selector (5 min)

Si el módulo usa un ícono nuevo (no `Factory`, `Database`, `Smartphone`, `Package`),
agrégalo al mapa en dos lugares:

1. `src/components/layout/BusinessLineSelector.tsx` → función `ModuleIcon`
2. `src/components/layout/sidebar.tsx` → función `resolveIcon` + import en la cabecera

---

## Checklist de implementación

```
Estructura y contratos
  [ ] mkdir -p src/modules/<linea>/{engines,schemas,config,domain,services,components,hooks,routes}
  [ ] schemas/catalog.ts con Zod schema (sin invalid_type_error — usa Zod v4)
  [ ] engines/production.ts implementando ProductionEngine
  [ ] engines/inventory.ts implementando InventoryEngine
  [ ] config/permissions.ts
  [ ] config/sidebar.ts
  [ ] routes.ts
  [ ] index.ts exportando BusinessLineModule

Dominio puro (sin Firebase, sin React)
  [ ] domain/<proceso>.ts con fórmulas específicas
  [ ] domain/validation.ts
  [ ] Tests de dominio (npm run test -- --coverage)

Servicios Firebase
  [ ] services/productionService.ts (runTransaction, lecturas antes escrituras, audit log)
  [ ] services/inventoryService.ts

Componentes y rutas
  [ ] src/app/admin/<linea>/inventory/page.tsx
  [ ] src/app/admin/<linea>/production/page.tsx
  [ ] src/app/admin/<linea>/operator/page.tsx
  [ ] ROUTE_PERMISSIONS actualizado en admin/layout.tsx

Integración
  [ ] ACTIVE_MODULES actualizado en BusinessLineContext.tsx
  [ ] Íconos nuevos registrados en BusinessLineSelector + sidebar (si aplica)

Validación final
  [ ] npx tsc --noEmit pasa sin errores
  [ ] npm run build compila
  [ ] npm run lint pasa
  [ ] Probado en emulador (npm run emulate)
```

---

## Diferencias clave con drywall

| Aspecto               | Drywall                           | Tubing                                     |
|-----------------------|-----------------------------------|--------------------------------------------|
| Fase 1                | Slitter (corte longitudinal)      | Slitter (igual)                            |
| Fase 2                | Conformadora (perfil C/U)         | Conformadora tubular (enrollado + soldado)  |
| Unidad de output      | Piezas (parantes, rieles, omega)  | Metros lineales + piezas de tubo           |
| Ancho de fleje        | Fijo por SKU (ej: 89mm)           | π × D_ext + solapado soldadura             |
| Scrap                 | Sobrante lateral de la bobina     | Solapado de soldadura (mínimo)             |
| Tolerancia producción | 5% sobre piezas teóricas          | Validar por peso y metros                  |
| SKU pattern           | `P38`, `R65`, `OMG`               | `TUB_{diámetro}_{espesor}`                 |

---

## Trampas específicas de nuevas líneas

1. **No reutilices páginas de drywall** aunque parezcan iguales. Las divergencias de dominio
   aparecen rápido y el acoplamiento es difícil de revertir.

2. **Los índices de Algolia son por línea.** Al crear el módulo, crear el índice en Algolia
   y actualizar `ALGOLIA_INDICES` en `src/lib/algoliaClient.ts`.

3. **Las reglas de Firestore** aplican a todas las líneas. Si la nueva línea crea colecciones
   nuevas (ej: `tube_orders`), agregar el match correspondiente en `firestore.rules`.
   Pedir aprobación según CLAUDE.md §9.

4. **Los roles no cambian.** No crear `TUBE_OPERATOR` ni similares. Usar `ADMIN`,
   `SUPERVISOR`, `OPERATOR` con el `RolePermissionMap` del módulo para matizar acceso.

5. **El `drywallModule` es la referencia canónica.** Cuando tengas dudas sobre cómo
   estructurar algo, lee cómo lo resuelve drywall primero.
