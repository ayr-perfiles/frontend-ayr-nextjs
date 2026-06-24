# Handoff — AYR Steel ERP (Siguiente Sesión)

> **Subir SIEMPRE al inicio:** este `HANDOFF.md` + `CLAUDE.md` (v6.9).
> **Foco próxima sesión:** Validar rules en TEST con roles reales → desplegar seguridad + índices a PROD → continuar Sprint 7 (Functions + candado final).
> **Preferencias:** prompts para Claude Code por defecto. Caveman mode. Cada prompt con PASO 0 read-only. Preguntar si hay duda. NUNCA "build verde" sin verificar RUNTIME (lección dura de esta sesión: tsc verde no atrapa TDZ, redirects, índices faltantes, ni bugs de lógica que los tests sí atrapan).

---

## 1. Estado al cerrar esta sesión (enorme)

Build 🟢, tsc limpio, 463/463 tests (serializados). Commits hechos hasta el fix de zombie. Lo de seguridad (rules Fase 1) desplegado a TEST, no commiteado/pusheado aún del todo — verificar git status.

**Frentes cerrados esta sesión:**

1. Import masivo catálogo aluzinc (COB*/PL*+material, editor por ítem, densityFactor del acabado, length PL sugerido, autodetección decimal + raw:true SheetJS, quitar ítem). Ver CLAUDE.md §4.
2. Multiselect retrocompatible en el kit + filtros tabla catálogo aluzinc. §6.
3. Layout: toggle único + breadcrumb dinámico. Patrón form→página (/production/new). §5.
4. Migración coils: densityFactor desnormalizado + finish=GALV. APLICADO EN TEST (41 bobinas). §9.
5. Unificación tablas Grupo 1 (3 inventarios → useTableData). Piloto Grupo 2: Ventas (cursor + agregación + degradación Algolia + selector). §7.
6. **Seguridad Capa 1:** fix zombie, trigger custom claims (`onUserWritten`), endpoint migrate-roles asegurado, firestore.rules Fase 1 por rol + hardening claim-undefined. Desplegado a TEST. §8.

**Aprendizajes clave de la sesión:**

- El bug "/dashboard 404, solo incógnito" era **caché de redirect 308** del navegador, NO código. Fix: DevTools Disable cache / limpieza profunda.
- Un refactor de `classifyLine` (firma sku,material para catálogo) rompió SILENCIOSAMENTE el import de ventas (compartían la función). Los tests lo atraparon; casi se "alinean" para esconderlo. → función compartida, separar consumidores, no asumir uso único.
- Build de Vercel falla si scripts de migración (con serviceAccountKey) entran al build → excluir en tsconfig.
- Tests: `fileParallelism: false` o colisionan en el emulador.

---

## 2. Decisiones Lockeadas (NO revertir)

- **Densidad por acabado** (coil_finishes, fuente única): GALVANIZADO 0.00785, Aluzinc NATURAL **0.00785** (corregido v6.9, antes decía 0.008), Aluzinc colores 0.008. Heredada vía lookup, nunca hardcodear.
- `perCoilBreakdown` = fuente de verdad por bobina; `parentCoilId` escalar = `parentCoilIds[0]` nunca null.
- Reversa SIEMPRE al costo congelado (venta: baseCost; producción: sum costPEN), nunca WAC actual. Drywall ajeno al WAC en devoluciones.
- Unidad stock aluzinc MIXTA (COBERTURA_ML / PLANCHA_UND); `piecesProduced` ya trae la unidad correcta.
- Import masivo: solo COB*/PL* + material ALUZINC; densityFactor del acabado (no del CSV); raw:true en SheetJS.
- Stock negativo permitido (warning). Sin borrado físico (VOIDED + audit).
- Seguridad: rules = capa real; proxy.ts/guard = UX. Campos snapshot protegidos contra update incluso para ADMIN; audit append-only.

---

## 3. PENDIENTES OPERATIVOS (tu cancha, orden sugerido)

1. **Validar rules en TEST con roles reales** (lo que quedó a medias):
   - Tu claim ADMIN ya está en test. Navega: crear venta, ANULAR venta (toca status+stock+movements en cadena — el caso de mayor riesgo), producir, anular producción, ajustar stock, crear compra → CERO permission-denied en flujos legítimos.
   - Crear usuario OPERATOR (refrescar su token) → opera su línea, y se BLOQUEA en: ver otros users, cambiar roles, editar totalAmount de venta.
   - Si algo legítimo da permission-denied → reportar operación + colección + campo → afinar esa rule.

2. **Desplegar a PROD (solo tras validar test):**
   - Poner claim ADMIN semilla en prod (a mano / trigger).
   - Backfill claims prod (endpoint migrate-roles con JWT ADMIN, o script).
   - `firebase deploy --only firestore:rules --project <prod>`.
   - 🔴 `firebase deploy --only firestore:indexes --project <prod>` — **10 índices (9+SUNAT) NUNCA desplegados a prod. Ventas REVIENTA en prod sin ellos** (el piloto Ventas usa getAggregateFromServer que exige el índice). Construcción en background (minutos) → esperar "Enabled".

3. **Migración coils densityFactor a PROD** (test hecho): verificar coil_finishes/GALV prod tiene densityFactor 0.00785 → backup (gcloud firestore export) → dry-run → --apply.

4. **Verificaciones del import masivo** (si no se hicieron): crear GRIS en coil_finishes (0.008) + probar import con CSV real en test (55 ítems, densityFactor derivado, length PL).

---

## 4. DEUDA / FRENTES GRANDES PENDIENTES

- **Sprint 7 (Seguridad Capa 2 / Fase 2 rules):** migrar writes críticos a Cloud Functions (splitCoilAction, produceFromCoils, voidProductionFromCoils, registerCoilScrap, ventas/anulación). LUEGO cerrar las rules relajadas (sales.status, coils, \*\_stock) a `if false`. Esto convierte las rules en muro real.
- **Capa 2 server-side:** session cookies + proxy.ts. Actualizar Next 16.1.7 → **16.2.6** (13 CVEs, 3 de bypass auth). proxy.ts = UX, no seguridad.
- **Resto Grupo 2 tablas:** Kardex, Usuarios, Compras, Producción Drywall (replican mode cursor + agregación del piloto Ventas; ojo Grupo 2 es server-side, solo unificar visual).
- **Backlog cosmético:** piecesProduced naming; redirects permanent:true→false; HeaderOptionsMenu reuso en sales; ACCESORIO→Trading.
- **Otros:** migraciones densidad; ventas USD sin TC (FFA1-912/913/933); SUNAT BETA .p12; PDF reportes.

---

## 5. Convenciones (recordatorio)

- 0 `any`. Código inglés, UI/errores español. Patrón Strategy. runTransaction lee antes de escribir. Sin borrado físico.
- PEN + kg. USD→PEN TC real. Densidad por acabado. Reversa al costo congelado. Fallo ruidoso (no silencioso).
- Tests serializados (fileParallelism:false) → 463/463. Build Vercel SIN credenciales (scripts excluidos del build). Push a develop dispara Vercel. Credenciales y \*.log en .gitignore.
- **NUNCA cerrar "verde" sin verificación RUNTIME** — el patrón de esta sesión fue que "build verde" ocultó TDZ, redirects, índices faltantes y un bug crítico de classifyLine.

---

## 6. Skills

- `grill-me` (stress-test planes, ej. Sprint 7 Functions).
- `diagnose` (bugs — clave esta sesión).
- `tdd` (Cloud Functions Sprint 7 con tests de integración + emulador rules).
- `handoff` (cerrar sesión).
