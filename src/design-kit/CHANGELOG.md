# Changelog — GSM Design Kit

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
El kit sigue [SemVer](https://semver.org/lang/es/): el número vive en `VERSION`.

Criterio de versionado para un kit que se **copia** (no se instala):

- **MAYOR** — cambia un token o la API de un componente de forma que rompe a quien
  ya lo copió (renombrar una variable CSS, quitar una prop, cambiar un default visual).
- **MENOR** — componentes, tokens o textos nuevos, retrocompatibles.
- **PARCHE** — correcciones visuales, documentación, dependencias.

## [1.0.0] — 2026-08-31

Primera extracción, desde GSM Inventory v2.0.

### Añadido

- **Tokens** (`tokens/`): `theme.css` con la variante `dark`, el bloque
  `@theme inline` y las paletas light/dark completas (incluidos `--chart-1..5` y
  los ocho `--sidebar-*`); `tokens.ts` con los mismos valores como datos;
  `tailwind-preset.js` + `tailwind-preset.ts` para apps que sigan en Tailwind v3.
- **Estilos** (`styles/`): `globals.css` como única hoja de entrada y
  `shadcn-base.css` vendorizado de `shadcn@4.19.0` (variantes `data-*`,
  utilidades `scroll-fade`, `shimmer`, `no-scrollbar`).
- **33 componentes base de shadcn/ui** (`components/ui/`), estilo `radix-nova`
  sobre base `neutral`, con imports internos al kit.
- **Componentes propios genéricos**: `Logo` / `LogoMark` (marca parametrizable),
  `ThemeProvider`, `ThemeToggle`, `PageHeader`, `EmptyState`, `ErrorState`,
  `ConfirmDialog`, `FormField`, `DataTable`, `PaginationNav` + `buildPageHref`,
  `StatCard` / `StatCardGrid`, `ExportCsvButton`, `ConnectionStatus` y los
  skeletons `PageSkeleton` / `HeaderSkeleton` / `CardsSkeleton` / `TableSkeleton`.
- **Hooks**: `useIsMobile`, `useOnlineStatus`.
- **Utilidades**: `cn`, `initials`, `toCsv` / `downloadCsv` / `csvDateStamp`, y el
  contrato `LinkLike` que mantiene el kit libre de router.
- **Textos** (`strings/es.ts`): diccionario de UI genérico en español, tipado como
  `UiStrings` y sobreescribible con `configureStrings()`.
- **Marca** (`config/brand.ts`): `configureBrand()` / `getBrand()` con la
  identidad de GSM como valor por defecto.
- **Catálogo visual** (`preview/`) con todos los componentes en claro y oscuro, y
  capturas en `preview/screenshots/`.
- **Chequeo de portabilidad** (`scripts/check-portability.mjs`): falla si aparece
  un import a la app GSM, a Supabase, a Server Actions, a `next/*` o a un
  concepto de negocio.
- `README.md` (guía de integración), `DECISIONS.md` (incluido / excluido / motivo).

### Notas

- Los componentes requieren **Tailwind v4**; el preset v3 cubre tokens pero es un
  camino de compatibilidad. Ver `DECISIONS.md`.
- El kit **no carga fuentes**: consume `--font-sans` y `--font-geist-mono`. GSM se
  diseñó con Geist / Geist Mono.
