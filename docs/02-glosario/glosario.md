# Glosario — Lenguaje Ubicuo (Español ↔ Código)

> Estado: Vigente
> Última verificación: 2026-07-07 · commit `71250ae6`
> Fuente de verdad: el CÓDIGO. Este doc se valida contra él, no al revés.
> Relacionado: CLAUDE.md v6.21 §1, §3 · docs/05-formulas/ · ADR-004 (Strategy) · ADR-008 (NC/ND)

Convención del repo: **identificadores en inglés, datos/errores de usuario en español**. Este glosario mapea el término de negocio (como lo dice el usuario/operario) al término en código y a su colección/campo Firestore.

| Término (negocio) | Término en código | Colección / campo | Definición |
|---|---|---|---|
| **Bobina** | coil | `coils/{id}` | Materia prima de acero en rollo. Campos clave: `initialWeight`/`currentWeight` (kg), `masterWidth` (mm), `thickness` (mm), `pricePerKg` (S/kg, fijo desde el registro — nunca se recalcula), `finish`, `status`. |
| **Bobina madre / hija** | parent / child coil | `coils.parentCoilId` | Genealogía de splits. La hija referencia a la madre vía `parentCoilId`. Reversa: `reverseCoilSplit`. |
| **Fleje** | strip | `strips_stock/{widthMm}` · `strips_movements` | Sección longitudinal de la bobina (por ancho), insumo de la conformadora drywall. Stock por ancho con `totalStrips`, `totalWeight` (kg), `avgCostPerKg`. |
| **Merma** | scrap | `scrap_logs/{id}` | Peso de bobina dado de baja por daño/desperdicio. `scrapWeightKg`, `scrapCostPEN` (congelado). Sin campo `status` = activa; `status: "VOIDED"` = anulada. Reversa: `voidCoilScrap`. |
| **Split** | coil split | `registerCoilSplit` (callable) | Corte longitudinal de bobina por ancho; el peso se reparte proporcional al ancho, el `pricePerKg` se hereda idéntico. |
| **PT (producto terminado)** | finished good / stock | `metallic_roofing_stock`, `inventory_stock`, `roofing_stock`, `trading_stock` | Stock vendible por SKU. Cada línea tiene su colección propia (nunca se mezclan). |
| **Kardex** | kardex movements | `kardex_movements/{id}` | Ledger inmutable (append-only) por `sku`. ⚠️ Es el ledger de **drywall products + bobinas** (el `sku` de una bobina es su `coilId`). Tipos: `IN`/`ENTRADA` (+), `OUT`/`SALIDA` (−), `SCRAP` (−, merma), `SCRAP_REVERSAL` (+), `AJUSTE`. Las otras líneas usan `*_stock_movements` propias. |
| **CPP / WAC / costo promedio** | avgCost (roofing/metallic/trading) · lastCostPerPiece (drywall) · avgCostPerKg (flejes) | campo en cada `*_stock` | Costo promedio ponderado en PEN. Se recalcula SOLO en entradas (compra, producción, ajuste ENTRY). Ver `modelo-de-costeo.md` Principio 2. |
| **Costo congelado** | frozen cost / `costPerKgCongelado` / `frozenCost` | `production_logs.perCoilBreakdown[].costPEN` · `scrap_logs.scrapCostPEN` · `SaleItem.baseCost` | Costo grabado en la transacción original, que toda reversa usa en lugar del promedio vigente. Ver ADR-009. |
| **Factor de densidad** | densityFactor | `coil_finishes/{key}.densityFactor` | Constante que liga peso↔metros: `pesoKg = ML × thicknessMm × widthMm × densityFactor`. UNA por acabado, lookup vivo, throw si falta. GALV/ALU-NATURAL 0.00785; ALU-colores 0.008. |
| **Acabado** | finish | `coil_finishes/{key}` | Recubrimiento/color de la bobina. Llaves vivas: `GALV`, `ALU-NATURAL`, `ALU-AZUL`, `ALU-BLANCO`, `ALU-ROJO`, `ALU-VERDE`, `ALU-GRIS`. (Los tokens del parser — `GALV|NATURAL|AZUL|...` — son semánticos, NO las llaves; mapeo en `TOKEN_TO_FINISH`.) |
| **ProductKind** | ProductKind | derivado de `family` vía `coverageMetadataParser.ts` | Unidad del stock metallic: `COBERTURA_ML` → quantity en ML, avgCost S/·ML⁻¹; `PLANCHA_UND` → quantity en UND, avgCost S/·UND⁻¹. |
| **ML (metro lineal)** | ML / `mlProduced` / `mlFromCoil` | `production_logs.mlProduced` | Metros lineales producidos/consumidos. Unidad de venta de coberturas. |
| **UND (unidad/plancha)** | UND / pieces | `production_logs.piecesProduced` | Unidades físicas. ⚠️ `piecesProduced` carga ML si el SKU es `COBERTURA_ML` (nombre engañoso, deuda documentada — es el `quantity` exacto inyectado a stock). |
| **TC (tipo de cambio)** | exchangeRate | `sales.exchangeRateApplied` · `purchases.exchangeRate` · `coils.metadata.exchangeRate` | Tasa USD→PEN del día. Sin fallback numérico (el 3.75 está MUERTO desde v6.20); guard [2,7] en registro de bobinas. TC=1 para PEN. |
| **PEN / Soles** | PEN | — | Moneda interna única. Todo monto se convierte a PEN al ingresar; los reportes suman en soles. |
| **Anular (venta/producción/merma)** | void | `status: "VOIDED"` | Baja lógica, NUNCA borrado físico (excepción única: `deleteCoilDraft` para borradores inertes con cero movimientos). Siempre deja `audit_logs` + movimiento compensatorio. |
| **Guard posterior** | posterior sale guard | `voidProductionFromCoils` | Hard-block: no se anula una producción si el PT tiene venta COMPLETED posterior (`approvedAt ?? timestamp`). Ver ADR-010. |
| **Cotización** | quotation | `sales.status: "QUOTATION"` | Venta no confirmada; al aprobarse (`approveQuotation`) descuenta stock y gana `approvedAt`. Las ventas ex-cotización spreadean el `timestamp` viejo — por eso el guard posterior usa `approvedAt ?? timestamp`. |
| **NC / Nota de Crédito** | credit note | `sales.documentType: "Nota Crédito"` · `ncStockAction` | Ajuste de comprobante previo. `ncStockAction`: `RETURNS_STOCK` (devuelve stock al frozenCost) / `MONEY_ONLY` / `UNDECIDED` (bloquea). Ver ADR-008. |
| **Línea de negocio** | businessLine | `SaleItem.businessLine` | `drywall` · `roofing` · `metallic-roofing` · `trading` · `services`. Determina la `StockStrategy` (ADR-004). |
| **Estrategia de stock** | StockStrategy / `getStockStrategy(line)` | `src/core/sales/strategies/index.ts` | Interfaz de 6 métodos + factory. `services` es NO-OP (stock infinito, colección dummy `_noop_stock`). |
| **Conformado** | coil production / `produceFromCoils` | `production_logs` (`line: "metallic-roofing"`) | Transformación bobina → cobertura/plancha en la conformadora A2. |
| **Plan de corte** | cutting plan / `cuttingPlan` | `coils.plannedStrips` | Distribución de anchos de fleje sobre la bobina madre (slitter drywall), con regla de leftover ≤40mm. |
| **Orden de corte (tercerizado)** | cut order | `cut_orders/{id}` | Envío de bobinas a corte externo; al recibir flejes se prorratea el costo del servicio por peso. |
| **Sobrante / retazo** | leftover | — | Ancho no planificado del corte. Si ≤40mm no absorbe costo (sin valor de rescate). |
| **Rendimiento** | yield | `useCoilYield` / `yieldCalc.ts` | Desviación entre kg teórico (por densidad) y kg real consumido; alerta si >5%. |
| **Borrador inerte** | coil draft | `deleteCoilDraft` (callable) | Bobina VOIDED con CERO movimientos (sin producción/split/merma/kardex). Único caso de borrado físico permitido. |
| **Importación masiva** | bulk import / `registerCoilsBulk` | `/admin/coils/bulk-import` | Alta masiva de bobinas por factura. Atómico POR FACTURA (ADR-011), dedup por existencia. |
| **Auditoría** | audit log | `audit_logs/{id}` | Registro inmutable de acciones críticas (`VOID_PRODUCTION_FROM_COILS`, `REVERSE_COIL_SPLIT`, `VOID_COIL_SCRAP`, `REGISTER_COIL_BULK`, `DELETE_COIL_DRAFT`, ...). Append-only para TODOS, incluso ADMIN. |
| **Roles** | ADMIN / SUPERVISOR / OPERATOR | custom claim `request.auth.token.role` | RBAC por JWT (ADR-003). Claim-only en prod: sin bypass por dominio de email. |
| **IGV** | IGV_RATE | `settings.igvRate` (configurable, casi no leído) | Impuesto peruano 18%. ⚠️ Redeclarado ×6 en código (ver `ventas-igv.md` F-V2). |
| **Peso estándar** | standardWeight | catálogo drywall | kg por pieza del SKU; base de `calcPesoKg` y del peso reportado de producción. |
| **Stock negativo** | negative stock | — | Permitido en todas las líneas (warning visual, no bloqueo). Decisión de negocio: registrar la venta y comprometer entrega. |
