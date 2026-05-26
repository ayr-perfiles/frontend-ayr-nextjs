# CLAUDE.md — Guía para agentes de IA en el proyecto AYR Steel ERP

> **Actualizado:** Inicio Sprint 3 (Mayo 2026)  
> Este archivo le dice a Claude Code (o cualquier agente) **cómo trabajar en este repo sin romper la integridad transaccional, la seguridad ni las convenciones de dominio**. Léelo antes de cualquier cambio.

---

## 1. Contexto del producto

ERP privado de una empresa que vende productos derivados del acero **Y** ahora también de PVC. Diversificación reciente: la empresa empezó con acero (drywall) y ahora amplía a coberturas PVC.

**5 líneas de negocio planificadas:**

1. ✅ **Drywall** (acero) — Perfilería para tabiquería seca
2. 🚧 **Roofing** (PVC, posiblemente metálicas) — Coberturas
3. 🔜 Por definir
4. 🔜 Por definir
5. 🔜 Por definir

**Usuarios:** Operario (planta), Supervisor, Comercial, Admin, Gerencia.

---

## 2. Stack y comandos

| Capa       | Tecnología                                                 |
| ---------- | ---------------------------------------------------------- |
| Frontend   | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 |
| Backend    | Firebase (Auth, Firestore, Storage, Functions)             |
| Búsqueda   | Algolia                                                    |
| UI/UX      | lucide-react, react-hot-toast, nextjs-toploader, recharts  |
| Datos      | xlsx, react-to-print                                       |
| Testing    | Vitest, @testing-library/react                             |
| Validación | Zod                                                        |

```bash
npm run dev              # Frontend en :3000
npm run emulators        # Firebase emulator suite
npm run emulate          # Ambos a la vez (recomendado en dev)
npm run build            # Build de producción
npm run lint             # ESLint
npm run test             # Vitest
npm run test:watch       # Tests en modo watch
npm run test:coverage    # Coverage report
```

---

## 3. Arquitectura modular (ACTUALIZADO Sprint 3)

```
src/
├── core/                     # COMPARTIDO entre líneas
│   ├── auth/
│   ├── crm/                  # Clientes (transversal)
│   ├── audit/
│   ├── settings/
│   ├── kardex/               # Movimientos contables transversales
│   ├── reports/
│   ├── dashboard/
│   ├── sales/                # ← AMPLIADO: ahora multi-línea
│   │   ├── services/
│   │   ├── components/
│   │   └── strategies/       # ← NUEVO: una por línea
│   ├── contracts/            # BusinessLineModule, ProductionEngine, etc.
│   └── registry/             # ← NUEVO: registro central de módulos
│
├── domain/                   # Lógica pura sin Firebase
│   ├── shared/               # Money, Weight, Sku, Result<T,E>
│   ├── pricing/              # IGV, márgenes, conversión PEN/USD
│   └── steel/                # Constantes y fórmulas siderúrgicas
│
├── modules/                  # Líneas de negocio
│   ├── drywall/              # ✅ Activa (acero)
│   ├── roofing/              # 🚧 En desarrollo (PVC)
│   │   ├── components/
│   │   ├── services/
│   │   ├── domain/
│   │   ├── hooks/
│   │   ├── engines/          # Implementa contratos
│   │   ├── schemas/          # Zod schemas
│   │   ├── config/
│   │   ├── types.ts
│   │   └── index.ts          # Export BusinessLineModule
│   ├── linea3/               # 🔜
│   ├── linea4/               # 🔜
│   └── linea5/               # 🔜
│
├── app/
│   ├── admin/
│   │   ├── (core)/           # Rutas compartidas
│   │   ├── drywall/
│   │   ├── roofing/          # ← NUEVO
│   │   └── sales/            # Ventas multi-línea
│   └── api/
│
├── lib/                      # Adaptadores: firebase, algolia
└── types/                    # Solo tipos globales
```

**Antes de crear archivos nuevos:** ubica si pertenecen a `core/`, `domain/` o a un módulo específico. **Nunca pongas lógica de drywall en `core/`, ni lógica de roofing en `drywall/`.**

---

## 4. Reglas no negociables

### 🔴 Integridad transaccional

- **Todo cambio que afecte stock, kardex, ventas o producción DEBE ir dentro de `runTransaction`.**
- Patrón obligatorio: **PRIMERO todas las lecturas, DESPUÉS todas las escrituras**.
- Si una operación toca >1 documento, usa transacción o `writeBatch`.
- Audit_logs doc en la misma transacción para operaciones sensibles.

### 🔴 Multi-línea en ventas

- **Una venta puede contener items de múltiples líneas.**
- Cada `SaleItem` tiene `businessLine: 'drywall' | 'roofing' | ...`
- Usa `getStockStrategy(item.businessLine)` para operar sobre stock correcto.
- Una sola transacción aunque haya múltiples líneas.

### 🔴 Stock negativo permitido

