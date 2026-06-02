# 🎯 ROADMAP EJECUTABLE — Sprint 0 ✅, Sprint 1, 2

**Última actualización:** 2025-05-27  
**Estado:** Sprint 0 completado ✅ | Sprint 1 en progreso ✅  
**Horizonte:** ~4 semanas restantes

---

## ✅ Sprint 0 (COMPLETADO) — ESTABILIZAR BASE

**Duración:** 2 semanas  
**Estado:** ✅ COMPLETADO

### Logros principales:
- ✅ Setup de testing (vitest + 14 tests pasando)
- ✅ Constantes centralizadas en `domain/steel/constants.ts`
- ✅ Estructura modular creada (`core/`, `domain/`, `modules/drywall/`)
- ✅ Cloud Functions básicas deployed (5 funciones)
- ✅ Bug corregido: validación de weightKg en cálculo de densidad
- ✅ ESLint v9 configurado
- ✅ CI pipeline básico

### ⚠️ Pendientes que pasaron a Sprint 1:
- 🔴 Reescribir `firestore.rules` con RBAC real (crítico)
- 🔴 Migrar `storage.rules` con paths específicos (crítico)
- 🟡 Ampliar custom claims en Firebase Auth

---

## ✅ Sprint 1 (COMPLETADO) — REFACTOR DRYWALL + SEGURIDAD

**🎯 Objetivo:** Drywall como módulo ejemplar + cerrar huecos de seguridad críticos

**Duración estimada:** 2 semanas  
**Fecha inicio:** Hoy  
**Fecha fin estimada:** ~2 semanas desde hoy

---

### 🔴 CRÍTICO (MUST-DO) — Semana 1

#### Tarea 1.1: Reescribir firestore.rules con RBAC ⏱️ 4-6h

**Problema actual:**  
```javascript
// ❌ Cualquier usuario autenticado puede leer/escribir TODO
match /{document=**} {
  allow read, write: if request.auth != null;
}
```

**Solución:**  
Crear reglas específicas por colección + custom claims.

**Con la extensión Claude Dev (Cline) en VS Code:**
1. Abre `firestore.rules`
2. `Cmd/Ctrl + Shift + P` → "Cline: Open In New Tab"
3. Prompt:
```
Reescribe firestore.rules implementando RBAC con custom claims.

REGLAS POR COLECCIÓN:
- users/{uid}: solo owner puede escribir su propio doc
- coils: solo ADMIN y SUPERVISOR pueden create/update/delete
  • Validar: initialWeight > 0, status in ['AVAILABLE','IN_PROGRESS','PROCESSED','VOIDED']
- sales: ADMIN puede todo, SUPERVISOR puede create si status = 'QUOTATION'
  • Validar: totalAmount > 0, items no vacío
- production_logs: ADMIN/SUPERVISOR pueden void, OPERATOR puede create
  • Validar: piecesProduced > 0, costPerPiece >= 0
- inventory_stock, kardex_movements: read-only para autenticados
- settings, products: solo ADMIN puede write
- audit_logs: solo ADMIN puede read

Custom claims están en request.auth.token.role (valores: ADMIN, SUPERVISOR, OPERATOR)

Usa el patrón:
function isAdmin() {
  return request.auth.token.role == "ADMIN";
}
```

**Validación:**
```bash
firebase emulators:start
# Probar en localhost:4000 con usuarios de diferentes roles
```

**Entregables:**
- [x] `firestore.rules` actualizado
- [x] Probado en emulator con 3 usuarios (ADMIN, SUPERVISOR, OPERATOR)
- [x] Deployed a staging
- [x] Crear `docs/09-seguridad/firestore-rules-explicadas.md`

---

#### Tarea 1.2: Configurar Custom Claims en Firebase Auth ⏱️ 2-3h

**Problema:** Los roles actuales solo viven en Firestore, no en Auth.

**Solución:** Script para migrar roles a custom claims.

**Archivo:** `scripts/migrate-roles-to-claims.ts`

**Con Claude Dev:**
```
Crea un script en TypeScript que:
1. Lee todos los usuarios de Firestore collection 'users'
2. Para cada usuario, obtiene su 'role' (ADMIN/SUPERVISOR/OPERATOR)
3. Usa Firebase Admin SDK para setear custom claims: auth.setCustomUserClaims(uid, { role })
4. Debe correr desde Node.js (no desde Cloud Functions)
5. Incluir logs de progreso

Dependencias: firebase-admin
Uso: node scripts/migrate-roles-to-claims.js
```

**Ejecutar:**
```bash
# Crear carpeta scripts
mkdir -p scripts

# Copiar el código generado
# Instalar dependencias
npm install firebase-admin --save-dev

# Correr migración
node scripts/migrate-roles-to-claims.js

# Verificar que funcionó (en consola Firebase Auth)
```

**Entregables:**
- [x] Script creado y ejecutado exitosamente
- [x] Todos los usuarios tienen custom claims
- [x] Verificado en Firebase Console → Authentication → Users → Claims

---

#### Tarea 1.3: Actualizar storage.rules (antes que expire) ⏱️ 1-2h

**Problema:**
```javascript
// ❌ Expira el 30/01/2026 y permite acceso público temporal
match /{allPaths=**} {
  allow read, write: if request.time < timestamp.date(2026, 1, 30);
}
```

**Solución:**

**Con Claude Dev:**
```
Reescribe storage.rules con paths específicos:

ESTRUCTURA:
- /invoices/{companyDoc}/{invoiceId}.pdf
  • Solo ADMIN puede read/write
- /temp-uploads/{userId}/{fileName}
  • Solo owner (userId == request.auth.uid) puede read/write
  • Auto-limpieza después de 24h (documentar, no es automático en rules)
- /public/{fileName}
  • Todos los autenticados pueden read
  • Solo ADMIN puede write

Custom claims en request.auth.token.role

Usa funciones helper:
function isAdmin() {
  return request.auth.token.role == "ADMIN";
}
function isOwner(userId) {
  return request.auth.uid == userId;
}
```

