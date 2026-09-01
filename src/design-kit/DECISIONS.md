# Decisiones del GSM Design Kit

Registro de lo que se incluyó, lo que se dejó fuera y por qué, más las decisiones
menores tomadas durante la extracción. Este documento es la fuente de verdad del
alcance del kit.

## Principio rector

El kit es **solo capa de presentación**. No conoce inventario, tenants, Supabase,
RLS, auth, Server Actions ni el router de Next. Un componente entra al kit si su
código, tras la limpieza, solo depende de React, Radix, Lucide, Tailwind y de los
propios módulos del kit.

## T1 — Inventario de la capa de presentación

### (a) Tokens de diseño

| Token | Origen en GSM | Estado | Motivo |
| --- | --- | --- | --- |
| Variables CSS de tema (`--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--card`, `--popover`) light + dark | `src/app/globals.css` | **Incluido** → `tokens/theme.css` | Es la identidad visual completa. |
| Escala de gráficos `--chart-1..5` | `src/app/globals.css` | **Incluido** | Neutral, sin semántica de negocio. |
| Bloque `--sidebar-*` (8 variables) light + dark | `src/app/globals.css` | **Incluido** | El `Sidebar` de shadcn los necesita. |
| `--radius: 0.625rem` y la escala derivada `--radius-sm..4xl` | `src/app/globals.css` (`@theme inline`) | **Incluido** | Define la "redondez" característica. |
| Mapeo `@theme inline` (`--color-*`, `--font-*`, `--radius-*`) | `src/app/globals.css` | **Incluido** → `tokens/theme.css` | Es la forma Tailwind v4 de exponer los tokens como utilidades. |
| Fuentes Geist / Geist Mono vía `next/font/google` (`--font-sans`, `--font-geist-mono`) | `src/app/layout.tsx` | **Incluido como contrato, no como carga** | El kit declara y consume `--font-sans` / `--font-geist-mono`; **cargar** la fuente es responsabilidad de la app destino porque el mecanismo difiere entre Next (`next/font`) y React puro (`@fontsource` o `<link>`). Documentado en `README.md`. |
| `@custom-variant dark (&:is(.dark *))` | `src/app/globals.css` | **Incluido** | Sin esto el modo oscuro no funciona. |
| Capa base (`border-border`, `outline-ring/50`, `cursor: pointer` en botones, `font-sans` en `html`) | `src/app/globals.css` | **Incluido** → `styles/globals.css` | Parte del "look" y del comportamiento táctil. |
| `@import "shadcn/tailwind.css"` (variantes `data-open`/`data-closed`/… y utilidades `scroll-fade`, `shimmer`, `no-scrollbar`) | paquete npm `shadcn@4.19.0` | **Incluido, vendorizado** → `styles/shadcn-base.css` | 16 de los 33 componentes base usan esas variantes; sin ellas los estados abierto/cerrado/checked no se estilan. Se copia el archivo en vez de depender del paquete `shadcn` para que el kit sea copiable sin instalar el CLI. Ver "Decisiones menores". |
| Tailwind v4 (CSS-first, sin `tailwind.config`) | `postcss.config.mjs` + `globals.css` | **Incluido**, más un **preset v3 equivalente** → `tokens/tailwind-preset.ts` | El prompt pide un preset consumible con `presets: [gsmPreset]`; GSM usa v4, así que el preset se genera para apps destino que sigan en v3. |
| `components.json` (`style: radix-nova`, `baseColor: neutral`) | raíz | **Incluido como documentación** | No es código; se documenta para poder añadir componentes shadcn nuevos con el mismo estilo. |
| Paleta de marca (`brand.colors.primary #2563eb`, backgrounds) | `src/config/brand.ts` | **Incluido parcialmente** → `config/brand.ts` | Solo la parte de presentación (nombre, tagline, colores para theme-color/PWA). Se quitaron `defaultCurrency`, `supportEmail` y `defaultLocale`. |

### (b) Componentes base shadcn/ui

Los 33 archivos de `src/components/ui/` se copian **verbatim** salvo la reescritura
de imports (`@/lib/utils` → `../../lib/utils`, `@/hooks/use-mobile` →
`../../hooks/use-mobile`, `@/components/ui/x` → `./x`). Ninguno importaba código de
negocio ni de `next/*`, así que la extracción fue mecánica:

`alert` · `alert-dialog` · `avatar` · `badge` · `breadcrumb` · `button` · `calendar` ·
`card` · `checkbox` · `collapsible` · `command` · `dialog` · `dropdown-menu` · `field` ·
`input` · `input-group` · `label` · `pagination` · `popover` · `progress` · `radio-group` ·
`scroll-area` · `select` · `separator` · `sheet` · `sidebar` · `skeleton` · `sonner` ·
`switch` · `table` · `tabs` · `textarea` · `tooltip`

### (c) Componentes propios genéricos

