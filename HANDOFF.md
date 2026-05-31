# Handoff — AYR Steel ERP (siguiente conversación)

> Subir SIEMPRE al inicio: este `HANDOFF.md` + `CLAUDE.md` (v6.3).
> Preferencias (ya en memoria del proyecto): generar **prompts para Claude Code** por defecto, NO archivos salvo que sea estrictamente necesario. Antes de generar (prompt o archivo), si hay dudas → **preguntar primero**, luego generar.

---

## Estado actual — v6.3 (todo fusionado y verificado)

- **5 líneas de negocio operativas:** Drywall, Coberturas PVC (`roofing`), Coberturas Aluzinc (`metallic-roofing`), Reventa (`trading`), Servicios (`services`). Las 5 en `businessLineRegistry`.
- **Bobina = materia prima compartida** (core/coils), pool único line-agnostic, con `finish` (acabado) gestionable (`coil_finishes`: GALVANIZADO→drywall, ALUZINC/NATURAL→metallic). Consumo filtrado por acabado (`COIL_FINISH_MISMATCH`).
- **Corte TERCERIZADO (drywall):** la bobina se envía a un tercero (`cut_orders`, multi-bobina + factura), retorna como flejes (`strips_stock` / `strips_movements`), y en planta se producen piezas desde los flejes. Estado `coils.EN_TERCERO`. Costeo por peso retornado; servicio = gravada (sin IGV) × TC; merma externa absorbida; sin merma interna. Anulación/edición de órdenes con guarda `STRIPS_ALREADY_CONSUMED` + audit_logs.
- **PVC compra-venta:** `roofing` pasó a modelo trading (sin producción, stock = terceros, avgCost). Colecciones `roofing_*` sin renombrar.
- **Módulo Compras (`purchases`)** transversal (PVC/Reventa): ENTRADA a stock con PEPPS, costo desde gravada (sin IGV), idempotente por (ruc+nº factura), `voidPurchase` con guarda `STOCK_ALREADY_SOLD`.
- **Ventas a 5 líneas:** importador masivo + formulario + vista usan el MISMO motor (getStockStrategy por línea). Importador: USD→PEN (TC por fecha), idempotencia por documentNumber, orden cronológico, costo desde stock, services no-op.
- **Navegación:** sidebar por capacidad (Comercial / Producción / Abastecimiento / Materia Prima / Líneas / Administración), 5 líneas listadas y expandibles, colapsable, rutas unificadas `/admin/lines/[lineId]/...` (fin del "active line" global; `BusinessLineContext` deprecado).
- **Dashboard ejecutivo** en `/admin` y **Centro de Reportes** (registro de ReportDefinition) en `/admin/reports`.
- **Costeo consistente en todo el sistema:** IGV = crédito fiscal, detracción = forma de pago → NUNCA inflan el costo del producto. Inventario por promedio ponderado (PEPPS). Stock negativo permitido (warning).

---

## Frentes abiertos (prioridad)

| Frente                                 | Estado                | Detalle                                                                                                                                                                                   |
| -------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 **Sprint 6B — Producción Metallic** | BLOQUEADO por cliente | Conformado de aluzinc consumiendo el pool de bobinas vía `coilConsumptionService`. Esperando 3 respuestas (abajo).                                                                        |
| 🔴 **Sprint 7 — Seguridad**            | Deuda crítica         | `firestore.rules` por colección+rol (hoy 100% abierta) + mover writes de cliente a Functions: `purchases`, `strips_*`, `cut_orders`, `audit_logs`, `inventory_stock`, `kardex_movements`. |
| 🟡 Tests + CI                          | En vuelo              | Tests nuevos (purchases, ventas 5 líneas, sidebar) + CI corriendo Fase 2 con emulador Firestore.                                                                                          |
| 🟡 Índices Firestore                   | En vuelo              | `firestore.indexes.json` derivado de queries reales; validar contra staging (el emulador NO exige índices).                                                                               |

### Sprint 6B — preguntas pendientes al cliente (desbloquean el sprint)

1. ¿Cómo se mide el consumo de bobina en el conformado? (kg reportado / metros × peso teórico / piezas × peso unitario)
2. ¿Producción con plan previo (estado IN_PROGRESS → ejecuta) o directa (elige bobina → produce)?
3. ¿Hay merma/despunte en el conformado que afecte el costo?

**Patrón recomendado 6B:** clonar la estructura del ProductionEngine drywall (`planOperation`/`executeOperation` + Result + runTransaction) pero dominio por **peso** (sin slitter/masterWidth/stripWidth); costo = pricePerKg × kg; salida a `metallic_roofing_stock` con PEPPS; consumir vía `coilConsumptionService` filtrado por acabado ALUZINC/NATURAL.

---

## TODOs menores (no bloquean)

- Migrar la **compra de bobinas** al módulo `purchases` genérico (hoy mantiene su flujo propio).
- **Emisión electrónica de VENTAS** vía PSE/OSE (módulo grande; hoy solo se registran comprobantes de COMPRA). El PSE que aparece en facturas del proveedor es referencia, no integración aún.
- **Branch protection** master/develop (CI required + PR) para que el CI bloquee el deploy de Vercel. Setup: master=prod, develop=dev, auto-deploy Vercel.
- Bobina vendida directa (BOB\*): hoy ajuste manual; futura `coilStockStrategy` por prefijo de SKU.

---

## Archivos clave a subir según la tarea

- **Siempre:** `CLAUDE.md` (v6.3) + este `HANDOFF.md`.
- **6B (metallic):** `core/contracts/BusinessLineModule.ts`, `core/coils/` (coilConsumptionService + finishCompat), `engines/production.ts` de drywall (molde), `modules/metallic-roofing/` completo, `core/sales/strategies/index.ts`.
- **Sprint 7 (rules):** `firestore.rules`, lista de colecciones y quién escribe cada una.
- **Ventas/stock:** `core/sales/strategies/index.ts`.

---

## Convenciones del proyecto (recordatorio)

- 0 `any` nuevos · errores en español · patrón Strategy (no if/else por línea) · `runTransaction` con lecturas antes de escrituras · stock negativo permitido (warning, no bloquea).
- Build debe estar 100% verde (el antiguo error `coils/page.js` ya fue resuelto — NO volver a "ignorarlo").
- NUNCA borrado físico: usar status ANULADA/VOIDED + audit_logs.
- Tests: Fase 1 (sin emulador, lógica/strategies) + Fase 2 (emulador Firestore, transacciones/E2E).

---

## Próximo paso sugerido

Cuando el cliente responda las 3 preguntas → **6B**, e inmediatamente después **Sprint 7** (seguridad) para cerrar el núcleo y bajar la deuda crítica antes de sumar más features.
