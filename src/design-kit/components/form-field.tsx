"use client";

import type { ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "./ui/field";
import { getStrings } from "../strings/es";

type FormFieldProps = {
  id: string;
  label: ReactNode;
  /**
   * Error ya resuelto. Encaja tal cual con `formState.errors.x` de
   * react-hook-form, pero el kit no depende de ninguna librería de formularios.
   */
  error?: { message?: string } | undefined;
  description?: ReactNode;
  optional?: boolean;
  optionalLabel?: string;
  className?: string;
  children: ReactNode;
};

/** Etiqueta + control + descripción + error, sobre los primitivos `Field`. */
export function FormField({
  id,
  label,
  error,
  description,
  optional,
  optionalLabel,
  className,
  children,
}: FormFieldProps) {
  return (
    <Field className={className} data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional ? (
          <span className="text-muted-foreground text-xs font-normal">
            ({optionalLabel ?? getStrings().common.optional})
          </span>
        ) : null}
      </FieldLabel>
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={error ? [error] : undefined} />
    </Field>
  );
}