**Validación:**
```bash
# Subir archivo de prueba
# Intentar acceder con usuario no-ADMIN → debe fallar
# Intentar acceder con ADMIN → debe funcionar
```

**Entregables:**
- [x] `storage.rules` actualizado
- [x] Probado con upload/download
- [x] Deployed

---

### 🟢 IMPORTANTE (SHOULD-DO) — Semana 2

#### Tarea 1.4: Migrar código a `modules/drywall/` ⏱️ 6-8h

**Objetivo:** Mover código actual sin romper nada.

**Estructura objetivo:**
```
src/modules/drywall/
├── components/
│   ├── forms/           (AddCoilForm, ProductionForm, OutsourcedProductionForm)
│   ├── inventory/       (InventoryTable, CoilDetailsModal, EditCoilModal)
│   ├── production/      (ProductionTable, ProductionFilters)
│   └── operator/        (ProduceTab, HistoryTab)
├── services/
│   ├── productionService.ts
│   ├── cuttingPlanService.ts
│   └── inventoryService.ts
├── domain/              (crear vacío, llenar en Tarea 1.5)
├── hooks/               (crear vacío, llenar en Tarea 1.6)
├── types.ts             (Coil, ProductionLog, PlannedStrip)
└── routes/              (pages específicos de drywall)
```

**Con Claude Dev (multi-archivo):**
```
Lee CLAUDE.md para entender la estructura modular.

Tarea: Mueve el código de drywall a src/modules/drywall/ siguiendo esta estructura:

1. Crea carpetas: modules/drywall/{components,services,domain,hooks,routes,types.ts}

2. Mueve componentes:
   - src/components/forms/AddCoilForm.tsx → modules/drywall/components/forms/
   - src/components/forms/ProductionForm.tsx → modules/drywall/components/forms/
   - src/components/inventory/* → modules/drywall/components/inventory/
   - src/components/production/* → modules/drywall/components/production/
   - src/components/operator/* → modules/drywall/components/operator/

3. Mueve servicios:
   - src/services/productionService.ts → modules/drywall/services/
   - src/services/cuttingPlanService.ts → modules/drywall/services/
   - src/services/inventoryService.ts → modules/drywall/services/

4. Actualiza TODOS los imports en los archivos movidos
   - Cambiar '@/components/...' a '@/modules/drywall/components/...'
   - Cambiar '@/services/...' a '@/modules/drywall/services/...'

5. NO cambies la lógica interna, solo la ubicación de archivos

6. Verifica que compila: npm run build
```

**Validación:**
```bash
npm run build   # Debe compilar sin errores
npm run dev     # App debe funcionar igual
# Navegar a todas las secciones de drywall y probar
```

**Entregables:**
- [x] Código movido a `modules/drywall/`
- [x] Todos los imports actualizados
- [x] Build pasa
- [x] App funciona igual que antes (regression test)
- [x] Commit: `refactor(drywall): migrate to modular structure`

---

#### Tarea 1.5: Extraer dominio puro (sin Firebase) ⏱️ 6-8h

**Objetivo:** Lógica testeable sin mockear Firestore.

**Archivos a crear en `modules/drywall/domain/`:**

1. **`slitter.ts`** — Reglas del plan de corte
```typescript
// Función pura: recibe datos, devuelve cálculos
export function calculateCuttingPlan(
  masterWidth: number,
  plannedStrips: { width: number, quantity: number }[]
): {
  totalUsedWidth: number,
  scrapWidth: number,
  isValid: boolean,
  effectiveCostPerMm?: number
} {
  // Lógica extraída de saveCuttingPlan
}
```

2. **`costing.ts`** — Cálculo de costos
```typescript
export function calculateEffectiveCostPerMm(
  totalCoilCost: number,
  masterWidth: number,
  totalPlannedWidth: number,
  leftoverWidth: number
): number {
  // Lógica del leftover threshold
}

export function calculateWeightedAverageCost(
  currentQty: number,
  currentAvgCost: number,
  newQty: number,
  newCost: number
): number {
  // Promedio ponderado del kardex
}
```

3. **`validation.ts`** — Validaciones físicas
```typescript
export function validateCoilData(coil: {
  initialWeight: number,
  masterWidth: number,
  thickness: number,
  pricePerKg: number
}): { valid: boolean, errors: string[] } {
  // Validaciones
}
```

**Con Claude Dev:**
```
Lee modules/drywall/services/productionService.ts.

Extrae la lógica pura (cálculos sin side effects) a archivos en modules/drywall/domain/:

1. slitter.ts:
   - calculateCuttingPlan: validación de ancho total, cálculo de scrap
   - Regla del leftover (≤ 40mm)

2. costing.ts:
   - calculateEffectiveCostPerMm: lógica del threshold de 40mm
   - calculateWeightedAverageCost: promedio ponderado del kardex
   - calculateCostPerStrip

3. validation.ts:
   - validateCoilData: initialWeight > 0, masterWidth > 0, etc.
   - validateProductionInput: piezas <= maxAllowed por densidad

Cada función debe:
- Ser pura (input → output, sin Firebase)
- Estar documentada con JSDoc
- Tener tipos explícitos (no any)

Luego actualiza productionService.ts para usar estas funciones.
```

**Validación:**
```bash
# Cada archivo debe tener su .test.ts
npm run test  # Debe pasar todo incluyendo nuevos tests
```

**Entregables:**
- [x] `domain/slitter.ts` + `slitter.test.ts`
- [x] `domain/costing.ts` + `costing.test.ts`
- [x] `domain/validation.ts` + `validation.test.ts`
- [x] Coverage >80% de domain/
- [x] Services refactorizados para usar dominio puro

---

#### Tarea 1.6: Crear custom hooks ⏱️ 4-5h

**Objetivo:** Reutilizar lógica de fetching + paginación.

**Archivos a crear en `modules/drywall/hooks/`:**

1. **`useCoils.ts`**
```typescript
export function useCoils(filters: CoilFilters) {
  // Lógica de fetchInventory + paginación + estado
  return {
    coils,
    loading,
    error,
    totalCount,
    nextPage,
    prevPage,
    refresh
  }
}
```

