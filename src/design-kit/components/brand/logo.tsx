import type { ComponentProps, ComponentType } from "react";
import { getBrand } from "../../config/brand";
import { cn } from "../../lib/utils";

/**
 * Isotipo por defecto del kit: una caja isométrica abstracta trazada con 2px.
 * Usa `currentColor`, así que se adapta al tema y a cualquier contenedor.
 *
 * Para poner el tuyo, pasa otro componente en la prop `mark` de `<Logo>`; debe
 * aceptar `size` y `className` y dibujar con `currentColor`.
 */
export function LogoMark({
  size = 24,
  className,
  ...props
}: { size?: number } & ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("shrink-0", className)}
      {...props}
    >
      <path d="M12 2.5 20.5 7.25v9.5L12 21.5l-8.5-4.75v-9.5L12 2.5Z" />
      <path d="M12 12v9.5" />
      <path d="m12 12 8.5-4.75" />
      <path d="M12 12 3.5 7.25" />
      <path d="m7.75 9.63 8.5-4.75" />
    </svg>
  );
}

export type LogoMarkComponent = ComponentType<{ size?: number; className?: string }>;

type LogoProps = {
  /** Alto del isotipo en px; el wordmark escala con él. */
  size?: number;
  /** `badge` dibuja el isotipo en blanco sobre un cuadrado primary redondeado. */
  variant?: "plain" | "badge";
  /** Oculta el wordmark (solo isotipo). */
  wordmark?: boolean;
  /** Nombre a mostrar. Por defecto, el de `configureBrand()`. */
  name?: string;
  /** Isotipo alternativo. Por defecto, el de GSM. */
  mark?: LogoMarkComponent;
  className?: string;
};

/** Isotipo + wordmark. Ambos parametrizables; por defecto, la identidad de GSM. */
export function Logo({
  size = 28,
  variant = "badge",
  wordmark = true,
  name,
  mark: Mark = LogoMark,
  className,
}: LogoProps) {
  const label = name ?? getBrand().name;
  const fontSize = Math.round(size * 0.64);
  return (
    <span className={cn("inline-flex items-center gap-2", className)} aria-label={label} role="img">
      {variant === "badge" ? (
        <span
          className="bg-primary text-primary-foreground flex shrink-0 items-center justify-center rounded-md"
          style={{ width: size, height: size }}
        >
          <Mark size={Math.round(size * 0.62)} />
        </span>
      ) : (
        <Mark size={size} />
      )}
      {wordmark ? (
        <span
          className="font-semibold tracking-tight whitespace-nowrap"
          style={{ fontSize, lineHeight: 1 }}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
