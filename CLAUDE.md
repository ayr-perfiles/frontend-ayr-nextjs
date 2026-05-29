# CLAUDE.md — AYR Steel ERP

> **Versión:** 6.1 | **Sprint actual:** Producción Metallic (Sprint 6)
> **v6.1:** 5 líneas registradas (`drywall`, `roofing`, `metallic-roofing`, `trading`, `services`). Sprint 6A (Bobinas a Core + Dashboard/Reports) cerrado. Build: 100% VERDE (0 errores). Lint: 0 errors, 241 warnings. Tests: 257/272 passed (15 fallos de integración porque no detecta el emulador corriendo; suite unitaria limpia).
> Documento Funcional ejecutivo v6.0 disponible para el cliente.

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
- Pool único line-agnostic. Las líneas consumen vía `coilConsumptionService` filtrado por acabado (validación COIL_FINISH_MISMATCH, defensa en profundidad).
- `listAvailableCoils(line)` filtra por acabado activo.
- Producción YA NO arranca desde el inventario de bobina, sino desde la pantalla de cada línea.
- Campo nuevo `coils.finish` (string). Colección NUEVA `coil_finishes` { id, label, active, lines: BusinessLine[] }, seed GALVANIZADO->drywall, ALUZINC/NATURAL->metallic, CRUD en /admin/coils/finishes.

---

## 2. Stack

| Capa       | Tech                                                       |
| ---------- | ---------------------------------------------------------- |
| Frontend   | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 |
| Backend    | Firebase Auth + Firestore + Storage + Functions            |
| UI         | lucide-react, react-hot-toast, recharts                    |
| Testing    | Vitest (Unitarios + Integración con emuladores)            |
| Validación | Zod                                                        |
| Lint       | ESLint v9 flat config — 0 errors, ~241 warnings aceptables |

```bash
npm run dev              # :3000
npm run emulate          # Firebase emulators + dev juntos
npm run build            # Build producción (DEBE SER 0 ERRORS)
npm run lint             # ESLint
npm run test             # Vitest (Unitarios)
npm run test:integration # Vitest (Integración, requiere emulador arriba)
```

---

## 3. UI y Rutas Principales

- `/admin` = **Dashboard ejecutivo** (5 líneas + materia prima), reemplazó al reporte viejo de 2 líneas. (`/admin/dashboard` redirige aquí).
- `/admin/reports` = **Centro de Reportes**. Usa arquitectura de REGISTRO (`core/reports`: ReportDefinition + ReportRunner genérico). Para agregar un reporte nuevo, se añade una definición en el registry, no una página nueva. Categorías: Ventas, Inventario, Materia Prima/Bobinas, Producción, Ejecutivo.
- `/admin/catalog` = catálogo drywall (movido de Settings).
- `/admin/coils` = Gestión global de materia prima, bajo el grupo de sidebar "Materia Prima / Almacén".

---

## 4. Arquitectura (real — `find src -maxdepth 3 -type d`)

