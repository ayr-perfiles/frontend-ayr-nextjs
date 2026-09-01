import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "./ui/button";
import { defaultLink, type LinkLike } from "../lib/link";
import { getStrings } from "../strings/es";
import { cn } from "../lib/utils";

type PaginationNavProps = {
  page: number;
  pageCount: number;
  /** Total de registros; con 0 el componente no renderiza nada. */
  total: number;
  pageSize: number;
  /** URL de una página. Recibe el número y devuelve el `href`. */
  href: (page: number) => string;
  /** Componente de enlace del router de la app; por defecto un `<a>`. */
  linkComponent?: LinkLike;
  className?: string;
};

/**
 * Paginación por enlaces (no por estado): "Mostrando 1–20 de 134" más Anterior /
 * Siguiente. Al ser enlaces reales funciona sin JavaScript y es indexable.
 *
 * Agnóstica de router: `href` construye la URL y `linkComponent` decide quién la
 * navega. En Next.js pasa `next/link` para conservar la navegación cliente.
 */
export function PaginationNav({
  page,
  pageCount,
  total,
  pageSize,
  href,
  linkComponent: Link = defaultLink,
  className,
}: PaginationNavProps) {
  const t = getStrings().common;
  if (total === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const prevDisabled = page <= 1;
  const nextDisabled = page >= pageCount;

  return (
    <nav
      className={cn("flex flex-col items-center justify-between gap-3 sm:flex-row", className)}
      aria-label={t.page}
    >
      <p className="text-muted-foreground text-sm">
        {t.showing} {start}–{end} {t.of} {total}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={href(page - 1)}
          aria-disabled={prevDisabled}
          tabIndex={prevDisabled ? -1 : undefined}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            prevDisabled && "pointer-events-none opacity-50",
          )}
        >
          <ChevronLeft aria-hidden />
          {t.previous}
        </Link>
        <span className="text-muted-foreground text-sm tabular-nums">
          {page} / {pageCount}
        </span>
        <Link
          href={href(page + 1)}
          aria-disabled={nextDisabled}
          tabIndex={nextDisabled ? -1 : undefined}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            nextDisabled && "pointer-events-none opacity-50",
          )}
        >
          {t.next}
          <ChevronRight aria-hidden />
        </Link>
      </div>
    </nav>
  );
}

/**
 * Ayuda para construir el `href`: conserva los filtros vigentes y solo cambia
 * `page`, omitiéndolo en la primera página para dejar la URL limpia.
 */
export function buildPageHref(
  basePath: string,
  searchParams: Record<string, string | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "page") params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
