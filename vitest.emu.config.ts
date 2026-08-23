import { defineConfig } from 'vitest/config'
import rootConfig from './vitest.config'

// Hereda TODO del config de raíz (vitest.config.ts) y anula ÚNICAMENTE las 3
// entradas de emulador del exclude. Verificado campo por campo con el loader
// de Vite (v6.57.0): el único delta entre padre e hijo es `exclude` —
// coverage/environment/fileParallelism/globals/include/setupFiles/testTimeout/
// plugins/resolve.alias son idénticos.
//
// NO redeclarar setupFiles/environment/alias/plugins acá a mano: se heredan
// vía el spread de `rootConfig` de abajo. Duplicarlos los hace derivar en
// silencio la próxima vez que alguien toque solo uno de los dos archivos.
//
// Este es el config que usan los scripts test:emu / test:emu:functions /
// test:emu:rules / test:integration, que SÍ corren dentro de
// `firebase emulators:exec` — así que acá el exclude tiene que dejar pasar
// los 3 directorios que el padre bloquea. Se derivan por FILTRO del exclude
// original (no se reescribe la lista a mano) para no poder divergir del
// padre en las demás entradas.
//
// OJO: NO usar mergeConfig(rootConfig, {test:{exclude:...}}) para esto —
// vite/vitest mergeConfig CONCATENA arrays en vez de reemplazarlos, así que
// el exclude original (con los 3 patrones puestos) habría sobrevivido
// pegado al final igual, dejando el problema intacto. Por eso acá se arma
// el config hijo con spread directo + exclude explícito, no con mergeConfig.
const EMULATOR_ONLY_DIRS = [
  '**/src/test/rules/**',
  '**/src/test/integration/**',
  '**/functions/src/callables/**',
]

export default defineConfig({
  ...rootConfig,
  test: {
    ...rootConfig.test,
    exclude: (rootConfig.test?.exclude ?? []).filter(
      (pattern) => !EMULATOR_ONLY_DIRS.includes(pattern)
    ),
  },
})