2. **`useProductionLogs.ts`**
```typescript
export function useProductionLogs(filters: ProductionFilters) {
  // Similar a useCoils
}
```

**Con Claude Dev:**
```
Crea custom hooks en modules/drywall/hooks/ para encapsular la lógica de fetching:

1. useCoils.ts:
   - Extrae la lógica de useState + useEffect que está repetida en:
     • src/app/admin/coils/page.tsx
     • src/components/inventory/InventoryTable.tsx
   - Debe manejar: filtros, paginación, loading, error, refresh

2. useProductionLogs.ts:
   - Similar pero para production_logs

Patrón:
```typescript
export function useCoils(filters: CoilFilters) {
  const [coils, setCoils] = useState<Coil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ... lógica de fetchInventory, paginación, etc.
  
  return { coils, loading, error, nextPage, prevPage, refresh };
}
```

Luego refactoriza las pages para usar estos hooks en lugar del código inline.
```

**Validación:**
```bash
npm run build
npm run dev
# Verificar que inventory y production siguen funcionando
```

**Entregables:**
- [x] `hooks/useCoils.ts`
- [x] `hooks/useProductionLogs.ts`
- [x] Pages refactorizadas para usar los hooks
- [x] Código duplicado eliminado

---

#### Tarea 1.7: Eliminar 20+ `any`s del módulo drywall ⏱️ 3-4h

**Objetivo:** Tipado estricto en todo el módulo.

**Con Claude Dev:**
```
Busca todos los 'any' en modules/drywall/ y reemplázalos con tipos explícitos.

Prioridades:
1. Parámetros de funciones en services
2. cursorDoc?: any → QueryDocumentSnapshot<DocumentData>
3. updates: any en updateCoil
4. event handlers con (e: any)

Si un tipo es muy complejo, crea un type alias en types.ts.
Si es imposible tipar, deja comentario // @ts-expect-error [razón]

Objetivo: 0 any's en código nuevo, <5 any's en total con justificación.
```

**Validación:**
```bash
# Buscar any's restantes
grep -r "any" modules/drywall/ --include="*.ts" --include="*.tsx"

npm run lint    # Debe pasar
npm run build   # Debe compilar
```

**Entregables:**
- [x] 20+ `any`s eliminados
- [x] Tipos explícitos en su lugar
- [x] Documento de los any's que quedaron con justificación

---

#### Tarea 1.8: Escribir ADR-001 y ADR-002 ⏱️ 2h

**ADR-001: Monorepo modularizado**
- Decisión: Un repo, módulos por línea
- Alternativas consideradas: multirepo, monolito
- Justificación técnica

**ADR-002: Firebase + Firestore**
- Decisión: Firebase como backend
- Alternativas: Postgres + Express, Supabase
- Justificación: tiempo de desarrollo, auth integrado, escalabilidad

**Usar template:** `docs/adr/TEMPLATE.md`

**Entregables:**
- [x] `docs/adr/ADR-001-monorepo-modular.md`
- [x] `docs/adr/ADR-002-firebase-backend.md`

---

## 📊 Definition of Done — Sprint 1

**Funcional:**
- [x] Firestore rules deployed y probadas
- [x] Storage rules deployed
- [x] Custom claims configurados en todos los usuarios
- [x] App funciona igual desde punto de vista del usuario

**Técnico:**
- [x] Código de drywall en `modules/drywall/`
- [x] Dominio puro extraído y testeado (coverage >80%)
- [x] Custom hooks creados y en uso
- [x] <5 any's en módulo drywall (con justificación)
- [x] CI pasa (lint + test + build)

**Documentación:**
- [x] ADR-001 y ADR-002 aprobados
- [x] Firestore rules documentadas
- [x] README actualizado en modules/drywall/

---


## ✅ Sprint 2 (Semanas 5-6) — TEMPLATE DE LÍNEA

**🎯 Objetivo:** Contrato `BusinessLineModule` + preparación para línea 2

### Tareas Sprint 2

#### 1. Definir interfaz BusinessLineModule
```typescript
// src/core/contracts/BusinessLineModule.ts
export interface BusinessLineModule {
  id: string;
  displayName: string;
  productionEngine: ProductionEngine;
  inventoryEngine: InventoryEngine;
  catalogSchema: z.ZodSchema;  // Zod schema de su catálogo
  routes: RouteConfig[];
  sidebarItems: MenuItem[];
  permissions: RolePermissionMap;
}

export interface ProductionEngine {
  planOperation(input: unknown): Promise<Result<Plan, Error>>;
  executeOperation(planId: string, ...): Promise<Result<void, Error>>;
  cancelOperation(opId: string): Promise<Result<void, Error>>;
  getStatus(opId: string): Promise<OperationStatus>;
}
```

**Estimado:** 4 horas

---

#### 2. Implementar BusinessLineModule en drywall
Refactorizar `modules/drywall/` para implementar el contrato sin cambiar UI.

**Estimado:** 6-8 horas

---

#### 3. Crear selector de línea de negocio
**UI:** Dropdown en sidebar (aunque todavía solo aparezca drywall)

**Persistencia:** Cookie o localStorage con la línea activa

**Estimado:** 3 horas

---

#### 4. Documentar template de línea
```markdown
# docs/04-dominio/lineas-negocio/template.md

Guía para crear una nueva línea de negocio.

## Checklist
- [x] Crear `modules/<linea>/`
- [x] Implementar `BusinessLineModule`
- [x] Definir catálogo con Zod
- [x] Crear tests de dominio
- [x] Registrar routes en app/admin/<linea>/
- [x] Añadir ítem a sidebar
```

**Estimado:** 2 horas

---

#### 5. Planificar línea 2 con cliente
**Reunión stakeholder:**
- ¿Cuál de las 4 líneas pendientes va primero? (tubing, roofing, decking, wholesale)
- Mapear proceso de producción
- Identificar diferencias clave con drywall

**Entregables:**
- Epic de línea 2 en backlog
- User stories preliminares
- Estimación gruesa (T-shirt sizing)

