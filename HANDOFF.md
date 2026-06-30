# Handoff — AYR Steel ERP (Siguiente Sesión)

> **Subir SIEMPRE al inicio:** este `HANDOFF.md` + `CLAUDE.md` (v6.11, ya committeado en develop `cb6df2a1`).
> **Preferencias (MANTENER):** Prompts de Claude Code por defecto. Caveman mode. Cada prompt con PASO 0 read-only. Preguntar ante cualquier duda de negocio. NUNCA cerrar en verde sin validación en RUNTIME incógnito. `npm run build` LOCAL antes de merge a master.

---

## Cerrado esta sesión ✅

**DEUDA P1 (dirección-hijo) — CERRADA.** Guardarraíl `voidCoil`: bloquea anular hijas de split (`parentCoilId` presente) → `failed-precondition` ANTES del check de status. Audit string neutralizado (`"bobina"`, no `"bobina madre"`).

- Commit guardarraíl: `920dce8f` (develop). Merge a master: `2b9c57a9`.
- Deploy: `voidCoil` ACTIVE en prod (`ayrsteel-2026`).
- **Validado en prod incógnito:** hijo `TEST-001-2-S34C735` AVAILABLE → intento Anular → error ruidoso, hijo SIGUIÓ AVAILABLE (no VOIDED). ✓
- Tests: 85 passed / 3 skipped (guardarraíl sumó 1).
- **Vercel master: VERDE confirmado** (commit `2b9c57a9`).

**Docs:** CLAUDE.md v6.11 committeado `cb6df2a1` (header + §8.4 conteo 84→85; §9 P1 a HECHO, P1-bis nuevo en PENDIENTE; §10 +2 ADRs; §11 regla `npm run build` local).

---

## 🔴 ARRANCAR PRÓXIMA SESIÓN — DEUDA P1-bis: guardarraíl voidCoil (dirección-MADRE)

**Bug NUEVO, descubierto en la validación de P1.** Espejo exacto de P1, dirección opuesta.

`voidCoil` sobre una bobina MADRE que tiene hijos de split VIVOS la marca VOIDED **sin tocar los hijos** → los hijos quedan colgando de un padre muerto = **inventario fantasma con origen anulado** (pérdida silenciosa, viola "fallo ruidoso").

**Validado en prod:** `TEST-001-2` (madre, initialWeight 5000, currentWeight 1250) quedó VOIDED mientras su hijo `TEST-001-2-S34C735` (1250 kg) sigue AVAILABLE colgando. El guardarraíl P1 NO la frenó porque la madre no tiene `parentCoilId` (correcto: P1 solo bloquea hijos).

**FIX (mini-ciclo, NO la reversa completa):** precondición en `voidCoil` que detecte hijos vivos →

- Query dentro de la transacción / pre-check: `coils where parentCoilId == coilId & status != 'VOIDED'`.
- Si existe al menos uno → `throw HttpsError('failed-precondition', 'Esta bobina tiene hijos de split activos. Revierte los splits antes de anular.')`.
- **Bloquear, NO cascada-void** (cascada perdería la masa de los hijos = otro fallo silencioso).

**Decisión de diseño pendiente para PASO 0:** ¿dónde va el check — pre-transacción (query collection) o dentro de runTransaction? Una query de colección dentro de runTransaction tiene implicancias (no es una lectura de doc puntual). Evaluar en recon. Confirmar también que `status != VOIDED` es el filtro correcto de "hijo vivo" (¿cuenta un hijo ya producido/consumido como vivo? — preguntar si no está explícito).

**Ciclo completo obligatorio:** PASO 0 read-only → test RED (void de madre con hijo vivo lanza `failed-precondition`; void de madre SIN hijos / con hijos ya VOIDED sigue OK) → `test:emu` verde → `npm run build` LOCAL → deploy functions prod → validar incógnito → re-merge develop→master.

---

## DEUDA — Reversa de split COMPLETA = WRITE separado (resuelve P1 + P1-bis de raíz)

Ambos guardarraíles (P1 hijo, P1-bis madre) son CANDADOS, no la solución. La solución real es la reversa de split: restaurar `currentWeight` + `masterWidth` de la madre a pre-split, VOIDED al hijo, revertir `kardex_movements` del split (`splitId` compartido), manejar splits encadenados / producciones posteriores. Diseño grande. Designar como WRITE en roadmap (≠ WRITE 7, que es `voidProductionFromCoils`).

---

## Roadmap escritores (orden propuesto, decidir tras P1-bis)

- **P1-bis** (arriba) — próximo mini-ciclo.
- **WRITE 6:** altas de coils (`AddCoilForm` / `BulkUpload` / `PurchaseXml`).
- **WRITE 7:** `voidProductionFromCoils` (metallic+drywall), costo CONGELADO.
- **WRITE 8:** `cutOrder` (monstruo: WAC+prorrateo, 5 funciones).
- **WRITE 9:** `salesService` (payload crítico precio/correlativo).
- Luego: candar rules `coils`/`kardex`/`audit` cuando cada colección tenga 0 escritores cliente (multi-sprint).

---

## Deudas que se mantienen (detalle en CLAUDE.md §9)

- **Deuda menor nueva — UI gating:** ocultar botón "Anular" en `InventoryTable.tsx` cuando `coil.parentCoilId` exista (cosmético; hoy el hijo muestra el botón y recibe el error al click — funciona, pero el gate mejora UX). NO bloquea seguridad.
- **`GEMINI.md`:** auditar vs `CLAUDE.md` → consolidar negocio → enterrar (baja en commit propio tras auditoría).
- **3 tests `salesReimport` (casos 2-4) skipped** hasta WRITE 9. NO re-debilitar rule §8.4 para revivirlos.
- **Test rollback MID-transaction faltante en WRITE 5** (el actual prueba guard de input, no atomicidad real).
- **`consumeCoil`/`processSingleStrip`:** inertes en UI (solo tests legacy), destino final pendiente.
- **`idempotency_keys`:** sin TTL/limpieza.
- **`TEST-001*` en prod:** bobinas SACRIFICIALES de validación, NO inventario real. `TEST-001-2` quedó VOIDED-con-hijo-colgando tras la validación de hoy — inerte, ignorable, limpieza opcional.

---

## Suggested skills

- `tdd` — test RED-GREEN del guardarraíl P1-bis (mismo patrón que P1).
- `diagnose` — si algo runtime falla en la validación incógnito.
- `grill-me` — stress-test si dudas del diseño del check (pre-tx vs dentro de tx).
- `handoff` — cerrar la próxima sesión.

---

## Próxima sesión — arranque

PASO 0 read-only del guardarraíl **P1-bis**: trazar `voidCoil` (ya conocido del recon de hoy — lee solo `coils/{coilId}`, sin query de hijos actualmente), confirmar el filtro de "hijo vivo" (`status != VOIDED` ¿suficiente?), decidir ubicación del check (pre-tx vs dentro de runTransaction). Preguntar si la semántica de "hijo vivo" no está explícita en CLAUDE.md. Subir `CLAUDE.md` v6.11 + este HANDOFF.
