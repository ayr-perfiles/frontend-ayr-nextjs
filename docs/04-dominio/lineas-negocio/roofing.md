# Línea de Negocio: Roofing (Coberturas PVC)

> **Módulo:** `src/modules/roofing/`  
> **Sprint:** 3 (Mayo 2026)  
> **Estado:** 🚧 En desarrollo
> ⚠️ **Corrección puntual 2026-08-28 (`[DOCS-STALE-SWEEP]` PASO 3):** solo las secciones "Stock" y "Strategy de venta" — los 2 nombres de archivo que citaba la versión anterior de esta página nunca existieron en el repo (ver esas secciones para los nombres reales). Resto del doc SIN re-verificar desde Sprint 3.

---

## 1. Descripción del negocio

La empresa vende planchas de cobertura UPVC (PVC sin plastificantes) para techado. A diferencia de drywall, **no hay proceso de transformación productiva en esta línea**: los productos se compran terminados al proveedor y se venden directamente.

El flujo es:
```
Proveedor → Entrada a stock → Venta → Cliente
```

No hay slitter, no hay conformadora, no hay producción por bobinas. El módulo de producción es un **stub** hasta Sprint 4 (cuando se decida si hay corte a medida u otro proceso).

---

## 2. Producto: Plancha TC5 UPVC

El único producto activo en Sprint 3 es la **Plancha TC5** (5 ondas), fabricada en UPVC.

| Atributo      | Valores disponibles         | Unidad  |
|---------------|-----------------------------|---------|
| Material      | UPVC                        | —       |
| Modelo        | TC5 (5 ondas)               | —       |
| Largo         | 3.60 m, 6.00 m              | metros  |
| Color         | Rojo (default), Azul        | —       |
| Unidad venta  | PIEZA                       | pieza   |

### SKU

Los SKUs se autogeneran con `generateSKU()` en `modules/roofing/domain/skuGenerator.ts`:

```
Formato: [MATERIAL][LARGO_SIN_PUNTO]MT[COLOR_si_no_es_ROJO]

Ejemplos:
  UPVC + 6.00m + Rojo  →  UPVC6MT
  UPVC + 3.60m + Azul  →  UPVC36MTAZUL
  UPVC + 4.80m + Verde →  UPVC48MTVERDE
```

El color ROJO es el default y se omite del SKU. Cualquier otro color se concatena al final.

> **Regla:** El SKU es el ID del documento en `roofing_catalog`. No hay campo `id` separado.

---

## 3. Colecciones Firestore

### `roofing_catalog/{sku}`

Catálogo de productos disponibles para vender. Solo ADMIN puede crear/actualizar.

```typescript
{
  sku: string;           // = document ID
  name: string;
  material: string;      // "UPVC"
  family: string;        // "TC5"
  color: string;         // "ROJO" | "AZUL" | ...
  length: number;        // 3.6 | 6.0
  unit: "PIEZA";
  isActive: boolean;
  createdAt: Timestamp;
  createdBy: string;     // email del usuario
}
```

### `roofing_stock/{sku}`

Un documento por SKU. Mantiene cantidad actual y costo promedio ponderado.

```typescript
{
  sku: string;
  quantity: number;        // puede ser negativo (ADR-005)
  avgCost: number;         // costo promedio ponderado en PEN
  totalValue: number;      // quantity * avgCost
  lastUpdated: Timestamp;
}
```

### `roofing_stock_movements/{movementId}`

Registro inmutable de cada movimiento. No se actualiza ni elimina nunca.

```typescript
{
  sku: string;
  type: "ENTRADA" | "SALIDA" | "AJUSTE";
  quantity: number;        // positivo siempre; type indica dirección
  unitCost: number;        // costo por pieza en ese movimiento
  previousQty: number;
  newQty: number;
  previousAvgCost: number;
  newAvgCost: number;
  reference?: string;      // ID de venta si viene de processSale
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
}
```

---

## 4. Reglas de Firestore

```javascript
// Catálogo de roofing
match /roofing_catalog/{sku} {
  allow read: if isAuthenticated();
  allow create, update: if isAdmin();
  allow delete: if false;  // Solo soft delete via update isActive=false
}

// Stock de roofing
match /roofing_stock/{sku} {
  allow read: if isAuthenticated();
  allow write: if isSupervisor() || isAdmin();
}

// Movimientos de stock
match /roofing_stock_movements/{movementId} {
  allow read: if isAuthenticated();
  allow create: if isSupervisor() || isAdmin();
  allow update, delete: if false;  // Inmutable
}
```

---

## 5. Servicios del módulo

### `catalogService.ts`

| Función               | Rol mínimo  | Descripción                                          |
|-----------------------|-------------|------------------------------------------------------|
| `createProduct`       | ADMIN       | Crea SKU en catálogo. Valida unicidad de combinación |
| `listProducts`        | AUTH        | Lista todos los productos activos                    |
| `updateProduct`       | ADMIN       | Actualiza campos del producto                        |
| `seedInitialCatalog`  | ADMIN       | Crea los 4 SKUs base si el catálogo está vacío      |

> `createProduct` usa `runTransaction` con `where('_combinationKey', '==', comboKey)` para validar que no exista la misma combinación material+color+largo antes de insertar.

### Stock (⚠️ corregido `[DOCS-STALE-SWEEP]` PASO 3, v6.74.0 — `stockService.ts` NUNCA existió con ese nombre; las 2 funciones de esta sección viven en 2 archivos reales distintos)

