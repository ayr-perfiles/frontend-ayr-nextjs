# ADR-004: Multi-línea en módulo de ventas (Strategy Pattern)

> ⚠️ **SUPERSEDED en su detalle de implementación (2026-07):** la DECISIÓN (Strategy Pattern por línea) sigue vigente, pero la interfaz documentada abajo es histórica. La interfaz VIVA es `StockStrategy` de **6 métodos** (`getStockRef`, `extractQuantity`, `extractAvgCost`, `writeSaleDecrement`, `writeSaleReversal`, `writeProductionIncrement`) con **5 líneas registradas** (drywall, roofing, metallic-roofing, trading, services NO-OP), todas en **un solo archivo**: `src/core/sales/strategies/index.ts:42-54` (factory en `:576`). No usar los snippets de este ADR como referencia de código. Estado real de excepciones al patrón: `docs/03-arquitectura/patrones-y-convenciones.md` §1.

**Estado:** Aceptada (decisión) / Superseded (detalle de interfaz — ver banner)  
**Fecha:** 2026-05-15  
**Decisores:** Equipo AYR Steel  
**Sprint:** 3

---

## Contexto y problema

Al incorporar Roofing PVC como segunda línea de negocio, el módulo de ventas (`processSale` en `core/sales/`) necesitaba actualizar stock al registrar una venta. En Sprint 1–2, `processSale` solo existía para drywall y accedía directamente a `inventory_stock` y `kardex_movements`.

**El problema:** una venta ahora puede contener items de múltiples líneas de negocio simultáneamente. Por ejemplo, un cliente puede comprar parantes de drywall y planchas PVC en el mismo pedido, generando una sola factura.

Restricciones:
- Cada línea tiene sus propias colecciones de stock (`inventory_stock` vs `roofing_stock`).
- Toda la venta debe procesarse en **una sola transacción Firestore** (regla no negociable de integridad transaccional).
- Se planifican 3–4 líneas adicionales en sprints futuros; no podemos acumular `if/else` indefinidamente.
- El código de una línea **no debe acoplarse** al código de otra.

---

## Opciones consideradas

### Opción 1: Condicional por línea dentro de `processSale`

**Descripción:** Dentro del loop de items de venta, verificar `item.businessLine` con `if/else` o `switch` y llamar a la función correspondiente.

```typescript
// ❌ Lo que NO se hizo
for (const item of saleItems) {
  if (item.businessLine === 'drywall') {
    await updateDrywallStock(item, transaction);
  } else if (item.businessLine === 'roofing') {
    await updateRoofingStock(item, transaction);
  }
}
```

**Pros:**
- ✅ Simple de entender para alguien nuevo en el código
- ✅ Sin abstracción adicional

**Contras:**
- ❌ Cada nueva línea requiere modificar `processSale` (violación Open/Closed)
- ❌ `processSale` importa módulos de todas las líneas → acoplamiento fuerte
- ❌ A 5 líneas el archivo se vuelve inmantenible
- ❌ Tests de drywall y roofing quedan entrelazados

**Impacto en:**
- Complejidad de implementación: Baja (inicial)
- Mantenibilidad: Baja (a futuro)
- Escalabilidad: Mala

---

### Opción 2: Strategy Pattern — una implementación por línea

**Descripción:** Definir una interfaz `StockStrategy` con un método `decrementStock`. Cada línea implementa su propia versión. Un registro central (`getStockStrategy`) resuelve la implementación según `businessLine`.

```typescript
// ✅ Lo que se implementó
interface StockStrategy {
  decrementStock(sku: string, qty: number, transaction: Transaction): void;
}

// core/sales/strategies/drywallStockStrategy.ts  → opera sobre inventory_stock
// core/sales/strategies/roofingStockStrategy.ts  → opera sobre roofing_stock

function getStockStrategy(businessLine: BusinessLine): StockStrategy {
  const strategies: Record<BusinessLine, StockStrategy> = {
    drywall: drywallStockStrategy,
    roofing: roofingStockStrategy,
  };
  return strategies[businessLine];
}

// processSale — sin cambios para añadir nuevas líneas
for (const item of saleItems) {
  const strategy = getStockStrategy(item.businessLine);
  strategy.decrementStock(item.sku, item.quantity, transaction);
}
```

**Pros:**
- ✅ `processSale` no necesita cambios al agregar líneas nuevas
- ✅ Cada estrategia es un archivo pequeño e independiente
- ✅ Testeable de forma aislada
- ✅ Consistente con `BusinessLineModule` (mismo principio de encapsulamiento)

**Contras:**
- ❌ Un nivel de indirección más a entender inicialmente
- ❌ Requiere que el `SaleItem` siempre tenga `businessLine` (invariante a mantener)

**Impacto en:**
- Complejidad de implementación: Media
- Mantenibilidad: Alta
- Escalabilidad: Excelente

---

### Opción 3: Servicios de venta separados por línea

**Descripción:** Crear `drywallSaleService.ts` y `roofingSaleService.ts` con su propio `processSale` completo.

**Pros:**
- ✅ Aislamiento total entre líneas

**Contras:**
- ❌ Duplicación masiva de lógica de venta (numeración, IGV, auditoría, Algolia)
- ❌ Una venta multi-línea requeriría orquestar dos transacciones separadas (imposible en Firestore sin 2PC)
- ❌ Inconsistencia garantizada entre líneas

**Impacto en:**
- Complejidad de implementación: Alta
- Mantenibilidad: Muy baja
- Escalabilidad: Mala

