# Handoff — AYR Steel ERP (Siguiente Sesión)

> Subir SIEMPRE al inicio: este HANDOFF + CLAUDE.md (v6.12).
> Preferencias: Prompts Claude Code por defecto. Caveman mode. PASO 0 read-only en cada prompt.
> Preguntar ante duda de negocio. NUNCA cerrar en verde sin RUNTIME incógnito. npm run build LOCAL antes de merge a master.

## 🔴 DEUDA DE INFRAESTRUCTURA — divergencia test↔prod (hallazgo grande de la sesión)
Los entornos DIVERGIERON. Documentado, NO resuelto:
- SUNAT (comunicarBaja, emitirComprobante, validarCpeSunat, importSireRce, parsePurchaseXml,
  confirmPurchaseStaging, consultarRuc/Dni) existe SOLO en ayrsteel-test, NO en prod.
- Algolia (ext-firestore-algolia-search-*) existe SOLO en prod, NO en test.
- Metadata de codebase roto en test: deploy --only functions:default propone BORRAR las 9
  funciones legacy/SUNAT (las ve en default remoto, no en functions/ local). CASI causó borrado masivo.
- ⚠️ REGLA: deploy a test SIEMPRE por función específica: firebase deploy --only functions:NOMBRE
  --project ayrsteel-test. NUNCA --only functions:default. NUNCA --force.
- voidCoil con guardarraíles P1/P1-bis: validado en PROD directo. TEST tiene voidCoil viejo SIN
  guardarraíles (no se actualizó). Paridad pendiente.
- Sanear esto (reconciliar codebases, igualar functions test↔prod) es deuda multi-sprint, pero
  el riesgo de borrado accidental es ALTO hasta resolverlo.

## Cerrado esta sesión ✅
- P1-bis guardarraíl voidCoil (dirección-madre): bloquea anular madre con hijos vivos. Commits
  7b8e0fd2/52d8b92f. Índice compuesto coils(parentCoilId,status) deployado prod. Validado incógnito.
- WRITE 6 mini-ciclo 1 — registerCoil callable: alta de coils server-side. AddCoilForm +
  PurchaseCoilFromXml migrados a thin-client. Recalcula pricePerKg(=totalPEN/weight),
  currentWeight, status, id.toUpperCase(), registeredBy; dedup atómico por existencia de doc
  (already-exists, todo-o-nada por factura); valida finish vs coil_finishes (densityFactor);
  TC USD rango [2,7], PEN→1; gate ADMIN+SUPERVISOR. ACTIVE en prod Y test. Validado en TEST
  pruebas 1-4 (alta pricePerKg=3.0 recalculado, dedup, TC fuera de rango, XML). 95 passed/3 skipped.
- BulkUpload: acceso COMENTADO en HeaderOptions (escribe coils directo; reactivar con mini-ciclo 2).
- seedFinishes() + su botón: ELIMINADOS (ya no se usan). Tabla densityFactor preservada en CLAUDE.md.

## 🔴 ARRANCAR PRÓXIMA SESIÓN — opciones (decidir al inicio)
1. WRITE 6 mini-ciclo 2 = registerCoilsBulk: callable para BulkUpload. Decisión de negocio
   pendiente: ¿atomicidad todo-o-nada (rechazar los ~490 si uno falla) o tolerar fallo parcial
   (migración histórica "lo que entró, entró")? Hoy es Promise.all de batches, NO atómico, sin
   dedup. Tras el callable, reactivar (descomentar) el botón en HeaderOptions.
2. Sanear divergencia test↔prod (deuda infra arriba) — más urgente que WRITE 7+ por el riesgo
   de borrado. Al menos: reconciliar metadata de codebase en test, igualar voidCoil en test.
3. Seguir drenando writes: WRITE 7 (voidProductionFromCoils, costo congelado), WRITE 8 (cutOrder,
   monstruo WAC/prorrateo), WRITE 9 (salesService).

## Deudas vivas
- registerCoil: TC USD validado solo por rango [2,7], no contra fuente de verdad (cliente trae el
  TC de SUNAT API). Atrapa fat-finger grueso, no error fino. Aceptable, anotado.
- Prueba 5 de WRITE 6 (BulkUpload) ya no aplica como "abre OK" — ahora es "botón no visible".
- UI gating P1/P1-bis: botón "Anular" sigue apareciendo en hijos y madres-con-hijos en
  InventoryTable.tsx; rebota con error correcto, pero ocultarlo mejora UX. Cosmético.
- Reversa de split COMPLETA = WRITE separado (resuelve P1+P1-bis de raíz). Diseño grande.
- parsePurchaseXml existe como Cloud Function en test PERO PurchaseCoilFromXml parsea en browser
  (DOMParser). Contradicción/migración a medias — aclarar.
- SPLIT_PARENT status muerto (inalcanzable por guard de ancho). Limpieza pendiente.
- GEMINI.md deprecado, enterrar tras auditoría. 3 tests salesReimport skipped hasta WRITE 9.
- consumeCoil/processSingleStrip inertes. idempotency_keys sin TTL.

## Convenciones (resto en CLAUDE.md)
Caveman. PASO 0 read-only. develop=fuente, master solo merges. Backend prod antes que frontend a
master. npm run build LOCAL antes de merge. Runtime incógnito obligatorio (la hace el usuario, no
Claude — Claude no tiene URL Vercel ni login ADMIN ni navegador con sesión). Deploy a test por
función específica. densityFactor de coil_finishes lookup. Cliente solo metadata física, backend
recalcula todo derivado.

## Suggested skills
tdd (red-green de registerCoilsBulk), diagnose (si runtime falla), grill-me (stress-test atomicidad
bulk), handoff (cerrar próxima sesión).

## Arranque
Decidir entre las 3 opciones. Si mini-ciclo 2: PASO 0 read-only de BulkUploadCoils (parseo regex,
batches, dedup ausente) + decisión de atomicidad. Subir CLAUDE.md v6.12 + este HANDOFF.
