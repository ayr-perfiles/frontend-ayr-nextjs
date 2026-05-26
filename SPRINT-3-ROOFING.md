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
Sprint 3 (Roofing - Ventas)  ░░░░░░░░░░░░░░░░░░░░   0% 🚧 ← ESTÁS AQUÍ
Sprint 4 (Roofing - Prod.)   ░░░░░░░░░░░░░░░░░░░░   0%
Sprint 5+ (Líneas 3-5)       ░░░░░░░░░░░░░░░░░░░░   0%
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
- [ ] Estructura completa creada
- [ ] `types.ts` con todos los tipos definidos
- [ ] `index.ts` con BusinessLineModule implementado (productionEngine como stub)
- [ ] `README.md` documentando el módulo
- [ ] `schemas/catalog.ts` con Zod schema
- [ ] Build pasa

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
- [ ] `schemas/catalog.ts` con Zod schema completo
- [ ] Función `generateSKU` implementada
- [ ] Tests con coverage >85%
- [ ] Validaciones documentadas

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
- [ ] `catalogService.ts` con CRUD completo
- [ ] Función `seedInitialCatalog` para los 4 SKUs base
- [ ] `useRoofingCatalog` hook
- [ ] Tests con coverage >70%
- [ ] Audit logs en cada operación

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
- [ ] Página `/admin/roofing/catalog`
- [ ] `ProductCatalogTable.tsx`
- [ ] `AddProductModal.tsx` con auto-generación de SKU
- [ ] `EditProductModal.tsx`
- [ ] Validación frontend + toast notifications
- [ ] RBAC correctamente implementado

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
- [ ] `inventoryService.ts` con queries optimizadas
- [ ] `stockAdjustmentService.ts` con transacciones
- [ ] `InventoryTable.tsx` con stock negativo destacado
- [ ] `StockAdjustmentModal.tsx`
- [ ] `MovementsHistoryModal.tsx`
- [ ] Página `/admin/roofing/inventory`
- [ ] Hooks: `useRoofingInventory`, `useStockMovements`

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
- [ ] `salesService` adaptado para multi-línea
- [ ] Strategy pattern para stock por línea
- [ ] `ProductSelector` multi-línea con tabs
- [ ] Página nueva venta acepta productos de ambas líneas
- [ ] Stock negativo permitido con warning visual
- [ ] Listado de ventas con filtro por línea
- [ ] Tests de integración del flujo completo

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
- [ ] Módulo registrado en businessLineRegistry
- [ ] Selector muestra "Coberturas PVC"
- [ ] Sidebar se actualiza al cambiar línea
- [ ] Página/botón para seed inicial
- [ ] 4 SKUs iniciales cargados

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
- [ ] 4 SKUs PVC creados en catálogo
- [ ] CRUD del catálogo funciona end-to-end
- [ ] Inventario PVC muestra stock correctamente
- [ ] Stock puede ir negativo
- [ ] Ajustes manuales de stock funcionan
- [ ] Se pueden vender productos PVC junto con drywall en una venta
- [ ] Selector de línea cambia contexto correctamente

**Técnico:**
- [ ] Module pattern respetado (sin lógica drywall en roofing)
- [ ] Strategy pattern aplicado en módulo de ventas
- [ ] Transacciones correctas (lecturas-escrituras)
- [ ] Coverage >70% en módulo roofing
- [ ] 0 nuevos `any`s
- [ ] CI pasa

**Seguridad:**
- [ ] Firestore rules cubren nuevas colecciones
- [ ] RBAC funciona en `/admin/roofing/*`
- [ ] Audit logs en operaciones sensibles

**Documentación:**
- [ ] ADR-004 escrito
- [ ] README de roofing
- [ ] Glosario actualizado en CLAUDE.md

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
- [ ] Tarea 3.1 - Estructura base
- [ ] Tarea 3.2 - Schema escalable
- [ ] Tarea 3.3 - Catalog service
- [ ] Tarea 3.4 - UI catálogo
- [ ] Tarea 3.5 - Inventario
- [ ] Tarea 3.6 - Ventas multi-línea
- [ ] Tarea 3.7 - Integración
- [ ] Tarea 3.8 - Tests
- [ ] Tarea 3.9 - Documentación
