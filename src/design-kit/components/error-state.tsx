import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";
import { getStrings } from "../strings/es";

type ErrorStateProps = {
  icon?: LucideIcon;
  title?: string;
  description?: ReactNode;
  /** Texto monoespaciado sobre el título (código de estado, id de traza…). */
  code?: string;
  /** Botones de recuperación; normalmente `<Button>` del kit. */
  actions?: ReactNode;
  /** `destructive` tiñe el icono de rojo; `muted` lo deja neutro. */
  tone?: "destructive" | "muted";
  /** `page` centra el bloque en toda la altura de la ventana. */
  layout?: "page" | "inline";
  className?: string;
};

/**
 * Pantalla de error o de página no encontrada: icono en círculo, título,
 * descripción y acciones. Es el patrón que GSM usa en `error`, `not-found` y
 * `forbidden`, sin ninguna ruta cableada: las acciones las decide quien lo usa.
 */
export function ErrorState({
  icon: Icon = AlertTriangle,
  title,
  description,
  code,
  actions,
  tone = "destructive",
  layout = "page",
  className,
}: ErrorStateProps) {
  const t = getStrings().errors;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 p-6 text-center",
        layout === "page" && "min-h-svh",
        className,
      )}
    >
      <div
        className={cn(
          "flex size-14 items-center justify-center rounded-full",
          tone === "destructive"
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-7" aria-hidden />
      </div>
      {code ? <p className="text-muted-foreground font-mono text-sm">{code}</p> : null}
      <h1 className="text-2xl font-semibold">{title ?? t.errorTitle}</h1>
      <p className="text-muted-foreground max-w-md">{description ?? t.errorDescription}</p>
      {actions ? <div className="flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
