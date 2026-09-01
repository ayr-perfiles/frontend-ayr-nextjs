/**
 * GSM Design Kit — punto de entrada.
 *
 * Reexporta todo el kit para arrancar rápido. En proyectos grandes conviene
 * importar por ruta (`design-kit/components/ui/button`) para no arrastrar
 * componentes que no se usan.
 *
 * El CSS no se importa desde aquí: la app debe importar
 * `design-kit/styles/globals.css` (Tailwind v4) o aplicar
 * `tokens/tailwind-preset` (Tailwind v3). Ver README.
 */

// Componentes base (shadcn/ui)
export * from "./components/ui";

// Componentes propios genéricos
export { Logo, LogoMark, type LogoMarkComponent } from "./components/brand/logo";
export { ThemeProvider } from "./components/theme-provider";
export { ThemeToggle } from "./components/theme-toggle";
export { PageHeader } from "./components/page-header";
export { EmptyState } from "./components/empty-state";
export { ErrorState } from "./components/error-state";
export { ConfirmDialog } from "./components/confirm-dialog";
export { FormField } from "./components/form-field";
export { DataTable, type DataTableColumn } from "./components/data-table";
export { PaginationNav, buildPageHref } from "./components/pagination-nav";
export { StatCard, StatCardGrid } from "./components/stat-card";
export { ExportCsvButton } from "./components/export-csv-button";
export { ConnectionStatus } from "./components/connection-status";
export {
  PageSkeleton,
  HeaderSkeleton,
  CardsSkeleton,
  TableSkeleton,
} from "./components/skeletons";

// Hooks
export { useIsMobile } from "./hooks/use-mobile";
export { useOnlineStatus } from "./hooks/use-online-status";

// Utilidades
export { cn } from "./lib/utils";
export { initials } from "./lib/initials";
export { toCsv, downloadCsv, csvDateStamp, type CsvColumn } from "./lib/csv";
export { defaultLink, type LinkLike } from "./lib/link";

// Textos y marca
export {
  es as uiStringsEs,
  getStrings,
  configureStrings,
  resetStrings,
  type UiStrings,
} from "./strings/es";
export {
  defaultBrand,
  getBrand,
  configureBrand,
  resetBrand,
  type BrandConfig,
} from "./config/brand";

// Tokens
export * from "./tokens/tokens";
export { gsmPreset, type GsmPreset } from "./tokens/tailwind-preset";
