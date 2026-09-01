# GSM Design Kit

Sistema de diseño portable extraído de **GSM Inventory**: tokens, componentes
shadcn/ui personalizados y textos de UI genéricos en español. Sirve para que otro
proyecto React o Next.js adopte la identidad visual de GSM sin arrastrar nada de
su negocio.

**Versión:** ver [`VERSION`](VERSION) · **Cambios:** [`CHANGELOG.md`](CHANGELOG.md)
· **Alcance y motivos:** [`DECISIONS.md`](DECISIONS.md)

El kit es **solo presentación**: no conoce inventario, empresas, Supabase, auth,
Server Actions ni el router. Eso lo garantiza un script
([`scripts/check-portability.mjs`](scripts/check-portability.mjs)) que falla si
aparece un import prohibido.

---

## 1. Qué contiene

```
design-kit/
  tokens/
    theme.css            Variables CSS light/dark + @theme inline + variante dark
    tokens.ts            Los mismos valores como datos (gráficos, meta tags, tests)
    tailwind-preset.js   Preset para apps que sigan en Tailwind v3
    tailwind-preset.ts   Envoltorio tipado del anterior
  styles/
    globals.css          Única hoja de entrada: Tailwind + base shadcn + tokens
    shadcn-base.css      Base de shadcn vendorizada (variantes data-*, utilidades)
  components/
    ui/                  33 componentes base de shadcn/ui (estilo radix-nova)
    brand/logo.tsx       Logo + isotipo, parametrizables
    …                    Componentes propios genéricos (ver tabla abajo)
  hooks/                 useIsMobile, useOnlineStatus
  lib/                   cn, initials, csv, contrato LinkLike
  strings/es.ts          Diccionario de UI genérico, tipado y sobreescribible
  config/brand.ts        configureBrand() / getBrand()
  preview/               Catálogo visual + capturas de referencia
  scripts/               check-portability.mjs
  index.ts               Barril de todo el kit
```

### Componentes base (shadcn/ui)

`alert` · `alert-dialog` · `avatar` · `badge` · `breadcrumb` · `button` ·
`calendar` · `card` · `checkbox` · `collapsible` · `command` · `dialog` ·
`dropdown-menu` · `field` · `input` · `input-group` · `label` · `pagination` ·
`popover` · `progress` · `radio-group` · `scroll-area` · `select` · `separator` ·
`sheet` · `sidebar` · `skeleton` · `sonner` · `switch` · `table` · `tabs` ·
`textarea` · `tooltip`

### Componentes propios

| Componente | Para qué |
| --- | --- |
| `Logo` / `LogoMark` | Isotipo + wordmark; nombre e isotipo parametrizables. |
| `ThemeProvider` / `ThemeToggle` | Modo claro / oscuro / sistema con `next-themes`. |
| `PageHeader` | Fila de título, descripción y acciones de cada pantalla. |
| `EmptyState` | Estado vacío con icono, texto y una acción. |
| `ErrorState` | Pantalla de error o "no encontrado" (`page` o `inline`). |
| `ConfirmDialog` | Confirmación de acciones destructivas, con estado pendiente. |
| `FormField` | Etiqueta + control + ayuda + error, sin atarse a react-hook-form. |
| `DataTable` | Envoltura de tabla con borde, scroll y estado vacío. |
| `PaginationNav` + `buildPageHref` | Paginación por enlaces, agnóstica de router. |
| `StatCard` / `StatCardGrid` | Tarjetas de métrica (fila de KPIs). |
| `ExportCsvButton` | Descarga CSV en cliente, con BOM para Excel. |
| `ConnectionStatus` | Aviso de "sin conexión" / "conexión restablecida". |
| `PageSkeleton` y compañía | Esqueletos de carga con las mismas formas del kit. |

---

## 2. Cómo copiarlo a un proyecto destino

1. Copia la carpeta `design-kit/` completa a la raíz del proyecto destino (o a
   `src/design-kit/`, o donde prefieras: todos los imports internos son
   relativos, así que la carpeta se puede mover entera).