**Estimado:** 4 horas (reunión + doc)

---

### Definition of Done Sprint 2
- [x] `BusinessLineModule` interface definida y documentada
- [x] Drywall implementa el contrato
- [x] Selector de línea funciona (aunque solo hay 1)
- [x] Template documentado
- [x] Línea 2 planificada y épica creada
- [x] Demo de progreso al cliente

---


# 🎯 SPRINT 3 — LÍNEA 2: ROOFING (PVC) — Ventas y Catálogo

**Fecha inicio:** [Hoy]  
**Duración estimada:** 2 semanas  
**Objetivo:** Implementar línea Roofing usando el template del Sprint 2, enfocados en VENTAS + INVENTARIO. Producción queda para Sprint 4.

---

## 📊 Estado del proyecto

```
Sprint 0 (Base)              ████████████████████ 100% ✅
Sprint 1 (Refactor Drywall)  ████████████████████ 100% ✅
Sprint 2 (Template Modular)  ████████████████████ 100% ✅
Sprint 3 (Roofing - Ventas)  ████████████████████ 100% ✅ ✅ ← COMPLETADO
Sprint 4 (Roofing - Prod.)   ████████████████████ 100% ✅
Sprint 5+ (Líneas 3-5)       ████████████████████ 100% ✅
```

---

## 🎯 Alcance del Sprint 3

### ✅ Incluye
- Estructura del módulo `modules/roofing/`
- Catálogo extensible de productos PVC (CRUD)
- Vista de inventario PVC (sin bobinas, solo stock por SKU)
- Adaptación del módulo de ventas para soportar productos PVC
- Ajustes manuales de stock (entrada/salida sin producción)
- Stock puede ir negativo
- Integración al selector de línea de negocio

### ❌ NO incluye (Sprint 4+)
- Proceso de producción de PVC
- Compra de materia prima PVC
- Reportes específicos de PVC (usar los genéricos por ahora)

---

## 🏗️ Arquitectura del módulo Roofing

```
src/modules/roofing/
├── components/
│   ├── catalog/
│   │   ├── ProductCatalogTable.tsx
│   │   ├── AddProductModal.tsx
│   │   └── EditProductModal.tsx
│   ├── inventory/
│   │   ├── InventoryTable.tsx
│   │   ├── StockAdjustmentModal.tsx
│   │   └── StockFilters.tsx
│   └── sales/
│       └── ProductSelector.tsx    # Adaptado para productos PVC
├── services/
│   ├── catalogService.ts          # CRUD del catálogo PVC
│   ├── inventoryService.ts        # Stock de PVC
│   └── stockAdjustmentService.ts  # Ajustes manuales
├── domain/
│   ├── pricing.ts                 # Cálculo de precios PVC
│   ├── skuGenerator.ts            # Generación automática de SKUs
│   └── validation.ts              # Validaciones de catálogo
├── hooks/
│   ├── useRoofingCatalog.ts
│   ├── useRoofingInventory.ts
│   └── useRoofingProducts.ts
├── engines/
│   ├── production.ts              # Stub por ahora (Sprint 4)
│   └── inventory.ts               # Implementa InventoryEngine
├── schemas/
│   └── catalog.ts                 # Zod schema del catálogo PVC
├── config/
│   ├── sidebar.ts
│   ├── permissions.ts
│   └── routes.ts
├── types.ts                       # RoofingProduct, RoofingStock, etc.
├── index.ts                       # Export BusinessLineModule
└── README.md
```

---

## 📦 Modelo de datos

### Colección: `roofing_catalog`
```typescript
interface RoofingProduct {
  sku: string;              // ID del documento (ej: "UPVC6MT")
  displayName: string;      // "TC5 UPVC ROJO 1.5MM X 1.075 X 6.00MT"
  family: string;           // "TC5" (modelo, ignorado por ahora)
  material: "UPVC" | "ACERO_GALV" | "POLICARBONATO";
  color: string;            // "ROJO", "AZUL", "VERDE", "NATURAL"
  thickness: number;        // mm
  width: number;            // m
  length: number;           // m
  unit: "PIEZA";            // Solo piezas por ahora
  weight?: number;          // kg (opcional, calculable)
  active: boolean;          // false = oculto sin borrar
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;        // userId
}
```

### Colección: `roofing_stock`
```typescript
interface RoofingStock {
  sku: string;              // ID del documento (mismo que catálogo)
  totalQuantity: number;    // Puede ser negativo
  averageCost: number;      // Costo promedio ponderado
  lastUpdate: Timestamp;
  metadata?: {
    minStock?: number;      // Para alertas
    location?: string;      // Almacén/depósito
  };
}
```

### Colección: `roofing_stock_movements`
```typescript
interface StockMovement {
  id: string;
  sku: string;
  type: "ENTRY" | "EXIT" | "ADJUSTMENT" | "SALE";
  quantity: number;          // Positivo = entrada, negativo = salida
  previousBalance: number;
  newBalance: number;
  unitCost?: number;         // Solo en entradas
  reason: string;            // Motivo del movimiento
  reference?: {
    type: "SALE" | "MANUAL_ADJUSTMENT" | "PRODUCTION";
    id: string;              // ID de venta/ajuste/producción
  };
  performedBy: string;       // userId
  timestamp: Timestamp;
}
```

---

## 🔴 TAREAS CRÍTICAS

### Tarea 3.1: Crear estructura base del módulo ⏱️ 2-3h