---

## Decisión

**Opción elegida:** Opción 2 — Strategy Pattern

**Justificación:**

1. **Una transacción por venta es innegociable.** Solo el Strategy Pattern permite que `processSale` itere sobre items de múltiples líneas y llame a la implementación correcta dentro de un único `runTransaction`, sin importar cuántas líneas haya.

2. **Open/Closed sobre `processSale`.** Agregar una línea nueva requiere solo: (a) crear `linea3StockStrategy.ts`, (b) registrarlo en el mapa de `getStockStrategy`. No tocar la función transaccional central.

3. **Consistencia arquitectónica.** El proyecto ya usa `BusinessLineModule` para encapsular comportamiento por línea. El Strategy Pattern es la extensión natural de ese mismo principio al flujo de ventas.

4. **La indirección es manejable.** Con TypeScript, el tipo `StockStrategy` hace explícito el contrato. El mapa en `getStockStrategy` es el único lugar donde se registran las implementaciones.

---

## Consecuencias

### Positivas ✅

- `processSale` escala a N líneas sin modificación
- Cada estrategia se puede testear con mocks independientes
- El acoplamiento entre módulos está limitado a `core/sales/strategies/` — los módulos no se importan entre sí
- Audit logs y lógica de venta (numeración, IGV) permanecen centralizados

### Negativas ⚠️

- Todo `SaleItem` **debe** tener `businessLine` correctamente asignado. Un item sin `businessLine` o con valor inválido lanza error en `getStockStrategy`. La UI de ventas debe validarlo.
- Si dos líneas comparten el mismo SKU (improbable pero posible), las snapshots de stock dentro de la transacción deben keyed como `"businessLine:sku"` para evitar colisiones. Esto está implementado en `processSale`.

### Neutrales 🔵

- El registro de estrategias (`getStockStrategy`) crece linealmente con el número de líneas. Con ≤10 líneas esto es completamente negligible.

---

## Implementación

### Estructura de archivos

```
src/core/sales/
├── services/
│   └── saleService.ts          ← processSale con Strategy Pattern
└── strategies/
    ├── index.ts                 ← getStockStrategy() + interfaz StockStrategy
    ├── drywallStockStrategy.ts  ← opera sobre inventory_stock / kardex_movements
    └── roofingStockStrategy.ts  ← opera sobre roofing_stock / roofing_stock_movements
```

### Contrato de la estrategia

```typescript
// core/sales/strategies/index.ts
export interface StockStrategy {
  decrementStock(
    sku: string,
    quantity: number,
    transaction: Transaction,
    stockSnapshot: DocumentData,
  ): void;
}

export function getStockStrategy(businessLine: BusinessLine): StockStrategy {
  const strategies: Record<BusinessLine, StockStrategy> = {
    drywall: drywallStockStrategy,
    roofing: roofingStockStrategy,
  };
  const strategy = strategies[businessLine];
  if (!strategy) {
    throw new Error(`Línea de negocio no soportada: ${businessLine}`);
  }
  return strategy;
}
```

### Patrón de reads-before-writes en la transacción

```typescript
// processSale — fase de lecturas
const stockSnapshots = new Map<string, DocumentData>();
for (const item of saleItems) {
  const key = `${item.businessLine}:${item.sku}`;
  const stockRef = getStockRef(item.businessLine, item.sku);
  const snap = await transaction.get(stockRef);
  stockSnapshots.set(key, snap.data() ?? { quantity: 0, avgCost: 0 });
}

// processSale — fase de escrituras
for (const item of saleItems) {
  const key = `${item.businessLine}:${item.sku}`;
  const strategy = getStockStrategy(item.businessLine);
  strategy.decrementStock(item.sku, item.quantity, transaction, stockSnapshots.get(key)!);
}
```

### Tareas técnicas completadas en Sprint 3

- [x] Definir interfaz `StockStrategy` en `core/sales/strategies/index.ts`
- [x] Implementar `drywallStockStrategy` (migración desde código inline)
- [x] Implementar `roofingStockStrategy` (nuevo en Sprint 3)
- [x] Actualizar `processSale` para iterar con `getStockStrategy`
- [x] Tests de integración del flujo completo en `roofingFlow.integration.test.ts`

### Para agregar una nueva línea (Sprint 4+)

1. Crear `src/core/sales/strategies/linea3StockStrategy.ts`
2. Agregar `linea3: linea3StockStrategy` al mapa en `getStockStrategy`
3. Agregar `'linea3'` al tipo `BusinessLine` en `src/core/contracts/`

No se toca `processSale`.

---

## Validación y revisión

**Fecha de revisión:** 2026-11-15 (tras incorporar 2 líneas más)

**Trigger para re-evaluar:**
- Si las estrategias requieren pre/post hooks complejos (ej: reservas, aprobaciones) → considerar Command Pattern
- Si el número de líneas supera 8 → evaluar registro dinámico en lugar de mapa estático

---

## Referencias

- [ADR-001 — Monorepo modularizado](ADR-001-monorepo-modularizado.md)
- [ADR-005 — Stock negativo permitido](ADR-005-stock-negativo.md)
- [Proceso de negocio Roofing](../04-dominio/lineas-negocio/roofing.md)
- [CLAUDE.md §9 — Strategy Pattern para Stock](../../CLAUDE.md)
- `src/core/sales/strategies/` — implementación
- `src/modules/roofing/services/roofingFlow.integration.test.ts` — tests de validación