2. Instala las dependencias que el kit espera:

   ```bash
   pnpm add react react-dom radix-ui lucide-react class-variance-authority \
     clsx tailwind-merge next-themes sonner cmdk react-day-picker
   pnpm add -D tailwindcss @tailwindcss/postcss tw-animate-css
   ```

   `cmdk` solo hace falta si usas `command`; `react-day-picker`, si usas
   `calendar`.
3. Verifica que sigue siendo portable en su nuevo hogar:

   ```bash
   node design-kit/scripts/check-portability.mjs
   ```

No hay paso de build: el kit se consume como código fuente TypeScript. Es
deliberado — así se puede leer, ajustar y versionar dentro del repo destino.

---

## 3. Tokens y Tailwind

### Tailwind v4 (recomendado, es lo que usa GSM)

No hay preset ni `tailwind.config`. Importa una sola hoja desde el CSS global de
la app:

```css
/* app/globals.css */
@import "../design-kit/styles/globals.css";
```

Eso trae, en orden: `tailwindcss`, `tw-animate-css`, la base de shadcn
(`shadcn-base.css`) y los tokens (`tokens/theme.css`). El propio archivo declara
`@source` sobre las carpetas del kit, así que Tailwind encuentra sus clases
aunque el kit quede fuera del árbol que escanea por defecto.

PostCSS necesita el plugin de Tailwind v4:

```js
// postcss.config.mjs
export default { plugins: { "@tailwindcss/postcss": {} } };
```

### Tailwind v3

Los tokens llegan por preset:

```ts
// tailwind.config.ts
import { gsmPreset } from "./design-kit/tokens/tailwind-preset";

export default {
  presets: [gsmPreset],
  content: ["./src/**/*.{ts,tsx}", "./design-kit/**/*.{ts,tsx}"],
};
```

Y las variables CSS siguen haciendo falta, porque el preset solo las referencia:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
@import "../design-kit/tokens/theme.css";
```

**Equivalencias v4 → v3**

| Tailwind v4 (kit) | Equivalente v3 |
| --- | --- |
| `@import "tailwindcss"` | `@tailwind base/components/utilities` |
| `@theme inline { --color-primary: var(--primary) }` | `theme.extend.colors.primary` del preset |
| `--radius-lg: var(--radius)` | `theme.extend.borderRadius.lg` |
| `--font-sans: var(--font-sans)` | `theme.extend.fontFamily.sans` |
| `@custom-variant dark (&:is(.dark *))` | `darkMode: ["class"]` |
| Opacidad por `color-mix()` (`bg-primary/80`) | `color-mix()` con el marcador `<alpha-value>` que emite el preset |
| `@source "…"` | entradas de `content: [...]` |
| Utilidades `scroll-fade`, `shimmer`, `no-scrollbar` de `shadcn-base.css` | **sin equivalente**: usan `@utility` y `@property` de v4 |

> **Advertencia.** Los componentes del kit se escribieron para v4. El preset
> reproduce colores, radios y fuentes, pero `shadcn-base.css` (las variantes
> `data-open` / `data-closed` / `data-checked`… y las utilidades `scroll-fade` y
> `shimmer`) es sintaxis exclusiva de v4. En un proyecto v3 los estados de
> abierto/cerrado de diálogos, selects y menús se verán sin animación y algún
> estilo puntual faltará. Si el destino está en v3, **actualizarlo a v4 antes de
> integrar el kit sale más barato que parchear esos estilos**.

---

## 4. Montaje en la app

### Modo oscuro y proveedores

```tsx
import { ThemeProvider } from "./design-kit/components/theme-provider";
import { Toaster } from "./design-kit/components/ui/sonner";
import { TooltipProvider } from "./design-kit/components/ui/tooltip";

<ThemeProvider>
  <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
  <Toaster richColors position="top-right" closeButton />