| Componente | Origen | Incluido | Qué se removió |
| --- | --- | --- | --- |
| `ThemeProvider` | `src/components/theme-provider.tsx` | ✅ verbatim | — |
| `ThemeToggle` | `src/components/layout/theme-toggle.tsx` | ✅ | Import del diccionario de la app → `strings/es`. |
| `Logo` / `LogoMark` | `src/components/brand/logo.tsx` | ✅ parametrizado | El nombre dejó de leerse de `@/config/brand`: ahora llega por prop `name` o por `configureBrand()`. El isotipo GSM queda como marca por defecto y es reemplazable con la prop `mark`. |
| `PageHeader` | `src/components/layout/page-header.tsx` | ✅ verbatim | — |
| `EmptyState` | `src/components/empty-state.tsx` | ✅ verbatim | — |
| `ConfirmDialog` | `src/components/confirm-dialog.tsx` | ✅ | Import del diccionario de la app → `strings/es`. |
| `FormField` | `src/components/forms/form-field.tsx` | ✅ | La etiqueta "opcional" ahora sale del diccionario del kit. Sigue siendo agnóstico de react-hook-form (recibe `error` como objeto plano). |
| `DataTable` | patrón repetido en `products-table`, `movements-table`, `inventory-table`, `alerts-table`, `parties-table` | ✅ generalizado | Se extrajo la envoltura común (`div.overflow-x-auto.rounded-xl.border` + `Table`) a un componente con `columns`/`rows` tipados. Sin `formatCurrency`, sin tipos de la base de datos, sin `next/link` ni `next/image`. |
| `Pagination` (enlaces de página) | `src/components/pagination-links.tsx` | ✅ generalizado | Se quitó `next/link`: ahora recibe `linkComponent` (por defecto `<a>`) y una función `href(page)`, así sirve igual en Next, React Router o sin router. |
| `StatCard` | `src/components/dashboard/kpi-cards.tsx` | ✅ generalizado | Se extrajo la tarjeta individual (label + valor tabular + icono + estado de alerta). Se quitaron `formatCurrency`, los KPIs de inventario y el `next/link` (ahora opcional vía `linkComponent`). |
| `ErrorState` | `src/app/error.tsx`, `not-found.tsx`, `forbidden.tsx` | ✅ generalizado | Se unificó el patrón "icono en círculo + título + descripción + acciones". Se quitaron las rutas `/app`, `/` y el `console.error` con el prefijo de GSM. |
| Skeletons (`PageSkeleton`, `TableSkeleton`, `CardsSkeleton`) | `src/app/app/loading.tsx`, `src/app/app/products/loading.tsx` | ✅ generalizado | Se parametrizaron el número de filas/tarjetas; se quitó el `export default` de ruta de Next. |
| `ExportCsvButton` + `lib/csv` | `src/components/export-csv-button.tsx`, `src/lib/csv.ts` | ✅ (imports reescritos) | Generación de CSV en el navegador: es utilidad de UI, no de negocio. |
| `ConnectionStatus` + `useOnlineStatus` | `src/components/pwa/connection-status.tsx`, `src/hooks/use-online-status.ts` | ✅ | Solo usa `navigator.onLine` y eventos del navegador. Los textos salen del diccionario del kit. No arrastra nada del service worker. |
| `useIsMobile` | `src/hooks/use-mobile.ts` | ✅ verbatim | Lo necesita `Sidebar`. |
| `cn()` | `src/lib/utils.ts` | ✅ verbatim | — |
| `initials()` | `src/lib/format.ts` | ✅ solo esa función | El resto de `format.ts` (moneda, fechas es-PE, números de orden) depende de la marca/locale de GSM y del negocio. |
| `Toaster` (sonner) | `src/components/ui/sonner.tsx` | ✅ verbatim | Ya era genérico. |

### (d) Textos de UI genéricos

Se separó `src/lib/i18n/es.ts` (725 líneas, todo el producto) en dos mitades y solo
viaja la genérica, en `strings/es.ts`, tipada como `UiStrings`:

- **Incluido**: `common` (acciones Guardar/Cancelar/Eliminar/Editar/Crear/Buscar/Cerrar…,
  estados de carga, confirmaciones de borrado, mensajes de éxito/error genéricos, textos de
  tema y de conexión, paginación "Mostrando X–Y de Z"), `validation` (obligatorio, email,
  longitudes, números, fecha), `errors` (404, error inesperado, acceso denegado, reintentar).
- **Excluido**: `nav`, `landing`, `auth`, `account`, `products`, `categories`, `inventory`,
  `movements`, `parties`, `orders`, `purchases`, `sales`, `dashboard`, `alerts`, `reports`,
  `settings`, `invite`, `admin`, `units`, `roles`, y las entradas de `common`/`errors` que
  nombran inventario o planes (`product`, `warehouse`, `stockTotal`, `planLimit*`,
  `insufficientStock`, `duplicateSku`, `tenantSuspended`, `scan`, …).

