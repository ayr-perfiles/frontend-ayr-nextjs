# CLAUDE.md — AYR Steel ERP

> **Versión:** 4.0 | **Sprint actual:** Mejoras + UI (post Sprint 3)  
> Lee esto COMPLETO antes de cualquier cambio.

---

## 1. Contexto del producto

ERP de empresa que vende productos de **acero** y **PVC**. Diversificación activa.

**Líneas de negocio:**
| # | Módulo | Estado | Materia prima |
|---|---|---|---|
| 1 | `drywall` | ✅ Producción | Bobinas de acero |
| 2 | `roofing` | ✅ Ventas/Inventario | Planchas PVC |
| 3-5 | TBD | 🔜 | TBD |

**Usuarios:** ADMIN, SUPERVISOR, OPERATOR (custom claims en Firebase Auth)

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

## 3. Arquitectura

```
src/
├── core/                # Compartido entre TODAS las líneas
│   ├── auth/
│   ├── crm/
│   ├── audit/
│   ├── settings/
│   ├── kardex/
│   ├── reports/
│   ├── dashboard/
│   ├── sales/           # Ventas MULTI-LÍNEA
│   │   ├── services/
│   │   ├── components/  # ProductSelector con tabs por línea
│   │   └── strategies/  # StockStrategy por línea
│   ├── contracts/       # BusinessLineModule, ProductionEngine
│   └── registry/        # Registro central de módulos
│
├── domain/              # Lógica pura SIN Firebase
│   ├── steel/
│   ├── pricing/
│   └── shared/          # Result<T,E>
│
├── modules/
│   ├── drywall/         # ✅ Acero
│   └── roofing/         # ✅ PVC
│       ├── components/{catalog,inventory,sales}/
│       ├── services/
│       ├── domain/
│       ├── hooks/
│       ├── engines/
│       ├── schemas/
│       ├── config/
│       ├── types.ts
│       └── index.ts
│
└── app/admin/
    ├── (core)/
    ├── drywall/
    └── roofing/
```

---

## 4. Colecciones Firestore

| Colección                 | Línea   | Escritura                           |
| ------------------------- | ------- | ----------------------------------- |
| `coils`                   | drywall | ADMIN/SUPERVISOR                    |
| `production_logs`         | drywall | ANY create, ADMIN/SUPERVISOR update |
| `inventory_stock`         | drywall | ADMIN/SUPERVISOR ⚠️ TEMPORAL        |
| `kardex_movements`        | drywall | ADMIN/SUPERVISOR ⚠️ TEMPORAL        |
| `roofing_catalog`         | roofing | ADMIN                               |
| `roofing_stock`           | roofing | ADMIN/SUPERVISOR                    |
| `roofing_stock_movements` | roofing | ADMIN/SUPERVISOR create, inmutable  |
| `sales`                   | multi   | ADMIN/SUPERVISOR                    |
| `audit_logs`              | global  | ANY_ROLE ⚠️ TEMPORAL                |
| `customers/contacts`      | global  | ADMIN/SUPERVISOR                    |
| `settings/products`       | global  | ADMIN                               |

⚠️ TEMPORAL = migrar a Cloud Functions en Sprint 4.

---

## 5. Reglas no negociables

### 🔴 Transacciones

- Stock + kardex + ventas → SIEMPRE `runTransaction`
- **LECTURAS PRIMERO → ESCRITURAS DESPUÉS**
- Audit log en la misma transacción

### 🔴 Multi-línea en ventas

- `SaleItem` tiene `businessLine: 'drywall' | 'roofing'`
- Usar `getStockStrategy(businessLine)` — NUNCA if/else por línea
- Una sola transacción aunque haya N líneas

### 🔴 Stock negativo PERMITIDO

- No bloquear ventas — decisión de negocio
- Warning visual cuando stock < 0
- Aplica a todas las líneas

### 🔴 Seguridad

- NUNCA abrir rules "para que pase"
- 3 lugares sincronizados: layout + firestore.rules + middleware
- Roles en custom claims: ADMIN, SUPERVISOR, OPERATOR

### 🔴 Tipado

- NUNCA introducir `any` nuevo
- ~47 any's actuales con justificación

### 🟠 ESLint

- `npm run lint` = 0 errors siempre
- ~238 warnings aceptables, reducir sprint a sprint

---

## 6. SKU Conventions

```
Drywall:  P38, P64, P89, R39, R65, R90, OMG
Roofing:  [MATERIAL][LARGO]MT[COLOR_SI_NO_ES_ROJO]
          UPVC6MT, UPVC36MTAZUL, UPVC6MTVERDE...
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

// Roofing — costo promedio ponderado
newAvgCost =
  (currentQty * currentAvgCost + newQty * newUnitCost) / (currentQty + newQty);
```

---

## 8. Strategy Pattern en ventas

```ts
// ❌ NUNCA if/else por línea
// ✅ SIEMPRE strategy
const strategy = getStockStrategy(item.businessLine);
await strategy.decrementStock(item.sku, item.quantity, transaction);
```

---

## 9. Trampas conocidas

1. Firestore: `where("in")` + rango fechas = error. Ver workaround en inventoryService.
2. Algolia: Siempre hidratar con getDocs.
3. runTransaction: No metas side effects — reintenta automáticamente.
4. Custom claims: Usar `getIdToken(true)` para refrescar.
5. Coils L58: Validar status solo si viene en payload.
6. Stock negativo: Feature, no bug.
7. ESLint: `no-undef` off, `no-unused-vars` off (usar versión TS).

---

## 10. Roadmap

| Sprint | Estado | Foco                                    |
| ------ | ------ | --------------------------------------- |
| 0-3    | ✅     | Base, drywall, template, roofing ventas |
| Actual | 🚧     | Mejoras generales + UI/UX               |
| 4      | 🔜     | Roofing producción                      |
| 5+     | 🔜     | Líneas 3, 4, 5                          |

---

## 11. Checklist pre-commit

- [ ] `npm run lint` → 0 errors
- [ ] `npm run test` → 0 failing
- [ ] `npm run build` → sin errores
- [ ] Transacciones: lecturas antes que escrituras
- [ ] Stock negativo: warning visual
- [ ] Multi-línea: Strategy, no if/else
- [ ] Sin `any` nuevos
- [ ] Errores en español
- [ ] Audit log en operaciones sensibles
