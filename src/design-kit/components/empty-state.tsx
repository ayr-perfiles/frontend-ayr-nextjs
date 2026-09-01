import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { getStrings } from "../strings/es";
import { cn } from "../lib/utils";

type EmptyStateProps = {
  /** Icono de Lucide (o cualquier componente con la misma firma). */
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/** Estado vacío: recuadro punteado con icono, título, descripción y una acción. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const t = getStrings().errors;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      <div className="bg-muted text-muted-foreground mb-4 flex size-12 items-center justify-center rounded-full">
        <Icon className="size-6" aria-hidden />
      </div>
      <h3 className="text-base font-semibold">{title ?? t.emptyTitle}</h3>
      {description !== "" ? (
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          {description ?? t.emptyDescription}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
