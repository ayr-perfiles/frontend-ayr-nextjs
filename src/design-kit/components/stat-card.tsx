import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { defaultLink, type LinkLike } from "../lib/link";
import { cn } from "../lib/utils";

type StatCardProps = {
  label: string;
  /** Valor ya formateado: el kit no impone locale ni moneda. */
  value: ReactNode;
  /** Aclaración pequeña bajo el valor. */
  help?: string;
  icon?: LucideIcon;
  /** Tiñe valor e icono con el color destructivo (umbral superado). */
  alert?: boolean;
  /** Si se pasa, toda la tarjeta se vuelve un enlace. */
  href?: string;
  linkComponent?: LinkLike;
  className?: string;
};

/**
 * Tarjeta de métrica: etiqueta, valor en cifras tabulares e icono en un cuadro
 * redondeado. Es la unidad de la fila de KPIs del panel de GSM.
 */
export function StatCard({
  label,
  value,
  help,
  icon: Icon,
  alert,
  href,
  linkComponent: Link = defaultLink,
  className,
}: StatCardProps) {
  const card = (
    <Card className={cn("h-full", href && "hover:bg-muted/40 transition-colors", className)}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">{label}</p>
          <p
            className={cn(
              "mt-1 text-2xl font-semibold tracking-tight tabular-nums",
              alert && "text-destructive",
            )}
          >
            {value}
          </p>
          {help ? <p className="text-muted-foreground mt-1 text-xs">{help}</p> : null}
        </div>
        {Icon ? (
          <span
            className={cn(
              "bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg",
              alert && "bg-destructive/10 text-destructive",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </CardContent>
    </Card>
  );

  if (!href) return card;

  return (
    <Link href={href} className="focus-visible:ring-ring rounded-xl outline-none focus-visible:ring-2">
      {card}
    </Link>
  );
}

/** Rejilla estándar para una fila de `StatCard` (4 por fila en pantallas anchas). */
export function StatCardGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>
  );
}
