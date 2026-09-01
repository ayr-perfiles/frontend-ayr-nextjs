/**
 * GSM Design Kit — preset de Tailwind **v3**.
 *
 *   // tailwind.config.js
 *   import gsmPreset from "./design-kit/tokens/tailwind-preset.js";
 *   export default { presets: [gsmPreset], content: [...] };
 *
 * Este archivo es JavaScript puro para que lo pueda cargar cualquier
 * `tailwind.config.{js,cjs,mjs,ts}`. `tailwind-preset.ts` es un envoltorio
 * tipado sobre este mismo objeto: hay una sola fuente de verdad.
 *
 * En **Tailwind v4 no se usa preset**: basta con importar
 * `styles/globals.css`, que ya trae `tokens/theme.css` con el bloque
 * `@theme inline`. Ver README.
 *
 * Los colores se emiten con `color-mix()` y el marcador `<alpha-value>` de
 * Tailwind, de modo que los modificadores de opacidad (`bg-primary/80`,
 * `ring-ring/50`) que usan los componentes del kit sigan funcionando en v3
 * pese a que las variables guardan colores `oklch()` completos.
 *
 * Los valores viven en `tokens/theme.css`; el preset solo los referencia por
 * variable, así que el modo oscuro sigue siendo un `.dark` en el `<html>`.
 */

/** @param {string} variable */
function themeColor(variable) {
  return `color-mix(in oklab, var(${variable}) calc(<alpha-value> * 100%), transparent)`;
}

const gsmPreset = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        background: themeColor("--background"),
        foreground: themeColor("--foreground"),
        card: {
          DEFAULT: themeColor("--card"),
          foreground: themeColor("--card-foreground"),
        },
        popover: {
          DEFAULT: themeColor("--popover"),
          foreground: themeColor("--popover-foreground"),
        },
        primary: {
          DEFAULT: themeColor("--primary"),
          foreground: themeColor("--primary-foreground"),
        },
        secondary: {
          DEFAULT: themeColor("--secondary"),
          foreground: themeColor("--secondary-foreground"),
        },
        muted: {
          DEFAULT: themeColor("--muted"),
          foreground: themeColor("--muted-foreground"),
        },
        accent: {
          DEFAULT: themeColor("--accent"),
          foreground: themeColor("--accent-foreground"),
        },
        destructive: {
          DEFAULT: themeColor("--destructive"),
          // El tema no define `--destructive-foreground`; los componentes
          // escriben `text-white` sobre destructive, igual que en GSM.
          foreground: themeColor("--background"),
        },
        border: themeColor("--border"),
        input: themeColor("--input"),
        ring: themeColor("--ring"),
        chart: {
          1: themeColor("--chart-1"),
          2: themeColor("--chart-2"),
          3: themeColor("--chart-3"),
          4: themeColor("--chart-4"),
          5: themeColor("--chart-5"),
        },
        sidebar: {
          DEFAULT: themeColor("--sidebar"),
          foreground: themeColor("--sidebar-foreground"),
          primary: themeColor("--sidebar-primary"),
          "primary-foreground": themeColor("--sidebar-primary-foreground"),
          accent: themeColor("--sidebar-accent"),
          "accent-foreground": themeColor("--sidebar-accent-foreground"),
          border: themeColor("--sidebar-border"),
          ring: themeColor("--sidebar-ring"),
        },
      },
      borderRadius: {
        sm: "calc(var(--radius) * 0.6)",
        md: "calc(var(--radius) * 0.8)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) * 1.4)",
        "2xl": "calc(var(--radius) * 1.8)",
        "3xl": "calc(var(--radius) * 2.2)",
        "4xl": "calc(var(--radius) * 2.6)",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "var(--font-geist-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
        heading: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
};

export default gsmPreset;
export { gsmPreset };
