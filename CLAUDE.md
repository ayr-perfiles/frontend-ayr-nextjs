# CLAUDE.md — AYR Steel ERP (v6.3)

> **Sprint actual:** Sprint 7 (Seguridad & Escrituras Cloud) — Deuda Crítica 🔴
> **Estado:** Build 🟢 | Lint: 0 errors, 413 warnings | Tests: 264/285 passed (PERMISSION_DENIED en integración por rules estrictas).
> **v6.3:** Navegación por capacidad, Sidebar v3 (Colapsable), Rutas unificadas `/admin/lines/[id]`, Módulo Compras (PEPPS/WAC), PVC como Reventa y Ventas multi-línea.

---

## 1. Contexto del Producto

ERP modular para transformación y comercialización de acero/PVC. 5 líneas de negocio integradas bajo una arquitectura de navegación por capacidad operativa.

| # | Línea | Módulo | Estado | Materia Prima | Modelo |
|---|---|---|---|---|---|
| 1 | **Drywall** | `drywall` | ✅ v6.2 | Bobina (vía Flejes) | Transformación |
| 2 | **Metallic Roofing**| `metallic-roofing` | 🏗️ Sprint 6B | Bobina (Conformado) | Transformación |
| 3 | **Roofing (UPVC)** | `roofing` | ✅ v6.3 | Producto Terminado | Compra-Venta |
| 4 | **Trading** | `trading` | ✅ v6.3 | Terceros | Compra-Venta |
| 5 | **Services** | `services` | ✅ v6.3 | N/A | No-OP Stock |

---

## 2. Cambios de Modelo (v6.3)

### 2.1 Navegación por Capacidad & Sidebar v3
- **Grupos Operativos:** Sidebar organizado por Comercial, Producción, Abastecimiento/Compras, Materia Prima, Líneas de Negocio y Administración.
- **Visibilidad:** Líneas sin `productionEngine` no muestran la sección de Producción.
- **Sidebar:** Colapsable (260px <-> 72px) con tooltips. Badge ámbar en Bobinas (conteo sin acabado). Pill "Próximamente" en Producción Aluzinc.
- **Rutas Unificadas:** Todas las líneas operan bajo `/admin/lines/[id]/(catalog|inventory|production)`. Eliminado el estado global `selectedBusinessLine`; el contexto se resuelve 100% vía URL (`useParams`).
- **Redirects:** Rutas legacy (ej: `/admin/catalog`) redirigen permanentemente vía `next.config.ts`.

### 2.2 PVC como Reventa (Línea Roofing)
- **Modelo:** Pasó de producción interna a modelo compra-venta estilo Trading.
- **Stock:** `roofing_stock` (terminado) y `roofing_stock_movements`.
- **Costo:** Promedio Ponderado (WAC) alimentado por el módulo de Compras.

### 2.3 Módulo de Compras (Purchases)
- **Colección:** `purchases` (transversal para PVC/Trading; Bobinas pendientes de migrar).
- **Lógica:** Registro de facturas con idempotencia (RUC + Nº). Costo = Base Gravada (sin IGV) × TC.
- **Integridad:** `voidPurchase` anula la compra y revierte stock solo si está íntegro; bloquea con `STOCK_ALREADY_SOLD` si ya hubo ventas. Audit log: `VOID_PURCHASE`.

### 2.4 Ventas a 5 Líneas
- **Importador:** Clasifica SKU -> Línea, descuenta vía `StockStrategy`, conserva TC por fecha y conversión USD->PEN. Idempotencia por documentNumber.
- **Estrategia:** `getStockStrategy(line)` centraliza la lógica de descuento/reverso para las 5 líneas (incluyendo No-Op para servicios).

---

## 3. Arquitectura de Datos

- `purchases`: Nuevas facturas de compra y revalorización de stock.
- `cut_orders` / `strips_stock`: Flujo de corte tercerizado (v6.2).
- `sales`: Colección transversal con items clasificados por `businessLine`.
- `audit_logs`: Registro de todas las operaciones críticas (VOID_PURCHASE, VOID_SALE, etc).

---

## 4. Guía de Desarrollo

### Comandos
```bash
npm run dev              # :3000
npm run emulate          # Firebase emulators (requerido para integración)
.\node_modules\.bin\tsc.cmd --noEmit      # Type check (actual: 0 errors)
.\node_modules\.bin\eslint.cmd .          # Lint (actual: 0 errors, 413 warnings)
.\node_modules\.bin\vitest.cmd run        # Tests (264 pass, 21 fail)
```

### Reglas No Negociables
1. **Rutas:** Nunca usar localStorage o context para la "línea activa". Usar el `lineId` de la URL.
2. **Stock:** Siempre usar `getStockStrategy(line)`. Nunca hardcodear nombres de colecciones.
3. **Costeo:** El IGV no forma parte del costo. Solo base gravada al tipo de cambio del documento.
4. **Seguridad (Sprint 7):** No abrir `firestore.rules`. Migrar escrituras críticas a Cloud Functions.

---

## 5. Roadmap

- **HECHO (v6.3):**
  - Navegación por capacidad y Sidebar colapsable v3.
  - Rutas unificadas `/admin/lines/[id]` (Fin del active-line global).
  - PVC migrado a modelo Compra-Venta.
  - Módulo `purchases` v1 (PVC/Trading).
  - Ventas (Formulario + Importador) unificadas para las 5 líneas.
- **PRÓXIMO: Sprint 6B — Producción Metallic 🛑 BLOQUEADO:**
  - Pendiente respuesta cliente: (1) ¿Kg o ML x Peso Nominal? (2) ¿Plan previo o directo? (3) ¿Merma de despunte?
- **Sprint 7 🔴 (Deuda Crítica):**
  - Cierre de seguridad de Firestore (`firestore.rules` por rol/colección).
  - Migración de escrituras críticas (`purchases`, `sales`, `cut_orders`) a Cloud Functions.
- **TODO Menor:** Migrar compra de bobinas al módulo `purchases`. Emisión electrónica vía PSE (Fase Futura).

---

## 6. Log de Decisiones v6.3

- **Navegación:** Se adoptó el patrón de navegación por capacidad operativa para reducir clicks y permitir multitarea entre líneas de negocio.
- **Rutas:** El identificador de línea en la URL asegura que el estado sea consistente al compartir links o recargar.
- **Compras:** Se implementó idempotencia estricta en `purchases` para evitar duplicidad de stock en re-registros de facturas.
- **Ventas:** El uso de `StockStrategy` permite que el motor de ventas sea agnóstico a la línea, facilitando la adición de nuevas líneas en el futuro.
