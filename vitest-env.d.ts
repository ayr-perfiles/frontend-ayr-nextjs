/// <reference types="vitest/globals" />

// `vitest.config.ts` corre con `test.globals: true`, así que `describe`/`it`/`expect`/`vi`
// existen en runtime sin importarlos. Sin esta referencia, `tsc --noEmit` no los conoce y
// marca TS2304 en todo test que use la forma global (36 errores repartidos en 3 archivos).
//
// Se declara acá, en un `.d.ts` aditivo, y NO como `compilerOptions.types` en tsconfig.json:
// setear `types` desactivaría la inclusión automática de TODOS los demás @types del proyecto
// (incluidos los de Next), que hoy se resuelven por defecto.
