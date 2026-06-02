# Handoff — AYR Steel ERP (siguiente conversación)

> Subir SIEMPRE al inicio: este `HANDOFF.md` + `CLAUDE.md` (v6.4).
> Preferencias (en memoria): generar **prompts para Claude Code** por defecto, NO archivos salvo estrictamente necesario. Antes de generar, si hay dudas → **preguntar primero**.

---

## Estado actual — v6.4

### Lo nuevo de esta sesión (Sprint 8)

**1. Módulo Facturación Electrónica SUNAT (Cloud Functions v2)**
- Emisión DIRECTA (cert `.p12` + SOL propios), reutilizando proyecto de referencia funcional (`sunat/`).
- Secretos en Secret Manager (`defineSecret`), binding mínimo por callable. `ALL_SECRETS` eliminado.
- Colección `integrations` (config no-secreta): `sunat-emision`, `sunat-consulta`, `apisnet`, `algolia`.
- Callables: `emitirComprobante`, `comunicarBaja`, `consultarEstadoBaja` (Factura/Boleta/Baja); `validarCpeSunat` (validez oficial SUNAT); `consultarRuc`/`consultarDni` (decolecta.com).
- **Funcionando:** consultas RUC/DNI (tras migrar apis.net→decolecta y arreglar serverTimestamp + binding mínimo).
- **Pendiente:** prueba real de emisión contra SUNAT BETA (requiere `.p12` válido cargado).

**2. Refactor Importador Masivo de Ventas** — en curso, cola de prompts (abajo).

### Archivos clave tocados / creados
- `functions/src/config/secrets.ts` (defineSecret, sin ALL_SECRETS).
- `functions/src/config/integrations.ts` (getIntegrationConfig, tipado por integración, sin `any`).
- `functions/src/index.ts` (initializeIntegrations seed + callables + triggers audit).
- `functions/src/services/apisnet.ts` (decolecta v1, RUC/DNI).
- `functions/src/callables/integrations.ts` (consultarRuc/Dni — fix serverTimestamp + binding `[APISNET_TOKEN]`).
- `functions/scripts/seedIntegrations.ts` (seed standalone para emulador).
- `src/components/sales/BulkUploadSales.tsx` → migrando a página `/admin/sales/import`.
- `public/templates/Plantilla_Importacion_Ventas_AYR.xlsx` (plantilla cliente, 15 columnas).

---

## Cola de prompts — Importador de Ventas (ORDEN DE APLICACIÓN)

> 14 ya aplicado. Aplicar en este orden. 19 y 20 DESCARTADOS (el 21 los reemplaza).

1. **PROMPT 15** — Página propia `/admin/sales/import` + descarga plantilla + drawer de columnas + validación de archivo vacío + alta de SKU faltante (form completo por línea).
2. **PROMPT 14** ✅ APLICADO — Peso por UM (`calcPesoKg`) + manejo NC/ND + TC sin fallback silencioso.
3. **PROMPT 22** — Rename de atributos a inglés (`documentType`, `unitOfMeasure`, `adjustedDocument`) SOLO nombres, valores en español; ELIMINAR `affectaStock`.
4. **PROMPT 21** — `ncStockAction` (enum inglés `RETURNS_STOCK`/`MONEY_ONLY`/`UNDECIDED`) + arreglar propagación (quedaba "NADA") + peso NETO de inventario ramificado por acción + test Fase 2 que distingue ramas.
5. **PROMPT 16** — Idempotencia anti doble-import: leer `sales/{documentNumber}` dentro del `runTransaction`; omitir si existe. Test doble-corrida = stock baja una vez.
6. **PROMPT 17** — Preview: badge moneda+TC por ítem + decisión inline de NC sin definir.
7. **PROMPT 18** — Barra de indicadores totales (recalculo en vivo, alertas gobiernan Guardar).

(Nota: el orden lógico es 15 → 22 → 21 → 16 → 17 → 18; el 14 ya está. Ajustar si en desarrollo conviene.)

---

## Frentes abiertos (prioridad)

| Frente | Estado | Detalle |
|---|---|---|
| 🏗️ **Sprint 8 — Import Ventas** | En curso | Cola de prompts arriba. Revisar cada uno en desarrollo. |
| 🟡 **Emisión SUNAT prueba real** | Pendiente | Cargar `.p12` válido + probar sendBill contra BETA. |
| 🔴 **Sprint 6B — Producción Metallic** | BLOQUEADO | 3 preguntas al cliente (kg vs ML×peso; plan previo vs directo; merma despunte). |
| 🔴 **Sprint 7 — Seguridad** | Deuda crítica | `firestore.rules` por colección+rol (hoy 100% abierta) + writes críticos a Functions. |
| 🟡 Validación CPE compras (UI) | Pendiente | Botón "Validar en SUNAT" sobre `purchases` usando `validarCpeSunat`. |

---

## Notas técnicas / trampas conocidas

- **Recompilar Functions** (`npm run build`) tras editar TS — el emulador corre `lib/*.js`.
- **Emulador + secretos:** valores en `functions/.secret.local`; cada secreto bindeado necesita su línea (dummy si no se prueba). firebase-tools ≥ 13.15.1.
- **Emulador arranca Firestore vacío:** correr `npm run seed:emulator` o no existe `integrations` → callables fallan con "Integración no encontrada".
- **Validez CPE:** confirmar grant OAuth (`client_credentials` vs `password`) contra el manual oficial antes de cablear `validarCpeSunat`.
- **NC:** SUNAT NO da el motivo → `ncStockAction` lo decide el usuario, no se adivina.
- **TC:** sin fallback 3.75; si falla la API, bloquear y avisar.

---

## Convenciones (recordatorio)

- 0 `any` nuevos · **nombres en inglés, valores/datos y errores de usuario en español** · patrón Strategy (no if/else por línea) · `runTransaction` lee antes de escribir · stock negativo permitido (warning).
- Build 100% verde, `tsc --noEmit` limpio.
- NUNCA borrado físico: status ANULADA/VOIDED + audit_logs.
- Secretos: solo Secret Manager, nunca Firestore/UI. Binding mínimo por callable.
- Tests: Fase 1 (sin emulador, lógica/strategies) + Fase 2 (emulador Firestore, transacciones/E2E).

---

## Próximo paso sugerido

Aplicar la cola del importador (15 → 22 → 21 → 16 → 17 → 18), probando cada uno en desarrollo. En paralelo, cuando haya `.p12` válido, probar emisión contra BETA. Luego retomar Sprint 7 (seguridad) para bajar la deuda crítica.