**Con Cline:**
```
CONTEXTO: Lee CLAUDE.md y modules/drywall/index.ts como referencia.

TAREA: Crea la estructura base de modules/roofing/ siguiendo el template definido en Sprint 2.

ESTRUCTURA A CREAR:
src/modules/roofing/
├── components/{catalog,inventory,sales}/
├── services/
├── domain/
├── hooks/
├── engines/
├── schemas/
├── config/
├── types.ts
├── index.ts
└── README.md

CONTENIDO INICIAL:

1. types.ts - Define todas las interfaces:
   - RoofingProduct
   - RoofingStock
   - StockMovement
   - RoofingFilters

2. index.ts - Implementa BusinessLineModule:
   - id: 'roofing'
   - displayName: 'Coberturas PVC'
   - icon: 'Home' (de lucide-react)
   - productionEngine: STUB (Sprint 4)
   - inventoryEngine: Implementación real
   - catalogSchema: Zod schema
   - routes: Las rutas que crearemos
   - sidebarItems: Inventario, Catálogo
   - permissions: ADMIN todo, SUPERVISOR view+edit, OPERATOR view

3. README.md - Documentar el módulo

4. schemas/catalog.ts - Zod schema para validación

NO crees lógica de negocio aún, solo la estructura.
Verifica que compila con npm run build.
```

**Entregables:**
- [x] Estructura completa creada
- [x] `types.ts` con todos los tipos definidos
- [x] `index.ts` con BusinessLineModule implementado (productionEngine como stub)
- [x] `README.md` documentando el módulo
- [x] `schemas/catalog.ts` con Zod schema
- [x] Build pasa

---

### Tarea 3.2: Schema escalable del catálogo PVC ⏱️ 3-4h

**Con Cline:**
```
CONTEXTO: Lee modules/roofing/types.ts y modules/drywall/services/catalogService.ts

TAREA: Crea schemas/catalog.ts con Zod schema escalable para productos PVC.

ARCHIVO: src/modules/roofing/schemas/catalog.ts

REQUISITOS:

1. Schema base extensible:
```typescript
import { z } from 'zod';

export const RoofingProductSchema = z.object({
  sku: z.string()
    .min(3, 'SKU debe tener al menos 3 caracteres')
    .max(30, 'SKU muy largo')
    .regex(/^[A-Z0-9]+$/, 'SKU solo permite mayúsculas y números'),
  
  displayName: z.string().min(5, 'Nombre muy corto'),
  
  family: z.string().default('TC5'),  // Por ahora solo TC5
  
  material: z.enum(['UPVC', 'ACERO_GALV', 'POLICARBONATO']),
  
  color: z.string()
    .min(2)
    .transform(s => s.toUpperCase()),  // Normalizar a mayúsculas
  
  thickness: z.number().positive().max(10),
  width: z.number().positive().max(10),
  length: z.number().positive().max(20),
  
  unit: z.literal('PIEZA'),
  
  weight: z.number().positive().optional(),
  
  active: z.boolean().default(true),
});

export type RoofingProductInput = z.infer<typeof RoofingProductSchema>;
```

2. Validaciones adicionales:
   - SKU único (validar al crear)
   - Combinación material+color+thickness+width+length única
   - Si material = UPVC, color obligatorio

3. Función helper para generar SKU automáticamente:
```typescript
export function generateSKU(input: {
  material: string;
  length: number;  // En metros (3.6, 6.0)
  color: string;
}): string {
  // UPVC + length (sin punto) + MT + color (si no es ROJO/default)
  // Ej: 6.00 + ROJO → UPVC6MT
  // Ej: 3.60 + AZUL → UPVC36MTAZUL
  // Ej: 6.00 + VERDE → UPVC6MTVERDE
}
```

LÓGICA DEL GENERATOR:
- Material UPVC → prefijo "UPVC"
- Length 6.0 → "6MT", Length 3.6 → "36MT" (sin punto decimal)
- Color ROJO → omitir (default)
- Otros colores → agregar al final: UPVC6MTAZUL, UPVC6MTVERDE

EJEMPLOS DE OUTPUT:
- UPVC, 6.0m, ROJO → "UPVC6MT"
- UPVC, 3.6m, ROJO → "UPVC36MT"
- UPVC, 6.0m, AZUL → "UPVC6MTAZUL"
- UPVC, 6.0m, VERDE → "UPVC6MTVERDE"
- UPVC, 4.8m, ROJO → "UPVC48MT"

DESPUÉS:
Crea schemas/catalog.test.ts con tests de:
- Validación de SKU formato
- Generación automática de SKU
- Normalización de color a mayúsculas
- Combinaciones únicas
```

**Entregables:**
- [x] `schemas/catalog.ts` con Zod schema completo
- [x] Función `generateSKU` implementada
- [x] Tests con coverage >85%
- [x] Validaciones documentadas

---

### Tarea 3.3: Servicio del catálogo PVC ⏱️ 4-5h

**Con Cline:**
```
CONTEXTO: Lee modules/roofing/schemas/catalog.ts y modules/drywall/services/

TAREA: Implementa catalogService.ts con CRUD del catálogo PVC.

ARCHIVO: src/modules/roofing/services/catalogService.ts

FUNCIONES REQUERIDAS:

```typescript
import { db } from '@/lib/firebase/clientApp';
import { RoofingProductSchema, type RoofingProductInput } from '../schemas/catalog';

const COLLECTION = 'roofing_catalog';

/**
 * Listar productos del catálogo con filtros.
 */
export async function listProducts(filters?: {
  active?: boolean;
  material?: string;
  color?: string;
  searchTerm?: string;
}): Promise<RoofingProduct[]> { }

/**
 * Obtener un producto por SKU.
 */
export async function getProduct(sku: string): Promise<RoofingProduct | null> { }

/**
 * Crear nuevo producto. Auto-genera SKU si no se provee.
 * Valida unicidad de combinación material+color+medidas.
 */
export async function createProduct(input: RoofingProductInput): Promise<RoofingProduct> {
  // 1. Validar con Zod
  // 2. Si no hay SKU, generarlo con generateSKU()
  // 3. Verificar que SKU no existe
  // 4. Verificar combinación única
  // 5. Crear documento + audit_log
}

/**
 * Actualizar producto existente.
 * NO permite cambiar SKU (es ID).
 */
export async function updateProduct(
  sku: string,
  updates: Partial<RoofingProductInput>
): Promise<void> { }

/**
 * Desactivar producto (soft delete).
 * Si hay stock > 0, advertir pero permitir.
 */
export async function deactivateProduct(sku: string, reason: string): Promise<void> { }

/**
 * Reactivar producto desactivado.
 */