</ThemeProvider>;
```

En Next.js, el `<html>` necesita `suppressHydrationWarning` porque `next-themes`
escribe la clase `.dark` antes de la hidratación.

### Marca

```ts
// brand.config.ts — importado por el layout raíz / el punto de entrada
import { configureBrand } from "./design-kit/config/brand";

configureBrand({
  name: "Mi Producto",
  colors: { primary: "#7c3aed", background: "#ffffff", backgroundDark: "#0a0a0a" },
});
```

Y para casos puntuales, por prop: `<Logo name="Mi Producto" mark={MiIsotipo} />`.
Las props ganan sobre `configureBrand()`.

### Textos

```ts
import { configureStrings, getStrings } from "./design-kit/strings/es";

configureStrings({ common: { save: "Aplicar", delete: "Borrar" } });

const t = getStrings();
t.common.cancel; // "Cancelar"
```

Se fusiona por sección: solo hace falta declarar lo que cambia. Los textos del
kit son **genéricos**; los del dominio de la app viven en su propio diccionario.

### Fuentes

El kit **no carga fuentes**: consume `--font-sans` y `--font-geist-mono`. GSM se
diseñó con **Geist** y **Geist Mono**.

```tsx
// Next.js
import { Geist, Geist_Mono } from "next/font/google";
const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
<html className={`${sans.variable} ${mono.variable}`}>;
```

```css
/* React puro: @fontsource-variable/geist + @fontsource-variable/geist-mono */
@import "@fontsource-variable/geist";
@import "@fontsource-variable/geist-mono";

:root {
  --font-sans: "Geist Variable", ui-sans-serif, system-ui, sans-serif;
  --font-geist-mono: "Geist Mono Variable", ui-monospace, monospace;
}
```

Si no defines nada, se aplica el fallback del sistema: el kit funciona, pero no
es exactamente la tipografía de GSM.

### Enlaces (sin router dentro del kit)

Los componentes que navegan reciben el enlace por prop:

```tsx
import Link from "next/link"; // o { Link } de react-router

<PaginationNav
  page={2} pageCount={7} total={134} pageSize={20}
  href={(p) => buildPageHref("/items", searchParams, p)}
  linkComponent={Link}
