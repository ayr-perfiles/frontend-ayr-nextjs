# Handoff — AYR Steel ERP (Siguiente Sesión)

> **Subir SIEMPRE al inicio:** este `HANDOFF.md` + `CLAUDE.md` (v6.10).
> **Preferencias (MANTENER):** Prompts de Claude Code por defecto. Caveman mode. Cada prompt con PASO 0 read-only. Preguntar ante cualquier duda. NUNCA dar por cerrado en verde sin validación en RUNTIME.

---

## Estado Sprint 7 (cierre de sesión)
4 writes cerrados en test esta sesión. Migración de escrituras cliente → Callables.

- **WRITE 1 (registerCoilScrap): CERRADO test+prod.** Callable ACTIVE en ambos. Rule `scrap_logs` candada (`if false`) en TEST. ⚠️ **PENDIENTE:** verificar/cerrar rule `scrap_logs` en PROD (se cerró en test, confirmar master).
- **WRITE 2 (registerCoilSplit): CERRADO test.** Idempotencia (`idempotency_keys`, `requestId` `useRef` por-intento). Commits `a8f6f285` + `d7d510e4`. PROD DIFERIDO.
- **WRITE 3 (voidCoil/updateCoil/cancelCoilPlan): CERRADO test.** Agujero `currentWeight` cerrado (derivado backend). Commits `e5a58ba3` + `077c0be7`. PROD DIFERIDO.
- **WRITE 4 (produceFromCoils metallic/Aluzinc): CERRADO test.** Multi-coil atómico, WAC server-side validado runtime (`avgCost` 7.32 = cálculo a mano), `perCoilBreakdown`, `reportedWeightKg` cubierto, idempotencia. Strategy + dominio portados con paridad. Commits `fb3d2436` + `fd1b7f11`. PROD DIFERIDO.

---

## Inerte (no cuenta para candado)
- **`consumeCoil` / `processSingleStrip`:** DEPRECADO (modelo viejo bobina-directa). Pestaña PRODUCE de Terminal Móvil deshabilitada (commit `79f521c0`). Código inerte. DESTINO FINAL pendiente (borrar vs actualizar a flejes) — decidir al cierre del sprint. Tests `drywallProduction.test.ts` / `e2e.test.ts` aún lo cubren (revisar).

---

## Alcance REAL del candado (descubierto esta sesión — más grande que el plan original)
Candar `coils`/`kardex`/`audit` requiere migrar TODOS los escritores, no solo producción:
- **`coils` faltan:** `cutOrder` (`sendToCut`/`receiveStrips`/`voidCutOrder`/`updateSentOrder`) + UIs creación (`AddCoilForm`/`BulkUploadCoils`/`PurchaseCoilFromXml`) + `salesService`.
- **`kardex_movements` faltan:** `cutOrder` + `salesService` + `produceFromStrip` (drywall) + reversas metallic.
- **`audit_logs` faltan:** `cutOrder` + `salesService` + `productionService` + `settingsService`.
Ninguna rule se cierra hasta migrar sus escritores. Es multi-sprint.

---

## Orden propuesto writes restantes (reco)
- **WRITE 5:** `produceFromStrip` (drywall) — gemelo de WRITE 4, reusa Strategy/patrón, barato. Escribe kardex.
- **WRITE 6:** altas de coils (`AddCoilForm`/`BulkUpload`/`PurchaseXml`).
- **WRITE 7:** reversas (`voidProductionFromCoils` metallic+drywall) — congelan costo del `production_log`.
- **WRITE 8:** `cutOrder` (monstruo: WAC+prorrateo, 5 funciones) — al final, patrón maduro.
- **WRITE 9:** `salesService` (payload crítico precio/correlativo) — al final.
- Luego: candar rules `coils`/`kardex`/`audit` cuando cada colección tenga 0 escritores cliente.

---

## Patrones establecidos (reusar en writes 5+)
- Callable `onCall` v2, thin client/fat backend. Cliente manda solo metadata física, backend recalcula TODO valor (peso/costo/WAC) — nunca aceptar del cliente.
- Dominio puro portado a `functions/` con test de paridad + **ANCLA DE CORRECTITUD** (valor calculado a mano, no solo front===back).
- `idempotency_keys/{requestId}` DENTRO de la transacción para writes que CREAN (split/produce). `requestId` `useRef(null)` por-intento, reset-on-success. No para writes que solo mutan status (void/update/cancel — precondición protege).
- **Roles:** `ADMIN` + `SUPERVISOR` para admin (void/update/cancel). `OPERATOR` + `ADMIN` + `SUPERVISOR` para producción.
- Tipos duplicados `functions/` vs `src/` con sync-marker EN AMBOS lados.
- Esquema audit canónico (`action`/`entityId`/`userEmail` token/`details`/`timestamp`).

---

## Reglas reforzadas esta sesión
- Validar runtime de frontend SIEMPRE en **INCÓGNITO** (bundle SPA cacheado ejecuta código legacy horas tras deploy). Discriminadores de Callable nueva: campos que solo el backend nuevo genera (`densityFactor`, `splitId`, `perCoilBreakdown`, `idempotency_key`).
- **NUNCA force-push a develop** (cosmética no lo justifica). Esta sesión hubo uno benigno pero es riesgo. Commits aditivos.
- Test de paridad necesita ancla de correctitud (valor a mano), no solo paridad front===back — ambos lados pueden estar igual de mal.
- Reforzar asserts: contar documentos (idempotencia), verificar rollback TOTAL (todo-o-nada), valores a mano (WAC).
- `GEMINI.md` DEPRECADO — NO citarlo como fuente. Fuente de verdad: `CLAUDE.md` + código.

---

## Deudas registradas
- ⚠️ `scrap_logs` rule candada en test pero ¿en prod? — verificar.
- `GEMINI.md`: auditar vs `CLAUDE.md`, consolidar flujos de negocio a `CLAUDE.md` (v6.11), enterrar `GEMINI.md` (info de negocio puede estar atrapada ahí).
- PROD diferido writes 2/3/4: secuencia obligatoria deploy functions prod → validar incógnito → merge develop→master (backend antes que frontend).
- `_userEmail` no-op en `coilService` (limpiar con `page.tsx`).
- `CoilStatus` + tipos production duplicados `functions/` (sync-markers puestos).
- `idempotency_keys` sin TTL/limpieza.
- Audit "200 u" cosmético en `COBERTURA_ML` (debería ser ML).
- `coilDensityFactor` singular en `production_logs` (solo 1ra bobina; real está en `perCoilBreakdown`).
- `.vercelignore` `functions-sunat` en develop, MASTER sin el fix (verificar próximo merge).
- `ProduceTab` destino final + tests que cubren flujo muerto.
- 6 índices Firestore sin desplegar (de HANDOFF previo).
- Huérfanas SUNAT en codebase default test (`initializeIntegrations`).

---

## Próxima sesión
Arranca: **WRITE 5** = `produceFromStrip` (drywall). PASO 0 read-only primero. Subir `CLAUDE.md` v6.10 + este `HANDOFF.md`.
Caveman. Prompts Claude Code default. Nunca verde sin runtime incógnito. Pregunta ante ambigüedad de negocio.