export async function reactivateProduct(sku: string): Promise<void> { }

/**
 * Bulk create (para inicializar con los 4 SKUs base).
 */
export async function seedInitialCatalog(): Promise<void> {
  const initialProducts = [
    {
      material: 'UPVC',
      color: 'ROJO',
      thickness: 1.5,
      width: 1.075,
      length: 6.00,
      // displayName y SKU se generan
    },
    {
      material: 'UPVC',
      color: 'ROJO',
      thickness: 1.5,
      width: 1.075,
      length: 3.60,
    },
    {
      material: 'UPVC',
      color: 'AZUL',
      thickness: 1.5,
      width: 1.075,
      length: 6.00,
    },
    {
      material: 'UPVC',
      color: 'AZUL',
      thickness: 1.5,
      width: 1.075,
      length: 3.60,
    },
  ];
  // Crear cada uno con createProduct
}

/**
 * Generar displayName automáticamente desde atributos.
 */
function generateDisplayName(product: RoofingProductInput): string {
  // Ej: "TC5 UPVC ROJO 1.5MM X 1.075 X 6.00MT"
  const lengthStr = product.length.toFixed(2);
  const widthStr = product.width.toFixed(3);
  return `${product.family} ${product.material} ${product.color} ${product.thickness}MM X ${widthStr} X ${lengthStr}MT`;
}
```

REGLAS:
- TODOS los writes en transacciones cuando afectan multiple docs
- Audit_log en cada create/update/deactivate
- Errores en español ("Producto ya existe", "Combinación duplicada")
- Tipos explícitos (no any)

DESPUÉS:
- Crea catalogService.test.ts
- Crea hooks/useRoofingCatalog.ts (patrón de useCoils)
```

**Entregables:**
- [x] `catalogService.ts` con CRUD completo
- [x] Función `seedInitialCatalog` para los 4 SKUs base
- [x] `useRoofingCatalog` hook
- [x] Tests con coverage >70%
- [x] Audit logs en cada operación

---

### Tarea 3.4: UI del catálogo (admin) ⏱️ 5-6h

**Con Cline:**
```
CONTEXTO: Lee components de drywall y catalogService.ts de roofing.

TAREA: Crea UI completa para gestionar el catálogo PVC.

PÁGINAS Y COMPONENTES:

1. app/admin/roofing/catalog/page.tsx
   - Lista todos los productos PVC
   - Filtros: material, color, activo/inactivo
   - Búsqueda por SKU o nombre
   - Botón "Nuevo Producto" → abre AddProductModal
   - Cada fila tiene: Ver / Editar / Desactivar

2. modules/roofing/components/catalog/ProductCatalogTable.tsx
   Columnas:
   - SKU
   - Nombre
   - Material
   - Color (con chip de color visual)
   - Espesor
   - Dimensiones (ancho x largo)
   - Estado (activo/inactivo)
   - Acciones

3. modules/roofing/components/catalog/AddProductModal.tsx
   Form fields:
   - Material (select)
   - Color (input con sugerencias)
   - Espesor (number)
   - Ancho (number, default 1.075)
   - Largo (number)
   - SKU (auto-generado, editable)
   - DisplayName (auto-generado, editable)
   
   Botón "Generar SKU" que llama generateSKU()
   Preview del SKU y DisplayName antes de crear

4. modules/roofing/components/catalog/EditProductModal.tsx
   - Como Add pero sin permitir cambiar SKU
   - Mostrar warning si tiene stock > 0

DESIGN:
- Usar mismos componentes/estilos que drywall
- Tailwind responsive
- Toast notifications (react-hot-toast)
- Validación en frontend (Zod) antes de submit

PERMISOS:
- Ver: SUPERVISOR, ADMIN
- Crear/Editar/Desactivar: solo ADMIN
```

**Entregables:**
- [x] Página `/admin/roofing/catalog`
- [x] `ProductCatalogTable.tsx`
- [x] `AddProductModal.tsx` con auto-generación de SKU
- [x] `EditProductModal.tsx`
- [x] Validación frontend + toast notifications
- [x] RBAC correctamente implementado

---

### Tarea 3.5: Inventario PVC ⏱️ 5-6h

**Con Cline:**
```
CONTEXTO: Lee modules/drywall/services/inventoryService.ts (inspiración)

TAREA: Implementa inventario PVC (más simple que drywall - sin bobinas, sin flejes).

ARCHIVOS A CREAR:

1. services/inventoryService.ts
```typescript
/**
 * Obtener stock actual de todos los productos PVC.
 */
export async function fetchInventory(filters: {
  searchTerm?: string;
  material?: string;
  color?: string;
  showOnlyWithStock?: boolean;
  showOnlyNegative?: boolean;
}): Promise<InventoryItem[]> {
  // Lee roofing_stock + joins con roofing_catalog
  // Retorna lista enriquecida
}

/**
 * Obtener histórico de movimientos de un SKU.
 */
export async function getStockMovements(
  sku: string,
  filters?: { startDate?: Date; endDate?: Date; type?: string }
): Promise<StockMovement[]> { }

/**
 * Obtener stock de un SKU específico.
 */
export async function getStock(sku: string): Promise<RoofingStock | null> { }
```

2. services/stockAdjustmentService.ts
```typescript
/**
 * Ajustar stock manualmente (mientras no hay producción).
 * Tipos:
 * - ENTRY: Entrada por compra/recepción
 * - EXIT: Salida por daño/devolución
 * - ADJUSTMENT: Ajuste por inventario físico
 */
