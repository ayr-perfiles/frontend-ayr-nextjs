import { Skeleton } from "./ui/skeleton";
import { cn } from "../lib/utils";

/** Cabecera de página en carga: título y subtítulo. */
export function HeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

/** Rejilla de tarjetas de métrica en carga. */
export function CardsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

/** Tabla en carga, con el mismo borde redondeado que `DataTable`. */
export function TableSkeleton({
  rows = 8,
  withThumbnail = true,
  className,
}: {
  rows?: number;
  /** Cuadrado a la izquierda de cada fila (miniatura o avatar). */
  withThumbnail?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
          {withThumbnail ? <Skeleton className="size-10 rounded-md" /> : null}
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-24 md:block" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Página completa en carga: cabecera + métricas + bloque grande. */
export function PageSkeleton({ cards = 4, className }: { cards?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-6", className)} aria-busy="true" aria-live="polite">
      <HeaderSkeleton />
      <CardsSkeleton count={cards} />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
