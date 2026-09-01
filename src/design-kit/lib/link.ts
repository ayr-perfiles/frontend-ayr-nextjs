import type { ComponentType, ReactNode } from "react";

/**
 * Contrato mínimo de un enlace. El kit nunca importa `next/link` ni un router:
 * los componentes que navegan reciben el componente de enlace por prop y usan
 * `<a>` cuando no se les pasa ninguno.
 *
 *   <PaginationNav linkComponent={Link} … />        // Next.js
 *   <PaginationNav linkComponent={RouterLink} … />  // React Router
 *   <PaginationNav … />                             // <a> nativo
 *
 * `next/link` y `react-router` cumplen esta firma sin adaptador.
 */
export type LinkLike = ComponentType<{
  href: string;
  className?: string;
  children?: ReactNode;
  tabIndex?: number;
  "aria-label"?: string;
  "aria-disabled"?: boolean;
  onClick?: () => void;
}>;

/** Enlace por defecto: un `<a>` corriente. */
export const defaultLink: LinkLike = "a" as unknown as LinkLike;
