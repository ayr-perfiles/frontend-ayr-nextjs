# GEMINI.md — AYR Steel ERP

> **Versión:** 5.2 | **Sprint actual:** Mejoras + UI (post Sprint 3)
> **v5.2:** `metallic-roofing` v1 ✅ integrado. Lint 0 errors, 204/204 tests, build = error pre-existente `coils/page.js` (no introducido). Roofing = UPVC-only. Engines opcionales.

Este archivo contiene los mandatos fundamentales y reglas de ingeniería para Gemini CLI en este proyecto. **Prioridad absoluta sobre cualquier flujo genérico.**

---

## 1. Contexto del producto

ERP de empresa que vende productos derivados de **acero** (bobina galvanizada/aluzinc) y **PVC**. Diversificación **ya en marcha** — es la realidad de la facturación, no un plan futuro.

**Líneas de negocio (facturación marzo 2026 + estado en código):**

| #   | Línea                                                    | Módulo / `id`      | Registrado                       | Ruta `app/` | Materia prima                  | % ingr mar-26 |
| --- | -------------------------------------------------------- | ------------------ | -------------------------------- | ----------- | ------------------------------ | ------------- |
| 1   | Coberturas **Aluzinc** (metálicas)                       | `metallic-roofing` | ✅ v1 registrado (cat+inv+ventas) | ✅ existe    | Bobina aluzinc/galvanizada     | 74.6%         |
| 2   | **Drywall** (parantes, rieles, omegas)                   | `drywall`          | ✅ sí                             | ✅           | Bobina de acero                | 20.4%         |
| 3   | Coberturas **UPVC / termoacústicos**                     | `roofing`          | ✅ sí                             | ✅           | Plancha UPVC                   | 4.5%          |
| 4   | **Compra-venta** (policarbonato, tubos, autoperforantes) | `trading`          | ❌ no                             | ✅ existe    | Producto terminado de terceros | 0.4%          |
| 5   | **Servicio de conformado**                               | `services`         | ❌ no                             | ✅ existe    | N/A (mano de obra)             | 0.1%          |

> ⚠️ `roofing` **= SOLO UPVC.** En el código `roofingModule.displayName = 'Coberturas PVC'`. Las coberturas de **Aluzinc (metal)** son `metallic-roofing`, línea aparte y la de mayor ingreso. No mezclar ambas bajo "roofing".

**Dos troncos por materia prima:**
- **ACERO / bobina** → alimenta `drywall` (perfiles) **y** `metallic-roofing` (coberturas). Las bobinas (`BOB045GALV`, `BOB28NAT`) se facturan dentro de la categoría aluzinc.
- **PVC** → `roofing`/UPVC (termoacústicos `TC5`).

**Usuarios:** ADMIN, SUPERVISOR, OPERATOR (custom claims en Firebase Auth).
⚠️ Los roles se aplican hoy solo en UI/middleware, **NO en** `firestore.rules` (ver §5).

---

## 2. Stack y Comandos

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

## 3. Arquitectura (Estructura Real)

```
src/
├── app/
│   └── admin/
│       ├── (core)/        ← audit/ customers/ dashboard/ reports/ sales/ settings/ users/
│       ├── coils/ inventory/ kardex/ production/   ← drywall (acero)
│       ├── roofing/                                    ← UPVC ✅ módulo
│       ├── metallic-roofing/                           ← aluzinc ⚠️ ruta sin módulo
│       ├── trading/                                    ← reventa  ⚠️ ruta sin módulo
│       └── services/                                   ← conformado ⚠️ ruta sin módulo
├── core/                  # Compartido entre líneas
│   ├── sales/             # Ventas MULTI-LÍNEA (actions, components, services, strategies)
│   └── contracts/         # BusinessLineModule, ProductionEngine
├── domain/                # Lógica pura (steel/)
├── modules/
│   ├── drywall/           # Módulo completo
│   └── roofing/           # Módulo completo
│       # 🔜 FALTAN: metallic-roofing/, trading/, services/
├── components/            # UI por dominio
└── lib/firebase/
```

