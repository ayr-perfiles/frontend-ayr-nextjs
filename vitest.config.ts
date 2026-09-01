import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    fileParallelism: false, // Evita colisiones de BD emulador entre suites de integración
    testTimeout: 15000, // suite creció (100+ tests int.), default 5s insuficiente al final de la corrida por carga acumulada del emulador.
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      'functions/lib/**',
      // Dependen de un emulador (@firebase/rules-unit-testing / cliente conectado a
      // 127.0.0.1:8080) que "npm run test" bare no levanta.
      //
      // Este exclude es el que hace HONESTO a `npm run test`: sin él, un emulador
      // huérfano vivo por accidente pinta de VERDE tests que sin emulador debían
      // fallar (medido en v6.57.0: 118 archivos con huérfano vivo vs 117 sin él,
      // mismo commit, mismo comando — cobertura no determinista, ver CLAUDE.md).
      //
      // Las 3 entradas de abajo NO se corren en este config. Sus custodios son
      // test:emu:rules / test:emu / test:emu:functions, que usan vitest.emu.config.ts
      // (config hijo que hereda todo de acá y solo levanta este exclude para esas 3).
      //
      // TRAMPA: un filtro posicional de CLI (ej. `vitest run src/test/rules`) NO
      // rescata lo que este exclude ya descartó — el exclude gana sobre el filtro de
      // ruta. Por eso existe vitest.emu.config.ts en vez de pasar el filtro a mano.
      //
      // Agregar una entrada acá SIN darle custodio en vitest.emu.config.ts = borrar
      // esa cobertura del repo en silencio (el síntoma es "No test files found",
      // que se lee como un cero inofensivo y no como un directorio huérfano).
      '**/src/test/rules/**',
      '**/src/test/integration/**',
      '**/functions/src/callables/**',
      // [E2E-HARNESS] (COLA #6, v6.90.0) — specs de Playwright.
      //
      // El `include` de arriba es `**/*.{test,spec}.*`, o sea que SIN esta
      // entrada `npm run test` levantaría `e2e/*.spec.ts` con vitest y moriría
      // importando `@playwright/test`. Medido y predicho ANTES de agregarla.
      //
      // Su CUSTODIO es `npm run test:e2e` (config propia en
      // `e2e/playwright.config.ts`), no `vitest.emu.config.ts` — es la única
      // entrada de este exclude cuyo custodio vive fuera de vitest. Cumple la
      // condición que el comentario de arriba exige: ninguna entrada acá sin
      // custodio propio, o se borra la cobertura en silencio.
      '**/e2e/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'src/types/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
