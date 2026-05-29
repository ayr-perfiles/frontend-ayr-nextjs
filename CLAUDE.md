# CLAUDE.md — AYR Steel ERP

> **Versión:** 6.0 | **Sprint actual:** Producción Metallic (Sprint 6)
> **v6.0:** 5 líneas registradas (`drywall`, `roofing`, `metallic-roofing`, `trading`, `services`). Sprint 6A cerrado (Bobinas a Core). Build: 100% VERDE (0 errores). Lint: 0 errors, 241 warnings. Tests: 257/272 passed (15 fallos de integración requieren emulador).
>
> **Cambios v5→v6 (validados contra código real):**
>
> 1.  **Bobinas a Core:** La gestión de bobinas salió de `drywall` hacia `src/core/coils/`. Es ahora materia prima compartida.
> 2.  **Acabados Gestionables:** Nueva colección `coil_finishes`. Las bobinas ahora requieren un `finish` (GALVANIZADO, ALUZINC, etc.) que determina su compatibilidad con cada línea.
> 3.  **Build Limpio:** Se resolvió el error histórico en `coils/page.js` y errores de tipos en Clientes y Reportes. El build ahora pasa sin excepciones.
> 4.  **Testing Proactivo:** Suites de Fase 1 (unitarios) y Fase 2 (integración con emulador) implementadas.

---

## 1. Contexto del producto

ERP de empresa que vende productos derivados de **acero** (bobina galvanizada/aluzinc) y **PVC**. Diversificación **ya en marcha**.

**Líneas de negocio (registradas en `businessLineRegistry.ts`):**

| #   | Línea                                                    | Módulo / `id`      | Estado                            | Materia prima                  |
| --- | -------------------------------------------------------- | ------------------ | --------------------------------- | ------------------------------ |
| 1   | Coberturas **Aluzinc** (metálicas)                       | `metallic-roofing` | ✅ v1 (cat+inv+ventas)            | Bobina aluzinc/galvanizada     |
| 2   | **Drywall** (parantes, rieles, omegas)                   | `drywall`          | ✅ Completo                       | Bobina de acero                |
| 3   | Coberturas **UPVC / termoacústicos**                     | `roofing`          | ✅ Completo                       | Plancha UPVC                   |
| 4   | **Compra-venta** (policarbonato, tubos, autoperforantes) | `trading`          | ✅ Registrado (cat+inv+ventas)    | Producto terminado de terceros |
| 5   | **Servicio de conformado**                               | `services`         | ✅ Registrado (catálogo, no-stock) | N/A (mano de obra)             |

> ⚠️ `roofing` **= SOLO UPVC.** Las coberturas de **Aluzinc (metal)** son `metallic-roofing`. No mezclar ambas.

**Materia Prima Compartida (Bobinas):**
- Gestionada en `src/core/coils/`.
- Pool único line-agnostic. Las líneas consumen vía `coilConsumptionService`.
- Filtro por acabado: cada línea solo ve/usa bobinas compatibles según `coil_finishes`.

---

## 2. Stack

| Capa       | Tech                                                       |
| ---------- | ---------------------------------------------------------- |
| Frontend   | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 |
| Backend    | Firebase Auth + Firestore + Storage + Functions            |
| UI         | lucide-react, react-hot-toast, recharts                    |
| Testing    | Vitest (Unitarios + Integración con emuladores)            |
| Validación | Zod                                                        |
| Lint       | ESLint v9 flat config — 0 errors, ~240 warnings aceptables |

```bash
npm run dev              # :3000
npm run emulate          # Firebase emulators + dev juntos
npm run build            # Build producción (DEBE SER 0 ERRORS)
npm run lint             # ESLint (0 errors)
npm run test             # Vitest (Unitarios)
npm run test:integration # Vitest (Integración, requiere emulador arriba)
```

---

## 3. Architecture (real — `find src -maxdepth 3 -type d`)

