# ADR-011: Atomicidad POR FACTURA en registro masivo de bobinas

**Estado:** Aceptada
**Fecha:** 2026-07-07 (formaliza decisión implementada en v6.13, `registerCoilsBulk`)
**Decisores:** Equipo AYR Steel
**Sprint:** 7 (WRITE 6 mini-ciclo 2)

---

## Contexto y problema

`registerCoilsBulk` da de alta masivamente bobinas históricas (ej. importación de abril: ~490 bobinas repartidas en decenas de facturas). Firestore limita una transacción a **500 operaciones**; cada bobina necesita read (dedup) + write, así que un todo-o-nada global rebasa el tope. Además, un todo-o-nada emulado exigiría saga + compensación con **borrado físico** — violando la regla de no-borrado.

## Opciones consideradas

1. **Todo-o-nada global:** imposible dentro del límite de 500 ops; la alternativa saga viola no-borrado. Descartada.
2. **Por bobina (best-effort fila a fila):** granularidad demasiado fina — una factura a medias es un estado contable sin sentido para conciliación. Descartada.
3. **Atómico POR FACTURA (elegida):** una `runTransaction` por factura, dedup adentro; fallo parcial ENTRE facturas tolerado.

## Decisión

**La unidad de atomicidad es la FACTURA** (la unidad contable real de conciliación con el proveedor):

- Una transacción por factura; todas las bobinas de la factura entran o ninguna.
- **Dedup por existencia de doc → skip-factura ENTERO** (no parcial dentro de factura; ciego a VOIDED — re-importar una factura anulada requiere `deleteCoilDraft` previo).
- Fallo parcial entre facturas tolerado: "lo que entró, entró" (migración histórica); el reporte por factura (`{invoice, status: created|skipped-dup|failed, count, reason}`) le dice al operador exactamente qué reintentar.
- Guards por factura: finish vs `coil_finishes`, TC USD [2,7] (PEN→1), fecha YYYY-MM-DD con validación de componentes, dimensiones > 0.
- Audit `REGISTER_COIL_BULK` con `coilIds` en raíz.

Implementación: `functions/src/callables/coilBulkRegistration.ts` (loop de facturas en `:46`, transacción por factura, pricePerKg inline en `:114-118`).

## Consecuencias

### Positivas ✅
- Cabe siempre en el límite de 500 ops (ninguna factura real se acerca).
- La semántica de reintento es trivial: re-subir el archivo; las facturas ya creadas se saltan por dedup.
- Cero borrado físico: no hay compensación destructiva.

### Negativas ⚠️
- Una corrida puede terminar "a medias" entre facturas — aceptado explícitamente para migración histórica; el reporte por factura es el contrato de visibilidad.
- El dedup por existencia es ciego a VOIDED: re-importar una factura corregida exige anular + `deleteCoilDraft` de las bobinas viejas primero (flujo de red de re-importación, v6.14).

### Neutrales 🔵
- La UI (`/admin/coils/bulk-import`) mantiene sus propios guards de formato (peso [2000-7000] kg, TON→kg, valor a 2 decimales) que NO son de negocio sino de robustez de parseo — el callable no los replica a propósito (bobina atípica legítima no debe hard-blockearse).

## Referencias
- CLAUDE.md v6.21 §10 ("Bulk atomicidad"), §14 (importación de abril) · `docs/05-formulas/costeo-coils.md` F-C1/F-C10/F-C11.
- ADR-009 (el pricePerKg registrado acá es el snapshot que las reversas congelan).