```
src/
├── app/                   # App Router (Rutas protegidas por layout)
│   ├── admin/
│   │   ├── coils/         ← Gestión global de materia prima (Core)
│   │   ├── catalog/       ← Catálogo Drywall (products)
│   │   ├── reports/       ← Centro de Reportes centralizado
│   │   ├── [módulos]/     ← Rutas de cada línea de negocio
│
├── core/                  # Compartido y Transversal
│   ├── coils/             # GESTIÓN DE BOBINAS (CRUD + Consumo Atómico)
│   ├── sales/             # Ventas MULTI-LÍNEA (Strategies)
│   ├── reports/           # Arquitectura del Centro de Reportes
│   ├── import/            # Dispatcher de importación de excel
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

## 5. Colecciones Firestore

| Colección                | Propósito                                      | Nota                                     |
| ------------------------ | ---------------------------------------------- | ---------------------------------------- |
| `coils`                  | Materia prima (bobinas)                        | Gestionado por `core/coils`              |
| `coil_finishes`          | Tipos de acabado y compatibilidad              | Nuevo v6.0                               |
| `production_logs`        | Historial de transformación de materia prima   | Ahora incluye campo `line`               |
| `products`               | Catálogo Drywall                               | Retrocompatibilidad de naming            |
| `inventory_stock`        | Stock de perfiles (Drywall)                    |                                          |
| `[line]_catalog`         | Catálogo por línea (roofing, metallic, trading, services) |                                          |
| `[line]_stock`           | Stock de productos terminados por línea        |                                          |
| `[line]_stock_movements` | Historial de movimientos (kardex) por línea    |                                          |
| `sales`                  | Ventas multi-línea                             |                                          |
| `audit_logs`             | Auditoría de acciones sensibles                |                                          |

---

## 6. Reglas no negociables

### 🔴 Transacciones y Stock

- **Lecturas PRIMERO → Escrituras DESPUÉS** dentro de `runTransaction`.
- Stock negativo **PERMITIDO** (warning visual, no bloqueo).
- Consumo de bobina debe ser atómico vía `coilConsumptionService.consume`.

### 🔴 Multi-línea y Extensibilidad

- Usar `getStockStrategy(businessLine)` para operaciones de stock — **NUNCA if/else**. Cubre las 5 líneas.
- Strategy `services` = NO-OP (no descuenta stock). `trading` sí descuenta.
- Los módulos deben cumplir el contrato `BusinessLineModule`.

### 🔴 Seguridad (Deuda Crítica — Sprint 7)

- `firestore.rules` está **TOTALMENTE ABIERTO** (`allow read, write: if request.auth != null`).
- **PROHIBIDO** abrir más las reglas. El Sprint 7 se enfocará en cerrarlas por colección/rol.

### 🔴 Calidad de Código

- `npm run lint` = 0 errors siempre.
- `npm run build` = 0 errors siempre. (Excepciones erradicadas).
- No introducir `any` nuevos sin justificación extrema.

---

## 7. Testing

- **Fase 1 (Unitarios):** `npm run test` -> Lógica pura: strategies (incl. services no-op), finishCompat, classifier/parsers import, schemas Zod, registry/contrato, import dispatch idempotente.
- **Fase 2 (Integración):** `npm run test:integration` (Requiere `firebase emulators:start --only firestore`). Valida: coilConsumptionService (consume, finish-mismatch, concurrencia, stock negativo), producción drywall (regresión), listAvailableCoils, strategies contra DB real, E2E (ciclo drywall, venta multi-línea, venta directa bobina, services sin stock, retrocompat).

---

## 8. Roadmap

1.  **HECHO:** trading+services, catálogos sembrados (marzo), import masivo multi-línea, 6A (bobina->core + acabados + filtro + desacople), suites test Fase 1+2, build cerrado al 100%, dashboard /admin rediseñado, centro de reportes con registro.
2.  **PRÓXIMO: Sprint 6B** = motor de producción `metallic-roofing` (conformado consumiendo el pool vía coilConsumptionService).
    *   *BLOQUEADO* esperando respuesta del cliente: (a) cómo se mide consumo (kg reportado / metros×peso / piezas×peso), (b) plan previo vs directa, (c) merma sí/no.
3.  **Sprint 7 🔴:** Cierre de seguridad de Firestore (`firestore.rules` por colección+rol) y migración de writes del cliente (`inventory_stock`/kardex/audit/coils) a Cloud Functions. (Sigue 100% abierta = deuda crítica, NO marcar resuelta.)

---

## 9. Log de Decisiones v6.1

- **v6.1:** Dashboard `/admin` reemplaza reporte de 2 líneas; Centro de Reportes implementado con arquitectura de registro; Build `coils/page.js` cerrado.
- **v6.0:** Bobina compartida (pool único + acabados gestionables + consumo filtrado por acabado); catálogo drywall a `/admin/catalog`; import multi-línea con exclusiones (drywall vía PRODUCT_CATALOG, BOB->coils, ANTI->skip); ProductModal unificado (add+edit).
