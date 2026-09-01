/**
 * GSM Design Kit — preset de Tailwind v3, envoltorio tipado.
 *
 *   // tailwind.config.ts
 *   import { gsmPreset } from "./design-kit/tokens/tailwind-preset";
 *   export default { presets: [gsmPreset], content: [...] } satisfies Config;
 *
 * La definición vive en `tailwind-preset.js` (JavaScript puro, para que la
 * pueda cargar cualquier `tailwind.config.*`). Aquí solo se le pone tipo, sin
 * depender de los tipos de `tailwindcss`, que no es dependencia del kit.
 *
 * En Tailwind v4 no hace falta preset: importa `styles/globals.css`.
 */
import preset from "./tailwind-preset.js";

export type GsmPreset = {
  darkMode: string[];
  theme: {
    extend: {
      colors: Record<string, string | Record<string, string>>;
      borderRadius: Record<string, string>;
      fontFamily: Record<string, string[]>;
      keyframes: Record<string, Record<string, Record<string, string>>>;
      animation: Record<string, string>;
    };
  };
};

export const gsmPreset: GsmPreset = preset as GsmPreset;

export default gsmPreset;
