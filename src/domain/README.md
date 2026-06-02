# Domain — Lógica pura

Código de dominio **sin dependencias de Firebase ni librerías externas**.
100% testeable con tests unitarios puros.

Ejemplos:
- `steel/constants.ts` — constantes físicas y de negocio
- `steel/density.ts` — fórmula de densidad siderúrgica
- `pricing/igv.ts` — cálculo de IGV
- `shared/Result.ts` — tipo Result<T, E> para manejo de errores

✅ Todo aquí debe tener su `.test.ts` correspondiente.