| Función        | Archivo real                                                | Rol mínimo  | Descripción                                                   |
|----------------|--------------------------------------------------------------|-------------|-----------------------------------------------------------------|
| `adjustStock`  | `src/modules/roofing/services/stockAdjustmentService.ts`     | SUPERVISOR  | ENTRADA / SALIDA / AJUSTE manual. Recalcula avgCost en ENTRADA |
| `getStock`     | `src/modules/roofing/services/inventoryService.ts`           | AUTH        | Devuelve snapshot de `roofing_stock/{sku}`                    |

> El costo promedio ponderado **solo se recalcula en ENTRADA**. EXIT y AJUSTE no modifican `avgCost`. Ver fórmula en `docs/05-formulas/costeo-pvc.md` (esa ficha ya tiene su propio banner de corrección para el mismo nombre fantasma, desde 2026-07-07).

### Strategy de venta (⚠️ corregido `[DOCS-STALE-SWEEP]` PASO 3 — `roofingSaleStrategy.ts` nunca existió como archivo separado)

Implementado dentro de `getStockStrategy('roofing')`, en `src/core/sales/strategies/index.ts` (factory única, línea ~576) — la arquitectura real consolidó TODAS las strategies por línea en un solo archivo desde el principio, nunca hubo un archivo por línea. Es invocado por `processSale` cuando `item.businessLine === 'roofing'`.

```typescript
const strategy = getStockStrategy('roofing');
strategy.decrementStock(sku, qty, transaction);
```

---

## 6. Integración con ventas multi-línea

Una venta puede mezclar items de drywall y roofing. Ver [ADR-004](../../adr/ADR-004-multilinea-strategy-pattern.md).

```typescript
// Ejemplo de SaleItem con businessLine
{
  sku: "UPVC6MT",
  name: "Plancha TC5 UPVC 6.0m Rojo",
  quantity: 10,
  unitPrice: 45.00,
  businessLine: "roofing",   // ← distingue la estrategia de stock
}
```

La estrategia de roofing opera sobre `roofing_stock` y escribe en `roofing_stock_movements`. La estrategia de drywall opera sobre `inventory_stock` y `kardex_movements`. **Nunca se mezclan colecciones.**

---

## 7. Stock negativo (ADR-005)

El stock de roofing **puede ir negativo**. No se bloquea la venta cuando `quantity < qty_vendida`. La UI muestra un warning visual pero permite continuar.

Esto es una **decisión de negocio documentada en ADR-005**: la empresa prefiere registrar la venta y comprometer la entrega futura antes de perder el pedido.

---

## 8. RBAC en rutas `/admin/roofing/*`

| Ruta                          | Roles permitidos            |
|-------------------------------|-----------------------------|
| `/admin/roofing/catalog`      | ADMIN, SUPERVISOR           |
| `/admin/roofing/inventory`    | ADMIN, SUPERVISOR           |
| `/admin/roofing/adjustments`  | ADMIN, SUPERVISOR           |

Los OPERATOR no acceden a rutas de roofing (a diferencia de drywall donde tienen terminal móvil). Definido en `ROUTE_PERMISSIONS` en `src/app/admin/layout.tsx`.

---

## 9. Audit logs

Las operaciones sensibles escriben a `audit_logs` dentro de la misma transacción:

| Acción                    | Quién la dispara        |
|---------------------------|-------------------------|
| `CREATE_ROOFING_PRODUCT`  | `createProduct`         |
| `ADJUST_ROOFING_STOCK`    | `adjustStock`           |
| `SALE_ROOFING_ITEM`       | `processSale` (via strategy) |

Cada log incluye: `action`, `userEmail`, `timestamp`, `details` (delta legible, ej: `"[ENTRY] +10 0→10"`).

---

## 10. Seed inicial

`seedInitialCatalog()` en `catalogService.ts` crea los 4 SKUs base si el catálogo está vacío:

| SKU           | Descripción               |
|---------------|---------------------------|
| `UPVC6MT`     | Plancha TC5 6.0m Rojo     |
| `UPVC36MT`    | Plancha TC5 3.6m Rojo     |
| `UPVC6MTAZUL` | Plancha TC5 6.0m Azul     |
| `UPVC36MTAZUL`| Plancha TC5 3.6m Azul     |

El botón "Inicializar Catálogo PVC" en `/admin/setup` llama a esta función. Solo visible si el catálogo está vacío.

---

## 11. DoD Sprint 3

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
- [ ] Transacciones correctas (lecturas antes que escrituras)
- [ ] Coverage >70% en módulo roofing
- [ ] 0 nuevos `any`s
- [ ] CI pasa

**Seguridad:**
- [ ] Firestore rules cubren nuevas colecciones
- [ ] RBAC funciona en `/admin/roofing/*`
- [ ] Audit logs en operaciones sensibles

**Documentación:**
- [x] ADR-004 escrito
- [x] README de roofing (`docs/04-dominio/lineas-negocio/roofing.md`)
- [ ] Glosario actualizado en CLAUDE.md

---

## Referencias

- [ADR-004 — Multi-línea Strategy Pattern](../../adr/ADR-004-multilinea-strategy-pattern.md)
- [ADR-005 — Stock negativo permitido](../../adr/ADR-005-stock-negativo.md)
- [Fórmulas de costeo PVC](../../05-formulas/costeo-pvc.md)
- [Guía nueva línea de negocio](NUEVA-LINEA.md)
- `src/modules/roofing/` — código fuente del módulo
