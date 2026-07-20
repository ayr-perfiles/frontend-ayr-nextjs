# Handoff — AYR Steel ERP (Siguiente Sesión)

> Subir SIEMPRE al inicio: este HANDOFF + CLAUDE.md (v6.23).
> Preferencias: Prompts Claude Code por defecto. Caveman mode. PASO 0 read-only en cada prompt.
> Preguntar ante duda de negocio. NUNCA cerrar en verde sin RUNTIME (lo corre el USUARIO, no Claude).
> npm run build LOCAL antes de merge a master. Un frente a la vez, confirmar cierre antes de seguir.
> backend en prod antes que master.

## DEUDAS / HORIZONTE
- **DEUDA PREEXISTENTE PROBADA (NO regresión, triaje aparte):** 4 archivos test rojos en base `79d62182` — functions-sunat×2 (falta npm install subdir), coilRegistration (requestId idempotencia v6.22), metallicProduction (hard-gate cotización v6.22). Fuera de scope 7b.
- **HORIZONTE:**
  - **forward-fix:** congelar `coilWeightConsumedKg` en `consumeCoil` (mirror metallic) → elimina `approximateWeight` de logs NUEVOS. El peso re-derivado miente post-split.
  - **7a untracked tests:** (`drywallRevert` unit+integration) — commit aparte, valor regresión strips_stock.
  - **WRITE 8 cutOrder:** el "monstruo" 5 funciones. Acá vive el modelo real de flejes + lote-por-bobina.
  - **WRITE 9 salesService.**

## REGLAS GRABADAS (aprendidas esta sesión)
- **NUNCA** script que reimplemente lógica de callable saltándose guards contra prod. Si el callable bloquea, es la respuesta correcta → reportar, no eludir. Runtime valida el callable como los usuarios.
- **Guard laterSales** = contabilidad correcta, NO se toca. "Anular con ventas posteriores" = decisión de negocio separada (¿reversar ventas?), no quitar guard.
- **Antes de cambio grande:** leer `docs/modules/<módulo>.md` + grep escritor vivo + leer 1 doc real de prod.
- **Runtime prod desvía del plan:** → PARAR y reportar, no improvisar camino alterno.