- **NO bloquees ventas por falta de stock.** Es decisión de negocio.
- Aplica a TODAS las líneas (drywall, roofing, futuras).
- Muestra **warning visual** en UI: "Stock insuficiente, generará negativo".
- Decisión documentada en ADR-005.

### 🔴 Seguridad (custom claims)

- **NUNCA hagas más permisivas las rules "para que pase".**
- Custom claims en `request.auth.token.role` (ADMIN, SUPERVISOR, OPERATOR).
- Permisos en 3 lugares sincronizados: layout, firestore.rules, middleware.

### 🔴 Tipado

- **No introduzcas `any` nuevos.** Usa `unknown` + guard o define tipos.
- Estado actual: 47 any's en el proyecto (objetivo: <20).

### 🟠 Servicios

- Cada módulo tiene su propio `*Service.ts`. No mezcles dominios.
- Recibir tipos explícitos, devolver `Promise<Result>` o `throw Error("mensaje español")`.
- Loguear errores con contexto suficiente.

### 🟢 Testing

- Dominio puro: Coverage >80% obligatorio.
- Servicios: Tests de integración con mock Firebase.
- Archivos `.test.ts` junto al archivo que testean.
- Correr `npm run test` antes de cada commit.

---

## 5. Glosario de dominio (ACTUALIZADO Sprint 3)

### Drywall (acero)

| Término                    | Significado                   | En código                              |
| -------------------------- | ----------------------------- | -------------------------------------- |
| **Bobina madre**           | Rollo de acero del proveedor  | `Coil`                                 |
| **Fleje**                  | Tira longitudinal del slitter | `PlannedStrip`                         |
| **Slitter**                | Cortadora longitudinal        | (fase 1)                               |
| **Conformadora**           | Da forma al perfil            | (fase 2)                               |
| **Parante / Riel / Omega** | Productos drywall             | SKUs P38, P64, P89, R39, R65, R90, OMG |

### Roofing (PVC) — NUEVO Sprint 3

| Término      | Significado                 | En código                       |
| ------------ | --------------------------- | ------------------------------- |
| **Plancha**  | Unidad de venta de PVC      | `RoofingProduct`, unit: 'PIEZA' |
| **TC5**      | Modelo de plancha (5 ondas) | `family` en catálogo            |
| **UPVC**     | PVC sin plastificantes      | `material` en catálogo          |
| **Catálogo** | Productos PVC vendibles     | colección `roofing_catalog`     |

### Genérico (transversal)

| Término            | Significado          | En código                       |
| ------------------ | -------------------- | ------------------------------- |
| **Kardex**         | Libro de movimientos | colección `kardex_movements`    |
| **Stock Movement** | Cambio de stock      | colecciones `*_stock_movements` |
| **BusinessLine**   | Línea de negocio     | id: 'drywall', 'roofing', ...   |

**Convención de idioma:**

- **UI y mensajes de error → español** (es-PE).
- **Identificadores, tipos, funciones → inglés.**

---

## 6. Convenciones de SKU por línea (NUEVO Sprint 3)

### Drywall

- Formato: 1-3 letras (categoría) + número (medida)
- Ejemplos: P38, P64, R39, OMG

### Roofing (PVC)

- Formato: `[MATERIAL][LARGO]MT[COLOR si no es default]`
- Material: `UPVC` (por ahora único)
- Largo: sin punto decimal (6.00 → "6", 3.60 → "36")
- Color: omitir si es ROJO (default), agregar si es otro
- Ejemplos:
  - UPVC, 6.0m, ROJO → `UPVC6MT`
  - UPVC, 3.6m, AZUL → `UPVC36MTAZUL`
  - UPVC, 4.8m, VERDE → `UPVC48MTVERDE`

**El SKU se autogenera con `generateSKU()` en `modules/roofing/domain/skuGenerator.ts`.**

---

## 7. Fórmulas críticas

### Drywall (siderúrgicas)

```ts
import {
  STEEL_DENSITY_G_CM3,
  PRODUCTION_TOLERANCE_FACTOR,
  LEFTOVER_THRESHOLD_MM,
} from "@/domain/steel/constants";

// Piezas máximas por densidad
const totalMeters =
  weightKg / (thicknessMm * widthMm * (STEEL_DENSITY_G_CM3 / 1000));
const expectedPieces = Math.floor(totalMeters / pieceLengthM);

// Costo efectivo por mm
const effectiveCostPerMm =
  leftover <= LEFTOVER_THRESHOLD_MM && leftover > 0
    ? totalCost / totalPlannedWidth
    : totalCost / coil.masterWidth;
```

### Roofing (NUEVO Sprint 3)

```ts
// Costo promedio ponderado al ingresar entrada
newAvgCost =
  (currentQty * currentAvgCost + newQty * newCost) / (currentQty + newQty);

// Precio de venta sugerido (margen configurable)
const suggestedPrice = avgCost * (1 + MARGIN_FACTOR) * (1 + IGV_RATE);

// Validación de existencia de combinación única
const isDuplicate = await checkUniqueCombination({
  material,
  color,
  thickness,
  width,
  length,
});
```

---

## 8. Patrón de BusinessLineModule

