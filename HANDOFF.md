# Handoff — AYR Steel ERP (Siguiente Sesión)

> **Subir SIEMPRE al inicio:** este `HANDOFF.md` + `CLAUDE.md` (v6.10).
> **Preferencias (MANTENER):** Prompts de Claude Code por defecto. Caveman mode. Cada prompt con PASO 0 read-only. Preguntar ante cualquier duda. NUNCA dar por cerrado en verde sin validación en RUNTIME.

---

## 1. Estado del Sprint 7 al cerrar esta sesión

- **WRITE 1 (registerCoilScrap): CERRADO en test Y prod.**
  - Callable ACTIVE en ayrsteel-2026 (prod) y ayrsteel-test. Frontend migrado en master+develop.
  - Rule `scrap_logs` candada (`allow create: if false`) en test. Validado runtime: la rule cerrada actuó como prueba forense de que scrap corre por la Callable (no cliente).
  - *Pendiente prod:* confirmar rule `scrap_logs` candada también en prod (se cerró en test; verificar master).

- **WRITE 2 (registerCoilSplit): CERRADO en test. PROD DIFERIDO.**
  - **Backend:** Callable + dominio `coilPricing` portado con test de paridad (12 casos) + idempotencia vía `idempotency_keys`. Desplegada y ACTIVE en ayrsteel-test. Commits `a8f6f285` (backend) + `d7d510e4` (frontend) en develop.
  - **Frontend:** `splitCoilService` migrado a `httpsCallable`, `runTransaction` cliente borrado. `requestId` idempotente POR INTENTO (`useRef`, reset-on-success) en `SplitCoilModal`.
  - **Runtime test VALIDADO (incógnito):** hija nace con `densityFactor` (del finish, throw si falta), 2 kardex con `splitId` común, `idempotency_key` creada. Los 3 discriminadores confirman ejecución por Callable nueva.
  - **Diseño cerrado:** roles ADMIN+SUPERVISOR, `childId` `${coilId}-S${uuid6}`, status lista-blanca AVAILABLE (dominio única fuente), `densityFactor` sin fallback, guard ruidoso de `currentWeight<=0`.
  - *PENDIENTE PROD (secuencia obligatoria, regla de oro backend-antes-que-frontend):*
    1. `firebase deploy --only functions:default --project ayrsteel-2026` (`registerCoilSplit` a prod)
    2. Validar runtime prod (incógnito, 3 discriminadores)
    3. RECIÉN merge develop→master (frontend llega a prod con backend ya vivo)

- **WRITE 3 (coilService - voidCoil/updateCoil/cancelCoilPlan): CERRADO en test. PROD DIFERIDO.**
  - **Backend:** Callables `voidCoil`, `updateCoil` y `cancelCoilPlan` desplegadas en `ayrsteel-test`.
  - **Seguridad:** Agujero de `currentWeight` cerrado en el backend (se deriva directamente de `initialWeight`, ignorando el del cliente) y se limitaron los campos mutables (*allowlist*).
  - **Frontend:** `coilService.ts` migrado para usar las 3 Callables. Limpieza de imports huérfanos realizada. Compilación (`tsc`) en verde.

- **WRITE 4 (produceFromCoils metallic): CERRADO en test. PROD DIFERIDO.**
  - **Backend:** Callable `produceFromCoils` desplegada y ACTIVE en `ayrsteel-test`. Implementa lógica multi-coil (corrida de conformado consumiendo N bobinas en paralelo en un loop transaccional), cálculo de costo total/unitario ponderado, derivación de peso server-side y cálculo de WAC con lecturas transaccionales seguras.
  - **Frontend:** Servicio de producción de `metallic-roofing` migrado a Callable, eliminando `runTransaction` cliente para el registro. Soporta idempotencia mediante `requestId` y `reportedWeightKg` opcional. Compilación en verde.
  - **Runtime test VALIDADO (incógnito):** Corrida multi-bobina procesada exitosamente. Se comprobó la creación del log de producción con el `perCoilBreakdown` exacto, descuento de peso en ambas bobinas e incremento de stock terminado con WAC recalculado.
  - Commits `fb3d2436` (backend) + `fd1b7f11` (frontend).

---

## 2. Estado de Candados y Escritores Cliente Restantes

El candado de `coils`/`kardex_movements`/`audit_logs` NO se puede cerrar en las Security Rules hasta que se migren TODOS los escritores cliente. Tras la migración de `produceFromCoils`, el mapa actualizado de escritores cliente restantes es:

- **`audit_logs`** (a 1 write principal de coils de candarse):
  - `src/core/coils/services/cutOrderService.ts` (sendToCut, receiveStrips, voidCutOrder, updateCutOrderInvoice, updateSentOrder)
  - *Otros módulos fuera de coils:* `salesService.ts` (ventas/anulaciones), `productionService.ts` (módulos drywall/metallic), `settingsService.ts` (cambios en settings), `sales/import/page.tsx` (re-importación).
- **`coils`**:
  - `src/core/coils/services/cutOrderService.ts` (sendToCut, receiveStrips, voidCutOrder, updateSentOrder)
  - `src/core/coils/components/` (`AddCoilForm.tsx`, `BulkUploadCoils.tsx`, `PurchaseCoilFromXml.tsx` - para registro/alta de bobinas)
  - `src/core/sales/services/salesService.ts` (actualizaciones al vender bobinas/trading)
  - `src/modules/drywall/services/productionService.ts` y `src/modules/metallic-roofing/services/productionService.ts` (para reversas/anulaciones de producción - `voidProductionFromCoils`)
  - *Omitidos:* `consumeCoil` y `processSingleStrip` (marcados como deprecated / inactivos tras deshabilitar la pestaña en la terminal móvil del operador).
- **`kardex_movements`**:
  - `src/core/coils/services/cutOrderService.ts` (movimientos de bobinas)
  - `src/core/sales/services/salesService.ts` (ventas/anulaciones)
  - `src/modules/drywall/services/productionService.ts` (`produceFromStrip` - próximo a migrar en WRITE 5)
  - `src/modules/metallic-roofing/services/productionService.ts` (para reversa/anulación de producción)

---

## 3. Deudas registradas (mantener)

- **Tipos Duplicados (`CoilStatus`):** copiado literal en `functions/` (junto a `correlative.ts`). Sync-marker en `src/types/index.ts`. Paridad NO atrapa divergencia de tipos.
- **`idempotency_keys` sin TTL/limpieza:** → crecen indefinidamente (deuda menor). scrap (WRITE 1) legacy sin idempotencia.
- **Hijas legacy huérfanas sin `densityFactor` en `ayrsteel-test`:** (basura de prueba pre-migración, baja prioridad).
- 🔴 **DEUDA ÍNDICES:** 6 índices Firestore sin desplegar (auditoría v6.10): `listAvailableCoils`, `MovementsModal`, catálogos trading/roofing CRÍTICOS (revientan en runtime). Definiciones exactas ya derivadas (de HANDOFF previo — NO perder).
- **8 secretos SUNAT inexistentes en GCP prod:** → `functions-sunat` no desplegable. `correlative.ts` duplicado. Huérfanas SUNAT en ayrsteel-test.
- **`.vercelignore`:** `functions-sunat` agregado en develop (`8d31935d`). MASTER aún sin ese fix → si el build de prod toca `functions-sunat`, fallará. Verificar/propagar a master en próximo merge.
- **Deuda cosmética `_userEmail`:** Se mantuvo el parámetro `_userEmail` como no-op en las firmas de `coilService.ts` para no romper llamadas en `page.tsx` sin necesidad. Pendiente limpiar en el componente de UI.
- **Deuda cosmética "200 u" en logs de conformado:** La descripción de auditoría inyecta la palabra "piezas" o "u" de forma genérica para `COBERTURA_ML`, lo cual es cosmético pero inconsistente.
- **`coilDensityFactor` singular en `production_logs`:** Se asume y guarda únicamente el factor de densidad de la primera bobina del arreglo en `production_logs`, en lugar de mapear dinámicamente un arreglo para cada bobina consumida.

---

## 4. Lección reforzada esta sesión

- **Validar runtime de frontend SIEMPRE en incógnito:** bundle SPA cacheado puede ejecutar código legacy horas tras el deploy. "Deploy arriba" ≠ "navegador corre lo nuevo". El `densityFactor`/`splitId`/`idempotency_key` sirven como discriminadores de código nuevo vs legacy.
- **El candado de rules sirve como prueba forense:** si una escritura pasa con la rule cerrada, fue la Callable (Admin SDK); si rebota `permission-denied`, era cliente.

---

## 5. Próxima Sesión

Arranca: Planificar la migración de `produceFromStrip` (Drywall - WRITE 5) y las reversas de conformado para remover por completo los escritores de producción restantes, o decidir el despliegue del bloque (WRITE 2, 3 y 4) a producción (`ayrsteel-2026`).