---

## 4. Colecciones Firestore (Intención vs Realidad)

| Colección                 | Línea            | Escritura (intención)               |
| ------------------------- | ---------------- | ----------------------------------- |
| `users`                   | global           | dueño del doc (`uid == userId`)     |
| `coils`                   | drywall/metallic | ADMIN/SUPERVISOR                    |
| `production_logs`         | drywall          | ANY create, ADMIN/SUPERVISOR update |
| `inventory_stock`         | drywall          | ADMIN/SUPERVISOR ⚠️ TEMPORAL        |
| `kardex_movements`        | drywall          | ADMIN/SUPERVISOR ⚠️ TEMPORAL        |
| `roofing_catalog`         | roofing (UPVC)   | ADMIN                               |
| `roofing_stock`           | roofing (UPVC)   | ADMIN/SUPERVISOR                    |
| `roofing_stock_movements` | roofing (UPVC)   | ADMIN/SUPERVISOR create, inmutable  |
| `sales`                   | multi            | ADMIN/SUPERVISOR                    |
| `audit_logs`              | global           | ANY_ROLE ⚠️ TEMPORAL                |
| `customers/contacts`      | global           | ADMIN/SUPERVISOR                    |
| `settings/products`       | global           | ADMIN                               |

⚠️ TEMPORAL = migrar a Cloud Functions en Sprint 4.

---

## 5. Reglas no negociables

### 🔴 Transacciones
- Stock + kardex + ventas → SIEMPRE `runTransaction`.
- **LECTURAS PRIMERO → ESCRITURAS DESPUÉS.**
- Audit log en la misma transacción.

### 🔴 Multi-línea en ventas
- `SaleItem.businessLine`: ampliar a `'drywall' | 'roofing' | 'metallic-roofing' | 'trading' | 'services'`.
- Usar `getStockStrategy(businessLine)` — NUNCA if/else por línea.
- `services` → estrategia no-op; `trading` → descuenta stock sin producción.
- Una sola transacción aunque haya N líneas.

### 🔴 Stock negativo PERMITIDO
- No bloquear ventas — decisión de negocio. Warning visual cuando stock < 0.

### 🔴 Seguridad (Deuda Crítica)
- `firestore.rules` está actualmente **abierto** (`allow read, write: if request.auth != null`).
- NUNCA abrir rules "para que pase". Priorizar cierre por roles (ADMIN, SUPERVISOR, OPERATOR).

### 🔴 Tipado y Calidad
- NUNCA introducir `any` nuevo.
- `npm run lint` = 0 errors siempre.

---

## 6. SKU Conventions

- **Drywall:** `P38GALV045`, `R39GALV045`, `OMEGA045`.
- **Metallic-roofing:** `COB030ROJO`, `PL040X6MT`, `BOB045GALV`.
- **Roofing (UPVC):** `UPVC6MT`, `UPVC36MTAZUL`.
- **Trading:** `POLI600`, `ANTI`.
- **Services:** `CONFORMADO`.

---

## 7. Fórmulas críticas

- **Drywall piezas:** `totalMeters = weightKg / (thicknessMm * widthMm * (7.85/1000))`.
- **Costo Promedio:** `newAvgCost = (currentQty * currentAvgCost + newQty * newUnitCost) / (currentQty + newQty)`.

---

## 8. Contrato BusinessLineModule

Cada línea DEBE implementar `BusinessLineModule` en `src/modules/<id>/`.
`productionEngine` e `inventoryEngine` son **opcionales** (hacer null-check).

---

## 9. Checklist pre-commit (OBLIGATORIO)

- [ ] `npm run lint` → 0 errors.
- [ ] `npm run test` → 0 failing.
- [ ] `npm run build` → sin errores.
- [ ] Transacciones: lecturas antes que escrituras.
- [ ] `businessLine` cubre las 5 líneas en enum/schemas/strategies.
- [ ] Audit log en operaciones sensibles.
