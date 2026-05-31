# GEMINI.md — AYR Steel ERP (v6.3)

> **Sprint actual:** Sprint 7 (Seguridad & Escrituras Cloud)
> **Estado:** Build 🟢 | Lint: 0 errors, 413 warnings | Tests: 264/285 passed.
> **v6.3:** Navegación por capacidad, Rutas unificadas `/admin/lines/[id]`, Módulo Purchases (PVC/Trading) y Ventas unificadas.

---

## 1. Contexto del Producto

ERP para la transformación y comercialización de acero y PVC. El modelo de negocio se basa en 5 líneas integradas.

| # | Línea | Módulo | Estado | Materia Prima | Modelo |
|---|---|---|---|---|---|
| 1 | **Drywall** | `drywall` | ✅ v6.2 | Bobina (vía Flejes) | Transformación |
| 2 | **Metallic Roofing**| `metallic-roofing` | 🏗️ Sprint 6B | Bobina (Conformado directo) | Transformación |
| 3 | **Roofing (UPVC)** | `roofing` | ✅ v6.3 | Producto Terminado | Compra-Venta |
| 4 | **Trading** | `trading` | ✅ v6.3 | Terceros | Compra-Venta |
| 5 | **Services** | `services` | ✅ v6.3 | N/A | No-OP Stock |

---

## 2. Cambios de Modelo (v6.3)

### 2.1 Navegación Unificada
- **URL-Driven:** El contexto de línea se deriva exclusivamente de la URL `/admin/lines/[id]`.
- **Sidebar:** Organizado por capacidad (Comercial, Producción, Abastecimiento, etc.).
- **Deprecación:** Se eliminó el `BusinessLineSelector` y el estado global de línea activa.

### 2.2 PVC como Reventa (Sprint 6D)
- El módulo `roofing` ahora opera bajo el modelo de compra-venta.
- Las compras de producto terminado se registran en el módulo `purchases`, el cual actualiza el stock y recalcula el costo promedio ponderado (WAC).

### 2.3 Módulo de Compras (Purchases)
- **Registro:** Facturas de compra con validación de RUC + Nº Factura para evitar duplicidad.
- **Costeo:** Solo base gravada (sin IGV) × Tipo de Cambio.
- **Anulación:** Permite anular si el stock no ha sido consumido (`STOCK_ALREADY_SOLD`).

---

## 3. Arquitectura de Datos

- `purchases`: Facturas de compra de producto terminado.
- `roofing_stock`: Inventario de PVC con costo promedio.
- `cut_orders` / `strips_stock`: Flujo de Drywall tercerizado (v6.2).
- `sales`: Colección transversal con ítems clasificados por línea.

---

## 4. Guía de Desarrollo

### Comandos
```bash
npm run dev              # :3000
npm run emulate          # Firebase emulators (requerido para integración)
.\node_modules\.bin\tsc.cmd --noEmit      # Type check (actual: 0 errors)
.\node_modules\.bin\eslint.cmd .          # Lint (actual: 413 warnings)
.\node_modules\.bin\vitest.cmd run        # Tests
```

### Reglas No Negociables
1. **Rutas:** No usar estado global. Usar el `lineId` de la URL.
2. **Stock:** Siempre usar `getStockStrategy(line)`. Nunca hardcodear colecciones.
3. **Costeo:** El IGV no forma parte del costo del producto.
4. **Seguridad (Sprint 7):** Deuda Crítica. Migrar todas las escrituras a Cloud Functions.

---

## 5. Roadmap

- **HECHO (v6.3):** Navegación por capacidad, Rutas unificadas, PVC reventa, Módulo Purchases, Ventas 5 líneas.
- **PRÓXIMO: Sprint 6B — Producción Metallic 🛑 BLOQUEADO:**
  - Pendiente respuesta cliente: (1) ¿Kg o ML x Peso Nominal? (2) ¿Plan previo o directo? (3) ¿Merma de despunte?
- **Sprint 7 🔴 (Deuda Crítica):** Cierre de seguridad de Firestore y migración de escrituras a Cloud Functions.

---

## 6. Log de Decisiones v6.3

- **Navegación:** Se eliminó el estado global de línea para asegurar consistencia en entornos multi-pestaña.
- **Compras:** Se adoptó el modelo de compras transversales para centralizar la valorización de inventario.
- **PVC:** El cambio a compra-venta simplifica la operación y se alinea con la estrategia de tercerización.