/>;
```

Sin `linkComponent` se usa un `<a>` normal, que funciona igual (con recarga
completa).

---

## 5. Cómo hacer que prevalezca sobre el estilo existente

Orden recomendado. **Empieza siempre en una rama y en un entorno que no sea
producción**, y valida cada paso antes del siguiente.

1. **Tokens primero.** Importa `design-kit/styles/globals.css` **después** del
   CSS de la app (o reemplázalo). El orden importa: gana la última definición de
   `:root`. Si la app trae su propio `--primary`, `--radius` o `--background`,
   bórralos: dos fuentes de verdad para el mismo token es lo que produce esas
   pantallas a medio migrar.
2. **Purga los estilos que compiten.** Frameworks de UI con CSS propio
   (Bootstrap, MUI, Ant, Chakra) pisan tipografía, botones y colores. Quítalos o
   acótalos a las pantallas aún no migradas; convivir con dos sistemas de diseño
   completos siempre sale peor que migrar una pantalla más.
3. **Theme provider.** Monta `ThemeProvider`, `Toaster` y `TooltipProvider` en la
   raíz. Comprueba que el toggle claro/oscuro cambia toda la app, no una parte.
4. **Marca y textos.** `configureBrand()` y `configureStrings()` una sola vez en
   el arranque.
5. **Pantalla por pantalla, no componente por componente.** Sustituye la UI de
   una pantalla completa (`Button`, `Input`, `Card`, `DataTable`…) y compárala
   con el catálogo. Una pantalla mitad vieja y mitad nueva se ve peor que
   cualquiera de las dos.
6. **Empieza por las pantallas de menor riesgo**: listados y detalles antes que
   formularios críticos o pasarelas de pago.
7. **Verifica en claro y en oscuro** cada pantalla migrada. La mayoría de las
   regresiones aparecen solo en un tema.
8. **Comprueba el foco y el teclado.** El kit usa `focus-visible:ring` con el
   token `--ring`; si la app tenía un `outline: none` global, quítalo.
9. **Cierra con el chequeo:** `node design-kit/scripts/check-portability.mjs` y
   los tests de la app destino en verde.

### Checklist

- [ ] `design-kit/` copiado y dependencias instaladas.
- [ ] `styles/globals.css` importado; el CSS anterior eliminado o subordinado.
- [ ] Sin definiciones duplicadas de `--primary`, `--radius`, `--background`…
- [ ] `ThemeProvider` + `Toaster` + `TooltipProvider` montados en la raíz.
- [ ] `<html suppressHydrationWarning>` (solo Next.js).
- [ ] Fuentes definidas como `--font-sans` / `--font-geist-mono`.
- [ ] `configureBrand()` y `configureStrings()` llamados una vez.
- [ ] Cada pantalla migrada revisada en claro y en oscuro.
- [ ] `check-portability.mjs` en verde.
- [ ] Comparación visual contra `preview/screenshots/`.

---

## 6. Next.js vs React puro

El kit sirve a los dos sin cambios de código. Lo que difiere es el entorno:

| Tema | Next.js (App Router) | React puro (Vite / CRA) |
| --- | --- | --- |
| **`"use client"`** | Imprescindible: los componentes interactivos del kit ya la traen. Los no interactivos (`PageHeader`, `EmptyState`, `DataTable`, `StatCard`, `Logo`, `ErrorState`, skeletons) se renderizan como Server Components. | La directiva es un comentario inerte; todo corre en el cliente. |
| **CSS global** | Un único `import "./globals.css"` en el layout raíz. | `import "./index.css"` en el punto de entrada; PostCSS configurado en `vite.config`. |
| **Fuentes** | `next/font/google` con `variable: "--font-sans"` (auto-hospedadas, sin CLS). | `@fontsource-variable/geist` o `<link>` a Google Fonts, más la definición manual de las variables CSS. |
| **Tema sin parpadeo** | `next-themes` inyecta su script antes de la hidratación; hace falta `suppressHydrationWarning` en `<html>`. | `next-themes` funciona igual, pero sin SSR no hay hidratación que proteger: no hace falta esa prop. |
| **Enlaces** | Pasa `next/link` en `linkComponent` para conservar la navegación cliente. | Pasa el `Link` de tu router, o deja el `<a>` por defecto. |
| **Imágenes** | El kit no usa `next/image`: si quieres optimización, envuélvelas en tu app. | `<img>` normal. |
| **Metadatos / theme-color** | `export const metadata` / `viewport`, alimentados con `getBrand().colors`. | Etiquetas `<meta>` en el `index.html`. |
| **Estado del servidor** | `configureBrand()` / `configureStrings()` son configuración de import-time: seguras en RSC. | Igual, en el punto de entrada. |

---

## 7. Catálogo visual

`preview/` es una app de Next mínima e independiente que renderiza todo el kit en
una sola pantalla. Sirve como referencia visual al migrar.

```bash
cd design-kit
../node_modules/.bin/next dev preview --port 3100
# http://localhost:3100
```

Capturas de referencia (v1.0.0):

- [`preview/screenshots/catalogo-light.png`](preview/screenshots/catalogo-light.png)
- [`preview/screenshots/catalogo-dark.png`](preview/screenshots/catalogo-dark.png)

Al copiar el kit a otro proyecto, `preview/` puede borrarse: no forma parte del
kit en tiempo de ejecución.

---

## 8. Añadir componentes shadcn nuevos

El kit se generó con estilo `radix-nova` sobre base `neutral` y iconos Lucide. Un
componente nuevo se añade con el mismo `components.json` y luego se le reescriben
los imports a rutas relativas del kit:

```json
{
  "style": "radix-nova",
  "tailwind": { "css": "design-kit/styles/globals.css", "baseColor": "neutral", "cssVariables": true },
  "iconLibrary": "lucide"
}
```

Después, `node design-kit/scripts/check-portability.mjs` para confirmar que no
entró ningún import prohibido.
