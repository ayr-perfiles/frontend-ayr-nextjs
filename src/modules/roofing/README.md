# Módulo: Roofing (Coberturas PVC)

Línea de negocio: Venta de planchas PVC (TC5 UPVC) para coberturas.

**Estado:** Sprint 3 — Inventario y Ventas  
**Producción:** Sprint 4 (proceso de entrada de mercadería)

**Proceso:**
1. Compra directa de planchas PVC al proveedor
2. Entrada a stock (costo promedio ponderado)
3. Venta y descuento de stock
4. *(Sprint 4)* Proceso de recepción formal y trazabilidad

**SKU format:** `[MATERIAL][LARGO]MT[COLOR?]`  
Ejemplos: `UPVC6MT` (rojo default), `UPVC36MTAZUL`, `UPVC48MTVERDE`  
Generado con `generateSKU()` en `domain/skuGenerator.ts` (Sprint 3).

**Estructura:**
- `components/catalog/` — UI para gestionar catálogo de productos PVC
- `components/inventory/` — UI de stock (entradas, ajustes, listado)
- `components/sales/` — UI de ventas rápidas PVC
- `services/` — acceso a Firebase (catalogService, inventoryService)
- `domain/` — lógica pura (skuGenerator, pricing)
- `hooks/` — custom hooks (useRoofingCatalog, useRoofingStock)
- `engines/` — contratos de inventario (real) y producción (stub hasta Sprint 4)
- `schemas/` — Zod schemas de validación
- `config/` — sidebar items y permisos por rol

**Colecciones Firestore:**
- `roofing_catalog` — productos (doc ID = SKU)
- `roofing_stock` — stock actual por SKU
- `roofing_stock_movements` — historial de movimientos

⚠️ Si algo es compartido con otras líneas → muévelo a `core/`  
⚠️ Stock negativo permitido — es decisión de negocio (ADR-005)