Cada línea debe implementar:

```typescript
import { BusinessLineModule } from "@/core/contracts";

export const roofingModule: BusinessLineModule = {
  id: "roofing",
  displayName: "Coberturas PVC",
  icon: "Home",

  productionEngine: roofingProductionEngine, // Stub hasta Sprint 4
  inventoryEngine: roofingInventoryEngine,
  catalogSchema: RoofingProductSchema,

  routes: roofingRoutes,
  sidebarItems: roofingSidebarItems,
  permissions: roofingPermissions,
};
```

**Ver:** `modules/drywall/index.ts` como referencia completa.

---

## 9. Strategy Pattern para Stock (NUEVO Sprint 3)

Cuando proceses una venta, NO codifiques la línea — usa la strategy:

```typescript
// ❌ NO hagas esto:
if (item.businessLine === "drywall") {
  await updateDrywallStock(item);
} else if (item.businessLine === "roofing") {
  await updateRoofingStock(item);
}

// ✅ Hazlo así:
const strategy = getStockStrategy(item.businessLine);
strategy.decrementStock(item.sku, item.quantity, transaction);
```

**Implementaciones:** `core/sales/strategies/`

---

## 10. Trampas conocidas

1. **Firestore no permite `where("status", "in")` + filtros de rango juntos.** Workaround en inventoryService.
2. **Algolia trae IDs pero datos desactualizados.** Siempre hidratar con getDocs.
3. **`metadata.invoiceDate`** requiere índice compuesto en firestore.indexes.json.
4. **`runTransaction` reintenta automáticamente.** No metas side effects no idempotentes adentro.
5. **Cloud Functions deployed:** getNextSaleNumber, onSaleCreated, onCoilCreated, onProductionLogCreated, healthCheck.
6. **Custom claims no se refrescan en token activo.** Usar `auth.currentUser.getIdToken(true)`.
7. **(NUEVO) Stock negativo permitido en todas las líneas.** Es feature, no bug.
8. **(NUEVO) En multi-línea sales: validar businessLine en CADA item.** No asumas.
9. **(NUEVO) SKU es el ID del documento en catálogo.** No auto-generes IDs separados.

---

## 11. Cuándo pedir confirmación humana

Detente y pregunta antes de:

- Modificar `firestore.rules` o `storage.rules`.
- Cambiar constantes físicas (densidad, tolerancias, IGV).
- Borrar o renombrar colecciones de Firestore.
- Ejecutar `resetDatabaseDevOnly` o scripts seed.
- Cambiar el contrato de `BusinessLineModule` (impacta a TODAS las líneas).
- Tocar la transacción de `processSale` (zona muy caliente — afecta todas las líneas).
- Eliminar tests existentes.
- Cambiar la convención de SKUs.

---

## 12. Roadmap

1. ✅ Sprint 0: Base estabilizada
2. ✅ Sprint 1: Drywall refactorizado + seguridad
3. ✅ Sprint 2: Template modular + selector línea negocio
4. 🚧 Sprint 3: **Roofing PVC — Ventas e Inventario**
5. 🔜 Sprint 4: Roofing PVC — Proceso de producción
6. 🔜 Sprint 5+: Líneas 3, 4, 5

---

## 13. Antes de cerrar tu turno

Verifica:

- [ ] ¿Toqué transacciones? → ¿Lecturas antes que escrituras?
- [ ] ¿Toqué seguridad? → ¿Reglas + RBAC + middleware alineados?
- [ ] ¿Introduje `any`? → Quítalo o justifícalo.
- [ ] ¿Multi-línea? → ¿Usé Strategy Pattern en lugar de if/else por línea?
- [ ] ¿Stock? → ¿Permití negativo con warning visual?
- [ ] ¿Funciona en emulator antes de prod?
- [ ] ¿Audit log para operación sensible?
- [ ] ¿Textos de error en español?
- [ ] ¿Archivo más limpio que como lo encontré?
- [ ] ¿`npm run test` pasa?
- [ ] ¿Tests actualizados si cambié comportamiento?

---

## 14. Aprendizajes acumulados (Post Sprint 0-2)

### Técnicos

- Custom claims + Firestore rules = RBAC robusto
- Dominio puro = tests confiables (84% coverage drywall/domain)
- Custom hooks = eliminar duplicación masiva
- BusinessLineModule = escalabilidad real para N líneas
- Strategy Pattern = ventas agnósticas a la línea

### Proceso

- Sprints de 2 semanas = ritmo sostenible
- Docs al mismo tiempo que código = sin deuda
- ADRs = decisiones explicadas para el futuro
- Tests primero en dominio = confianza al refactorizar

### Próximos desafíos

- Reportes consolidados multi-línea
- Búsqueda unificada de productos (drywall + roofing + futuras)
- Dashboard que cruce líneas
- Permisos diferenciados por línea (¿operario solo de su línea?)

---

**Versión:** 3.0 (Inicio Sprint 3)  
**Última actualización:** Mayo 2026  
**Próxima revisión:** Cierre Sprint 3
