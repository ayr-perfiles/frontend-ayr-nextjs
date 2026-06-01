# ADR-008: Manejo de Notas de Crédito/Débito en la importación de ventas

**Estado:** Aceptada
**Fecha:** 2026-05-31
**Decisores:** Equipo AYR Steel
**Sprint:** 8

---

## Contexto y problema

El importador masivo de ventas procesaba todas las filas como ventas normales, sin leer el tipo de comprobante. El archivo del cliente incluye **Notas de Crédito** (y potencialmente Notas de Débito), que no son ventas: una NC revierte/ajusta un comprobante previo.

Consecuencia del bug: las NC descontaban stock por segunda vez y sumaban ingreso, corrompiendo inventario y ventas.

Complicación: una NC puede ser por **devolución física** (debe regresar stock) o por **solo descuento de dinero** (no mueve stock). El archivo de SUNAT **no trae el motivo**, y la API oficial de validez tampoco lo expone (solo da el estado de validez). El motivo solo vive en el XML de la NC.

## Opciones consideradas

1. Asumir que toda NC devuelve stock: corrompe inventario cuando es solo dinero.
2. Inferir el motivo desde SUNAT: no es posible (ningún servicio entrega el motivo de una NC ajena).
3. **Decisión explícita del usuario (elegida):** el usuario decide por cada NC, en el preview, si devuelve stock o es solo dinero.

## Decisión

- El importador lee `documentType` (Factura/Boleta/Nota Crédito/Nota Débito) y `adjustedDocument` (serie-número del comprobante original).
- **Nota de Crédito:** atributo interno `ncStockAction` (enum): `RETURNS_STOCK` (devolución → entra stock IN vía `getStockStrategy(line)` + resta ingreso), `MONEY_ONLY` (solo resta ingreso), `UNDECIDED` (default → bloquea el guardado hasta decidir).
- La cantidad/SKU del movimiento salen de la fila de la NC (puede ser devolución parcial), no del comprobante original.
- **Nota de Débito:** suma monto, NO mueve stock.
- NC/ND se guardan como documentos propios enlazados al original vía `adjustedDocument`.

## Consecuencias

- Se eliminó el atributo previo `affectsStock`; la única fuente de decisión es `ncStockAction`.
- La reversa de stock usa el mismo patrón Strategy por línea (ADR-004), sin hardcode de colecciones → consistente en drywall/trading/metallic.
- Convención de nombres: identificadores en inglés (`documentType`, `unitOfMeasure`, `adjustedDocument`, `ncStockAction`); los valores leídos del Excel se conservan en español. `ncStockAction` es campo interno → su valor es enum inglés.
- En el preview, badge de moneda + tipo de cambio por ítem y control inline para resolver las NC `UNDECIDED`. La decisión manual queda registrada en audit para trazabilidad.
