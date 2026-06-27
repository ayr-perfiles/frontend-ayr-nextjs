# Handoff — AYR Steel ERP (Siguiente Sesión)

> **Subir SIEMPRE al inicio:** este `HANDOFF.md` + `CLAUDE.md` (v6.10).
> **Foco próxima sesión:** Sprint 7 (Seguridad Capa 2 / Candado final) — Migrar writes críticos a Cloud Functions y cerrar las reglas relajadas de Firestore (Fase 2).
> **Preferencias (MANTENER):** Prompts de Claude Code por defecto. Caveman mode. Cada prompt con PASO 0 read-only. Preguntar ante cualquier duda. NUNCA dar por cerrado en verde sin validación en RUNTIME (tsc y tests verdes son necesarios, pero no suficientes para capturar todos los problemas en producción).

---

## 1. Estado al cerrar esta sesión

Todo el trabajo de la sesión anterior quedó **VIVO Y VALIDADO EN RUNTIME EN PRODUCCIÓN (ayrsteel-2026)**, no solo con build verde.

- **Seguridad Capa 1:** Desplegada y validada en PROD. Custom claims de roles configurados para 4/4 usuarios clave (`frankrodrimilla` ADMIN, `doramc68` SUPERVISOR, `gsinuiri` ADMIN, `aalvarez` ADMIN). La anulación de ventas en cadena (`status` + `stock` + `movements`) funciona perfectamente en producción sin errores de `permission-denied`.
- **Incendio de Índices:** Apagado por completo. Se corrigió el archivo de índices y se desplegaron los 9 índices nuevos necesarios en PROD (frente de índices cerrado).
- **Migración de Bobinas (Coils):** Aplicada exitosamente en PROD. 41/41 bobinas actualizadas a `finish=GALV` y `densityFactor=0.00785`. El backup de seguridad local fue verificado, y la lógica de cálculo peso ↔ ML opera correctamente en producción.
- **Seguridad Parcial ("Medio Muro"):** Las reglas de la Fase 1 están activas en producción. Sin embargo, los campos operativos (`sales.status`, `coils/*`, `*_stock` de inventarios) siguen mutables temporalmente por el cliente (relajados). El muro se cerrará por completo en la próxima sesión.

---

## 2. Decisiones Lockeadas (NO revertir)

- **Densidad por Acabado (coil_finishes):** GALVANIZADO 0.00785, Aluzinc NATURAL 0.00785, Aluzinc colores 0.008. No hardcodear.
- **Unicidad de Índices:** `firestore.indexes.json` es la única fuente de verdad declarativa de edición MANUAL ADITIVA. No sobrescribir con dumps automatizados.
- **Backups:** Dado que `gcloud` CLI no está disponible, los backups de Firestore para colecciones pequeñas se hacen localmente en formato JSON y se almacenan en la carpeta `scripts/` (gitignored).

---

## 3. Foco Próxima Sesión: Sprint 7 (Seguridad Capa 2 / Candado Final)

La meta de la próxima sesión es llevar la seguridad a su estado final:
1. **Migración de Writes Críticos a Cloud Functions:**
   - `splitCoilAction`
   - `produceFromCoils`
   - `voidProductionFromCoils`
   - `registerCoilScrap`
   - Flujos de creación y anulación de ventas.
2. **Cierre de Reglas (Fase 2):**
   - Una vez que las Functions gestionen estas escrituras de manera segura desde el servidor, cerrar las reglas relajadas de Firestore (`sales.status`, `coils`, `*_stock`) a `if false` para escrituras directas del cliente.

---

## 4. Pendientes en Cola (Roadmap)

- 🔴 **DEUDA ÍNDICES (auditoría sesión v6.10, NO desplegados por decisión):** 6 queries sin índice declarado ni vivo — REVIENTAN en runtime al ejercerlas:
  - **CRÍTICAS:** 
    1. `listAvailableCoils` `[coils: status ASC, finish ASC, currentWeight ASC, createdAt DESC]` → rompe iniciar producción Drywall/Roofing.
    2. `MovementsModal` `[strips_movements: widthMm ASC, timestamp DESC]` → rompe historial flejes.
    3. Catálogos `trading_catalog` + `roofing_catalog` `[active ASC, displayName ASC]` → rompe listado UPVC/Trading.
  - **CONDICIONAL:** 
    4. `listCoils` filtros `metadata.currency/provider` → combinatoria grande; resolver por restricción de UI o vía aggregates/Algolia, NO declarar 15 índices.
  - **LIMPIEZA:** 
    5. El fantasma `sales[status, timestamp, totalAmount, totalProfit, totalWeight]` declarado sin consumidor (`sum()` no se indexa) → borrar del archivo en commit de limpieza.
  *Definiciones exactas ya derivadas de las queries. Aplicar antes de que un usuario las tope en prod.*
- **Verificaciones del Import Masivo:** Probar el import con un CSV real de 55 ítems y validar que la densidad se asigne correctamente y se detecten decimales.
- **Seguridad & Infraestructura:**
   - Actualizar Next.js de `16.1.7` → `16.2.6` (parchea 13 CVEs, incluyendo 3 de bypass de autenticación).
   - Configuración de session cookies y proxy de rutas en `proxy.ts`.
- **Estandarización UI (Grupo 2):** Tablas server-side de Kardex, Usuarios, Compras y Producción Drywall usando paginación por cursor y agregaciones consistentes.
- **Backlog Cosmético:**
   - Renombrar o mantener consistencia de `piecesProduced`.
   - Modificar redirecciones en `next.config` de `permanent: true` a `false` (307) para evitar caché persistente en navegadores.
   - Migración transversal de la línea `ACCESORIO` a `Trading`.

---

## 5. Aprendizajes Meta de la Sesión

- **Paso 0 Read-Only + Re-diff:** Esta práctica estricta previno 3 desastres silenciosos en esta sesión:
  1. Evitó corromper las 41 bobinas con densidad `undefined`.
  2. Evitó borrar el índice crítico de reportes de ventas.
  3. Evitó borrar el índice huérfano de `coils`.
- **Grep Preventivo:** Antes de declarar "es seguro, no hay consumidores", se verificó exhaustivamente con `grep` en toda la base de código.

---

## 6. Suggested Skills

- `grill-me`: Para realizar stress-test y alineación sobre el plan del Sprint 7 de Cloud Functions.
- `tdd`: Para desarrollar las Cloud Functions interactivamente usando el emulador y tests de integración.
- `diagnose`: Ante cualquier comportamiento extraño o bug en runtime.
- `handoff`: Para cerrar sesiones futuras de forma estructurada.

---

## 7. Deuda Técnica (Anotadas durante separación de codebases)

- `correlative.ts` DUPLICADO en `functions/` y `functions-sunat/` (separación codebases). Riesgo divergencia (lección classifyLine). Resolver: paquete compartido o test de paridad.
- `ayrsteel-TEST`: functions SUNAT/purchases huérfanas en codebase default viejo (deploy dijo N a borrar). Limpiar test antes de desplegar codebase sunat ahí.
