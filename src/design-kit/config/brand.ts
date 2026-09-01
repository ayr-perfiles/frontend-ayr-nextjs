/**
 * GSM Design Kit — configuración de marca.
 *
 * El kit trae la identidad de GSM Inventory por defecto (isotipo, nombre,
 * colores) para que "se vea igual" nada más copiarlo. La app destino la
 * reemplaza en su arranque:
 *
 *   configureBrand({ name: "Mi App", colors: { primary: "#7c3aed" } });
 *
 * o puntualmente por prop: `<Logo name="Mi App" mark={MiIsotipo} />`.
 * Las props siempre ganan sobre esta configuración global.
 *
 * `configureBrand()` es configuración estática de import-time (no estado por
 * usuario ni por request), así que es segura en React Server Components.
 */

export type BrandConfig = {
  /** Nombre completo del producto; se usa en el wordmark y en `aria-label`. */
  name: string;
  /** Nombre corto para espacios reducidos (PWA, tabs). */
  shortName: string;
  tagline: string;
  description: string;
  colors: {
    /** Color de acento de marca: `theme-color` de la PWA y acentos de marketing. */
    primary: string;
    background: string;
    backgroundDark: string;
  };
};

/** Identidad de GSM Inventory: el aspecto por defecto del kit. */
export const defaultBrand: BrandConfig = {
  name: "GSM Inventory",
  shortName: "GSM Inventory",
  tagline: "Inventario multi-almacén para tu empresa",
  description: "Sistema de gestión construido con el GSM Design Kit.",
  colors: {
    primary: "#2563eb",
    background: "#ffffff",
    backgroundDark: "#0a0a0a",
  },
};

let current: BrandConfig = defaultBrand;

/** Fija la marca de la app. Se fusiona con la actual; llamar una sola vez. */
export function configureBrand(overrides: Partial<BrandConfig>): void {
  current = {
    ...current,
    ...overrides,
    colors: { ...current.colors, ...overrides.colors },
  };
}

/** Restaura la marca GSM por defecto. Pensado para tests. */
export function resetBrand(): void {
  current = defaultBrand;
}

/** Marca vigente. Los componentes del kit la leen en cada render. */
export function getBrand(): BrandConfig {
  return current;
}