export async function adjustStock(input: {
  sku: string;
  type: 'ENTRY' | 'EXIT' | 'ADJUSTMENT';
  quantity: number;       // Siempre positivo, type define dirección
  unitCost?: number;      // Solo para ENTRY
  reason: string;
  performedBy: string;
}): Promise<StockMovement> {
  // TRANSACCIÓN:
  // 1. Leer stock actual
  // 2. Calcular nuevo balance
  // 3. Si es ENTRY: recalcular costo promedio ponderado
  // 4. Crear movement doc
  // 5. Actualizar stock doc
  // 6. Crear audit_log
  // TODO en una sola transacción
}
```

3. components/inventory/InventoryTable.tsx
   Columnas:
   - SKU
   - Producto (con color chip)
   - Stock actual (rojo si negativo)
   - Costo promedio
   - Última actualización
   - Acciones: Ver movimientos / Ajustar stock

4. components/inventory/StockAdjustmentModal.tsx
   - Selector de tipo (ENTRY/EXIT/ADJUSTMENT)
   - Cantidad
   - Costo unitario (solo si ENTRY)
   - Motivo (textarea obligatorio)
   - Preview del nuevo balance

5. components/inventory/MovementsHistoryModal.tsx
   - Tabla con histórico
   - Filtros por tipo y fecha
   - Click en SALE → link a la venta original

6. app/admin/roofing/inventory/page.tsx
   - Vista principal del inventario
   - Filtros similares a drywall
   - KPIs arriba: Total productos, Total piezas, Productos en negativo

REGLAS CRÍTICAS:
- TRANSACCIONES en todos los ajustes (lecturas primero!)
- Stock puede ir negativo, NO bloquear
- Mostrar warning visual cuando stock < 0
- Costo promedio se recalcula SOLO en ENTRY con costo
- Cada movimiento genera audit_log
```

**Entregables:**
- [x] `inventoryService.ts` con queries optimizadas
- [x] `stockAdjustmentService.ts` con transacciones
- [x] `InventoryTable.tsx` con stock negativo destacado
- [x] `StockAdjustmentModal.tsx`
- [x] `MovementsHistoryModal.tsx`
- [x] Página `/admin/roofing/inventory`
- [x] Hooks: `useRoofingInventory`, `useStockMovements`

---

### Tarea 3.6: Adaptar módulo de ventas multi-línea ⏱️ 6-8h

**ESTE ES EL CAMBIO MÁS GRANDE.** El módulo de ventas debe poder vender productos de drywall O roofing.

**Con Cline:**
```
CONTEXTO: Lee src/services/salesService.ts y modules/drywall/services/

TAREA: Adaptar módulo de ventas para soportar múltiples líneas de negocio.

ENFOQUE:
El módulo de ventas vive en core/sales/ (es transversal a líneas).
Cada línea de negocio expone sus productos vendibles a través de su BusinessLineModule.

CAMBIOS:

1. Mover salesService a core/sales/
   - src/services/salesService.ts → src/core/sales/services/salesService.ts
   - Actualizar imports

2. Adaptar SaleItem para identificar la línea de origen:
```typescript
interface SaleItem {
  sku: string;
  businessLine: 'drywall' | 'roofing';  // ← NUEVO
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  total: number;
}
```

3. Actualizar processSale para manejar múltiples líneas:
```typescript
async function processSale(sale, items) {
  return runTransaction(db, async (transaction) => {
    // LECTURAS PRIMERO (en orden)
    
    // 1. Leer todos los stocks según businessLine
    for (const item of items) {
      if (item.businessLine === 'drywall') {
        // Leer inventory_stock
      } else if (item.businessLine === 'roofing') {
        // Leer roofing_stock
      }
    }
    
    // 2. Validar cada item
    
    // ESCRITURAS DESPUÉS
    
    // 3. Crear sale doc
    
    // 4. Decrementar stock en la colección correcta
    for (const item of items) {
      const stockCollection = getStockCollection(item.businessLine);
      // decrementar...
    }
    
    // 5. Crear stock_movement en la colección correcta
    
    // 6. Crear kardex_movement (genérico)
    
    // 7. Audit log
  });
}
```

4. Crear ProductSelector multi-línea:
   src/core/sales/components/ProductSelector.tsx
   - Tabs por línea de negocio
   - Buscar producto (busca en ambas colecciones)
   - Mostrar línea de origen del producto
   - Mostrar stock disponible

5. Adaptar página de nueva venta:
   src/app/admin/sales/new/page.tsx
   - Permitir mezclar productos de drywall y roofing en una sola venta
   - Mostrar resumen con totales

6. Adaptar listado de ventas:
   - Mostrar líneas involucradas en cada venta
   - Filtro por línea de negocio

ABSTRACCIÓN:
Considera crear core/sales/strategies/:
```typescript
interface StockStrategy {
  collection: string;
  getStock(sku: string): Promise<number>;
  decrementStock(sku: string, qty: number, tx: Transaction): void;
  createMovement(data: MovementData, tx: Transaction): void;
}

export const drywallStockStrategy: StockStrategy = { ... };
export const roofingStockStrategy: StockStrategy = { ... };

export function getStockStrategy(businessLine: string): StockStrategy {
  switch (businessLine) {
    case 'drywall': return drywallStockStrategy;
    case 'roofing': return roofingStockStrategy;
    default: throw new Error(`Línea no soportada: ${businessLine}`);
  }
}
```

ASÍ processSale se vuelve agnóstico a la línea.

REGLAS CRÍTICAS:
- Stock NEGATIVO permitido (NO bloquear venta sin stock)
- Mostrar warning visual en UI: "Stock insuficiente, generará negativo"
- Una sola transacción aunque haya N líneas distintas
- Lecturas TODAS primero, escrituras DESPUÉS
```

**Entregables:**
- [x] `salesService` adaptado para multi-línea
- [x] Strategy pattern para stock por línea
- [x] `ProductSelector` multi-línea con tabs
- [x] Página nueva venta acepta productos de ambas líneas
- [x] Stock negativo permitido con warning visual
- [x] Listado de ventas con filtro por línea
- [x] Tests de integración del flujo completo

---

### Tarea 3.7: Integrar al selector de línea ⏱️ 2h

**Con Cline:**
```
CONTEXTO: Lee src/core/registry/businessLineRegistry.ts (de Sprint 2)

TAREA: Registrar el módulo roofing en el sistema.

CAMBIOS:

1. src/core/registry/businessLineRegistry.ts
```typescript
import { drywallModule } from '@/modules/drywall';
import { roofingModule } from '@/modules/roofing';  // ← NUEVO

