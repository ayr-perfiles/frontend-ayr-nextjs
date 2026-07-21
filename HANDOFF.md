# Handoff — AYR Steel ERP (Siguiente Sesión)

> Subir SIEMPRE al inicio: este HANDOFF + CLAUDE.md (v6.24).
> Preferencias: Prompts Claude Code por defecto. Caveman mode. PASO 0 read-only en cada prompt.
> Preguntar ante duda de negocio. NUNCA cerrar en verde sin RUNTIME (lo corre el USUARIO, no Claude).
> npm run build LOCAL antes de merge a master. Un frente a la vez, confirmar cierre antes de seguir.
> backend en prod antes que master.

## DEUDAS
- **guard isClosed solo client-side** en `consumeCoil`/`sendToCut` (hermético solo en `produceFromCoils`).
- 4 preexistentes probados: sunat×2, coilRegistration requestId, metallic hard-gate v6.22.

## HORIZONTE (candidatos próximo frente)
- **Reporte supervisor bobinas** (agrupado Abiertas/Stock/Cerradas, peso+metraje por grupo — ver foto usuario).
- **forward-fix** `coilWeightConsumedKg` en `consumeCoil` (drywall, mata `approximateWeight` de logs nuevos).
- **WRITE 8 cutOrder** (monstruo prorrateo, modelo flejes real + lote-por-bobina).
- **WRITE 9 salesService**.

## REGLAS GRABADAS (aprendidas)
- Ejecutor **PARA y espera OK** antes de tocar prod (no ejecutar-y-reportar).
- **NUNCA script que reimplemente callable** saltándose guards contra prod.
- **Guard laterSales NO se toca.**
- Verificar auth Antigravity a ambos proyectos al inicio.
- Sincronizar `develop` con `master` al arrancar.
- "compila/type-check" ≠ GREEN (los tests DEBEN correr con emulador).
- Densidad de `coil_finishes` **nunca** hardcodeada.
