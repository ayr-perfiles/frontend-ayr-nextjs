# Patch — `src/core/contracts/BusinessLineModule.ts`

Hacer `productionEngine` e `inventoryEngine` OPCIONALES para soportar líneas que
no producen (`trading`) ni inventarían (`services`), y para permitir registrar
`metallic-roofing` v1 sin motor de producción.

## Cambio en la interfaz

```diff
 export interface BusinessLineModule {
   id: string;
   displayName: string;
   icon: string;

-  /** Motor de producción específico de esta línea */
-  productionEngine: ProductionEngine;
+  /** Motor de producción. OPCIONAL: líneas de reventa/servicio o aún sin producción lo omiten. */
+  productionEngine?: ProductionEngine;

-  /** Motor de inventario (cómo se ve el stock) */
-  inventoryEngine: InventoryEngine;
+  /** Motor de inventario. OPCIONAL: `services` (sin stock) lo omite. */
+  inventoryEngine?: InventoryEngine;

   catalogSchema: z.ZodSchema;
   routes: RouteConfig[];
   sidebarItems: MenuItem[];
   permissions: RolePermissionMap;
 }
```

## Consumidores a blindar (null-check)

Buscar usos de `.productionEngine` / `.inventoryEngine` sobre un `BusinessLineModule`
y guardarlos:

```ts
const inv = module.inventoryEngine;
if (!inv) {
  // esta línea no maneja stock (p.ej. services) → ocultar tab inventario
  return null;
}
const view = await inv.getInventoryView(filters);
```

```ts
if (!module.productionEngine) {
  // ocultar/disable la sección de producción para esta línea
}
```

> Nota: `catalogSchema`, `routes`, `sidebarItems` y `permissions` siguen siendo
> OBLIGATORIOS — toda línea tiene catálogo, rutas, sidebar y permisos.