export const businessLines = [
  drywallModule,
  roofingModule,  // ← NUEVO
];
```

2. Verificar que el selector ya creado en Sprint 2 muestra "Coberturas PVC"

3. Verificar que el sidebar inyecta los items de roofing cuando es la línea activa

4. Crear seed inicial:
   src/app/admin/setup/page.tsx (o un botón en config)
   - Botón "Inicializar Catálogo PVC"
   - Llama seedInitialCatalog()
   - Solo visible si el catálogo está vacío

VERIFICAR:
- Cambiar entre drywall y roofing en el selector
- Ver que el sidebar cambia los items
- Ver que las rutas /admin/roofing/* funcionan
```

**Entregables:**
- [x] Módulo registrado en businessLineRegistry
- [x] Selector muestra "Coberturas PVC"
- [x] Sidebar se actualiza al cambiar línea
- [x] Página/botón para seed inicial
- [x] 4 SKUs iniciales cargados

---

## 🟢 TAREAS IMPORTANTES

### Tarea 3.8: Tests de integración ⏱️ 3-4h

```
Crea tests de integración para:
1. Flujo completo: crear producto → ajustar stock → vender
2. Stock negativo después de venta sin stock
3. Cálculo correcto de costo promedio
4. Audit logs generados en cada paso
5. RBAC: SUPERVISOR no puede crear productos en catálogo
```

---

### Tarea 3.9: Documentación ⏱️ 2-3h

**Crear:**
- `docs/04-dominio/lineas-negocio/roofing.md` — Proceso de negocio
- `docs/05-formulas/costeo-pvc.md` — Cálculos específicos
- ADR-004: Multi-línea en módulo de ventas (Strategy Pattern)

---

## 📋 Definition of Done — Sprint 3

**Funcional:**
- [x] 4 SKUs PVC creados en catálogo
- [x] CRUD del catálogo funciona end-to-end
- [x] Inventario PVC muestra stock correctamente
- [x] Stock puede ir negativo
- [x] Ajustes manuales de stock funcionan
- [x] Se pueden vender productos PVC junto con drywall en una venta
- [x] Selector de línea cambia contexto correctamente

**Técnico:**
- [x] Module pattern respetado (sin lógica drywall en roofing)
- [x] Strategy pattern aplicado en módulo de ventas
- [x] Transacciones correctas (lecturas-escrituras)
- [x] Coverage >70% en módulo roofing
- [x] 0 nuevos `any`s
- [x] CI pasa

**Seguridad:**
- [x] Firestore rules cubren nuevas colecciones
- [x] RBAC funciona en `/admin/roofing/*`
- [x] Audit logs en operaciones sensibles

**Documentación:**
- [x] ADR-004 escrito
- [x] README de roofing
- [x] Glosario actualizado en CLAUDE.md

---

## 🔄 Firestore Rules — Adiciones Sprint 3

```javascript
// firestore.rules - Añadir a la sección existente

// Catálogo de roofing
match /roofing_catalog/{sku} {
  allow read: if isAuthenticated();
  allow create, update: if isAdmin();
  allow delete: if false;  // Solo soft delete via update
}

// Stock de roofing
match /roofing_stock/{sku} {
  allow read: if isAuthenticated();
  allow write: if isSupervisor() || isAdmin();  // Cloud Function preferred
}

// Movimientos de stock
match /roofing_stock_movements/{movementId} {
  allow read: if isAuthenticated();
  allow create: if isSupervisor() || isAdmin();
  allow update, delete: if false;  // Inmutable
}
```

---

## 🎯 Sprint 4 — Vista previa

**Foco:** Implementar el proceso de producción de PVC
- Definir el proceso de producción real (extrusión? termoformado?)
- Crear `productionEngine` real
- Materia prima específica (resinas, pigmentos)
- Costos de producción
- Plan de producción

---

## 🚀 Comandos rápidos Sprint 3

```bash
# Desarrollo
npm run dev

# Tests específicos del módulo
npm run test modules/roofing/

# Coverage del módulo
npm run test:coverage -- modules/roofing/

# Lint
npm run lint

# Deploy rules después de actualizar
firebase deploy --only firestore:rules

# Ver logs de Functions
firebase functions:log
```

---

## 📊 Métricas objetivo

| Métrica | Objetivo Sprint 3 |
|---|---|
| **Tests nuevos** | +25 |
| **Coverage roofing/** | >70% |
| **Líneas de código nuevas** | ~3,000 |
| **Archivos nuevos** | ~30 |
| **`any`s introducidos** | 0 |
| **Bugs en producción** | 0 |

---

## 💡 Decisiones técnicas clave

### 1. SKU como ID de documento
**Decisión:** `sku` es el ID en Firestore (no auto-generado).  
**Razón:** Búsquedas O(1) por SKU, integridad referencial natural.

### 2. Catálogo separado de Stock
**Decisión:** `roofing_catalog` y `roofing_stock` son colecciones separadas.  
**Razón:** Cambios de stock no rewritean metadata. Más performance, menos contención.

### 3. Stock puede ir negativo
**Decisión:** No bloqueamos ventas por falta de stock.  
**Razón:** Decisión de negocio explícita. Sistema confía en el operario.

### 4. Soft delete en catálogo
**Decisión:** `active: boolean` en lugar de borrar.  
**Razón:** Mantener histórico para reportes y auditoría.

### 5. Strategy pattern en ventas
**Decisión:** Cada línea expone su `StockStrategy`.  
**Razón:** Agregar línea 3, 4, 5 = solo registrar nueva strategy.

---

## 📞 Daily check

Marca ✅ las tareas completadas:
- [x] Tarea 3.1 - Estructura base
- [x] Tarea 3.2 - Schema escalable
- [x] Tarea 3.3 - Catalog service
- [x] Tarea 3.4 - UI catálogo
- [x] Tarea 3.5 - Inventario
- [x] Tarea 3.6 - Ventas multi-línea
- [x] Tarea 3.7 - Integración
- [x] Tarea 3.8 - Tests
- [x] Tarea 3.9 - Documentación
