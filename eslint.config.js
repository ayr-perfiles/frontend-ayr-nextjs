import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import next from "@next/eslint-plugin-next";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@typescript-eslint": typescript,
      react: reactPlugin,
      "react-hooks": reactHooks,
      "@next/next": next,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser, // ← fix 339 no-undef (window, document, etc.)
        ...globals.node, // ← process, __dirname, etc.
        ...globals.es2021, // ← Promise, Map, Set, etc.
      },
    },
    rules: {
      // ── TypeScript ──────────────────────────────────────
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      // ── Desactivar reglas JS base (TypeScript las reemplaza) ──
      "no-undef": "off", // ← TypeScript maneja esto mejor
      "no-unused-vars": "off", // ← usar solo la versión TS arriba

      // ── React ────────────────────────────────────────────
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // ── General ──────────────────────────────────────────
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    ignores: [
      "node_modules/",
      ".next/",
      "out/",
      "build/",
      "dist/",
      "coverage/",
      ".vercel/",
      "next.config.ts",
      "vitest.config.ts",
      "postcss.config.js",
    ],
  },
];