Las cadenas del kit son sobreescribibles con `configureStrings()`, para que una app
destino en otro idioma no tenga que editar el archivo.

## Excluido explícitamente (negocio o infraestructura)

| Qué | Motivo |
| --- | --- |
| `components/products/*` (`ProductCombobox`, `ProductForm`, `ProductsTable`, `ProductRowActions`, `BarcodeDisplay`, `BarcodeScanner`, `ImageUpload`) | Negocio puro: catálogo, SKU, códigos de barras, subida al bucket de Supabase. El escáner además está atado al modelo de producto. |
| `components/inventory/*`, `movements/*`, `orders/*`, `parties/*`, `alerts/*`, `categories/*`, `reports/*`, `dashboard/*` (salvo la tarjeta KPI generalizada) | Módulos de inventario. |
| `components/admin/*`, `components/settings/*` | Multi-tenant, planes, miembros, roles. |
| `components/auth/*`, `components/invite/*` | Auth de Supabase y Server Actions. |
| `components/layout/app-sidebar.tsx`, `nav-config.ts`, `tenant-switcher.tsx`, `switch-tenant-button.tsx`, `sign-out-button.tsx`, `user-menu.tsx` | Navegación y menú de usuario atados a las rutas `/app/*`, al tenant activo y a `signOutAction`. El *primitivo* `Sidebar` de shadcn sí está en el kit; el armado concreto no. |
| `components/marketing/landing-page.tsx` | Copy y features del producto. |
| `components/pwa/*` salvo `ConnectionStatus` (`ServiceWorkerRegister`, `InstallBanner`, `NetworkErrorGuard`, `StaleDataNotice`, `RetryButton`) | Infraestructura PWA: Serwist, `beforeinstallprompt`, recuperación de errores de red de Next. |
| `lib/supabase/*`, `lib/actions/*`, `lib/data/*`, `lib/auth/*`, `lib/validation/*`, `lib/types/*`, `lib/inventory/*`, `lib/errors.ts`, `lib/constants.ts`, `lib/env.ts` | Infraestructura y dominio. |
| `lib/format.ts` salvo `initials()` | Moneda `PEN`, locale `es-PE` y números de orden `OC-000012` son del producto. |
| `src/proxy.ts`, `src/sw.ts`, `src/app/**` | Rutas, middleware y service worker. |
| `recharts` y `movements-chart` | El gráfico existente grafica entradas/salidas de stock. Los tokens `--chart-1..5` sí viajan, así que la app destino puede construir sus propios gráficos con la misma paleta. |
| `react-hook-form`, `zod`, `@hookform/resolvers` | El kit no impone librería de formularios: `FormField` recibe el error ya resuelto. Son peer *opcionales* del lado de la app. |

## Decisiones menores

1. **`shadcn/tailwind.css` vendorizado.** GSM lo importa desde el paquete npm `shadcn`
   (v4.19.0). El kit copia el archivo a `styles/shadcn-base.css` con una cabecera que
   documenta origen y versión. Alternativa descartada: declarar `shadcn` como dependencia
   del kit, porque obligaría a cada app destino a instalar el CLI completo solo para
   obtener un CSS. Para actualizarlo: reinstalar `shadcn` y volver a copiar el archivo.
2. **Los componentes exigen Tailwind v4.** Usan modificadores de opacidad sobre colores en
   `oklch()` (`bg-primary/80`, `ring-ring/50`), que v4 resuelve con `color-mix()`. El preset
   v3 replica colores, radios y fuentes con
   `color-mix(in oklab, var(--x) calc(<alpha-value> * 100%), transparent)`, lo que devuelve
   el soporte de opacidad; aun así, la vía recomendada es v4.
3. **Nada de `next/*` dentro del kit.** `next/link`, `next/image` y `next/font` se
   reemplazaron por props (`linkComponent`) o por contrato de CSS (`--font-sans`). Así el
   mismo código sirve para la app Next.js y para la de React puro.
4. **Marca parametrizable con doble vía.** Props (`<Logo name="…" />`) para casos puntuales
   y `configureBrand()` a nivel de módulo para fijarla una vez en el arranque. Las props
   ganan sobre la configuración global. `configureBrand()` es configuración estática de
   import-time, así que es segura en RSC.
5. **Los componentes conservan `"use client"`.** En React puro la directiva es un comentario
   inerte; en Next.js es imprescindible. Mantenerla es lo que hace el kit portable en ambos
   sentidos.
6. **El kit se aísla del `tsconfig`/ESLint de GSM** (`exclude` y `globalIgnores`) y trae su
   propio `tsconfig.json` y su propio chequeo. Motivo: el kit está pensado para copiarse
   fuera, así que se verifica solo, y así la app no puede romperse por un cambio en él.
7. **Sin publicación a npm.** Carpeta versionada con `VERSION` + `CHANGELOG.md`, como pide el
   prompt ("congelado y copiable").