```
src/
├── app/                   # App Router (Rutas protegidas por layout)
│   ├── admin/
│   │   ├── coils/         ← Gestión global de materia prima (Core)
│   │   ├── catalog/       ← Catálogo Drywall (products)
│   │   ├── [módulos]/     ← Rutas de cada línea de negocio
│
├── core/                  # Compartido y Transversal
│   ├── coils/             # GESTIÓN DE BOBINAS (CRUD + Consumo Atómico)
│   ├── sales/             # Ventas MULTI-LÍNEA (Strategies)
│   ├── contracts/         # BusinessLineModule contract
│   ├── registry/          # Registro central de módulos
│
├── modules/               # Líneas de Negocio (Aisladas)
│   ├── drywall/ roofing/ metallic-roofing/ trading/ services/
│
├── components/            # UI compartida por dominio
├── context/               # AuthContext, BusinessLineContext
├── services/              # Servicios globales (CRM, Audit, Reports)
└── lib/firebase/          # Configuración Firebase Client
```

---

## 4. Colecciones Firestore

| Colección                | Propósito                                      | Nota                                     |
| ------------------------ | ---------------------------------------------- | ---------------------------------------- |
| `coils`                  | Materia prima (bobinas)                        | Gestionado por `core/coils`              |
| `coil_finishes`          | Tipos de acabado y compatibilidad              | Nuevo v6.0                               |
| `production_logs`        | Historial de transformación de materia prima   | Ahora incluye campo `line`               |
| `products`               | Catálogo Drywall                               | Retrocompatibilidad de naming            |
| `inventory_stock`        | Stock de perfiles (Drywall)                    |                                          |
| `[line]_catalog`         | Catálogo por línea (roofing, metallic, etc.)   |                                          |
| `[line]_stock`           | Stock de productos terminados por línea        |                                          |
| `sales`                  | Ventas multi-línea                             |                                          |
| `audit_logs`             | Auditoría de acciones sensibles                |                                          |

---

## 5. Reglas no negociables

### 🔴 Transacciones y Stock

- **Lecturas PRIMERO → Escrituras DESPUÉS** dentro de `runTransaction`.
- Stock negativo **PERMITIDO** (warning visual, no bloqueo).
- Consumo de bobina debe ser atómico vía `coilConsumptionService.consume`.

### 🔴 Multi-línea y Extensibilidad

- Usar `getStockStrategy(businessLine)` para operaciones de stock — **NUNCA if/else**.
- Los módulos deben cumplir el contrato `BusinessLineModule`.
- `services` usa estrategia NO-OP (no mueve stock).

### 🔴 Seguridad (Deuda Crítica — Sprint 7)

- `firestore.rules` está **TOTALMENTE ABIERTO** (`allow read, write: if request.auth != null`).
- **PROHIBIDO** abrir más las reglas. El Sprint 7 se enfocará en cerrarlas por colección/rol.

### 🔴 Calidad de Código

- `npm run lint` = 0 errors siempre.
- `npm run build` = 0 errors siempre.
- No introducir `any` nuevos sin justificación extrema.

---

## 6. Testing

- **Fase 1 (Unitarios):** Lógica pura, parsers, validación Zod, registry. Se corre con `npm run test`.
- **Fase 2 (Integración):** Requiere `firebase emulators:start --only firestore`. Valida transacciones, concurrencia y ruteo a DB real. Se corre con `npm run test:integration`.

---

## 7. Roadmap Próximo

1.  **Sprint 6B:** Motor de producción `metallic-roofing` (conformado desde bobina).
    *   *Bloqueo:* Pendiente definir métrica de consumo (Kg vs Metros) y flujo de merma.
2.  **Sprint 7:** Cierre de seguridad de Firestore y migración de escrituras críticas a Cloud Functions.

---

## 8. Log de Decisiones v6.0

1.  **Bobina como Core:** Se determinó que la bobina no es un producto de Drywall sino una materia prima compartida. Su gestión se centralizó para permitir que `metallic-roofing` también la consuma.
2.  **Acabados Dinámicos:** Se evitó el uso de `z.enum` para acabados de bobina. Se creó `coil_finishes` en Firestore para que el usuario gestione sus propios materiales y compatibilidades.
3.  **Desacoplamiento de Producción:** El inventario de bobinas ya no "lanza" la producción. Cada línea de negocio tiene su propio botón "Iniciar Producción" que filtra solo las bobinas que puede procesar.
4.  **Build Resuelto:** Se eliminó el directorio huérfano `src/app/admin/inventory` y se corrigieron tipos en Clientes y Reportes, logrando un build 100% limpio.
