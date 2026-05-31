# GEMINI.md — AYR Steel ERP (v6.3)

> **Sprint actual:** Sprint 7 (Seguridad & Escrituras Cloud) — Deuda Crítica 🔴
> **Estado:** Build 🟢 | Lint: 0 errors, 413 warnings | Tests: 264/285 passed.
> **v6.3:** Navegación por capacidad, Sidebar v3 (Colapsable), Rutas unificadas `/admin/lines/[id]`, Módulo Compras (PEPPS/WAC), PVC como Reventa y Ventas multi-línea.

---

## 1. Contexto del Producto

ERP modular para la transformación y comercialización de acero y PVC. El sistema integra 5 líneas de negocio bajo una arquitectura orientada a capacidades operativas.

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
- **URL-Driven:** El contexto de línea se deriva exclusivamente de la URL `/admin/lines/[id]`. Se eliminó el `BusinessLineSelector` y el estado global de línea activa.
- **Grupos Operativos:** Sidebar organizado por Comercial, Producción, Abastecimiento/Compras, Materia Prima, Líneas de Negocio y Administración.
- **Visibilidad:** Las secciones de producción son condicionales a la existencia de un `productionEngine` en el módulo.

### 2.2 PVC como Reventa (Línea Roofing)
- **Cambio Estratégico:** La línea Roofing pasó de producción interna a modelo de compra-venta (reventa).
- **Valoración:** El stock se alimenta vía el módulo de Compras y se valoriza mediante Promedio Ponderado (WAC/PPP).

### 2.3 Módulo de Compras (Purchases)
- **Registro Transversal:** Centraliza la recepción de producto terminado para PVC y Trading.
- **Costeo Estricto:** Solo base gravada (sin IGV) × Tipo de Cambio. El IGV y la detracción no forman parte del costo.
- **Integridad:** Idempotencia obligatoria por (RUC + Nº Factura). La anulación verifica que el stock no haya sido consumido.

### 2.4 Ventas Multi-línea
- **Strategy Pattern:** `getStockStrategy(line)` abstrae la lógica de descuento/reverso para las 5 líneas.
- **Importador Masivo:** Clasifica SKU -> Línea automáticamente y aplica el descuento de stock correspondiente.

---

## 3. Arquitectura de Datos

- `purchases`: Facturas de compra y revalorización de inventario.
- `roofing_stock`: Stock de PVC (modelo WAC).
- `cut_orders` / `strips_stock`: Flujo de Drywall tercerizado (v6.2).
- `sales`: Transacciones de venta con ítems clasificados por `businessLine`.
- `audit_logs`: Registro de operaciones críticas (anulaciones, ediciones, cambios de stock).

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
1. **Rutas:** Nunca usar localStorage o context para la "línea activa". Usar el `lineId` de la URL.
2. **Stock:** Siempre usar `getStockStrategy(line)`. Nunca hardcodear nombres de colecciones.
3. **Costeo:** El IGV no forma parte del costo del producto.
4. **Seguridad (Sprint 7):** Deuda Crítica. Todas las escrituras deben migrar a Cloud Functions; no abrir `firestore.rules`.

---

## 5. Roadmap

- **HECHO (v6.3):** Navegación por capacidad, Sidebar v3, Rutas unificadas, PVC reventa, Módulo Purchases, Ventas 5 líneas.
- **PRÓXIMO: Sprint 6B — Producción Metallic 🛑 BLOQUEADO:**
  - Pendiente respuesta cliente: (1) ¿Kg o ML x Peso Nominal? (2) ¿Plan previo o directo? (3) ¿Merma de despunte?
- **Sprint 7 🔴 (Deuda Crítica):** Cierre de seguridad de Firestore y migración de escrituras a Cloud Functions.

---

## 6. Log de Decisiones v6.3

- **Navegación:** Se adoptó la navegación por capacidad para facilitar la multitarea operativa entre diferentes líneas de negocio sin cambiar de "contexto global".
- **PVC:** El cambio a compra-venta simplifica la gestión de inventario y se alinea con la estrategia de tercerización de la empresa.
- **Compras:** Se implementó idempotencia estricta en el registro de facturas para asegurar la consistencia del stock y el costo promedio ante re-intentos o errores de red.
