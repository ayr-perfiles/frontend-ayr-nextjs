/**
 * Utilidades puras para inputs numéricos de bobina (Peso/Ancho/Espesor/Valor).
 * Sin I/O, sin side-effects.
 */
import type React from "react";

export function sanitizeNumericPaste(raw: string): string {
  const digitsAndDots = raw.replace(/[^\d.]/g, "");
  const firstDotIndex = digitsAndDots.indexOf(".");
  if (firstDotIndex === -1) return digitsAndDots;
  const before = digitsAndDots.slice(0, firstDotIndex + 1);
  const after = digitsAndDots.slice(firstDotIndex + 1).replace(/\./g, "");
  return before + after;
}

export const NO_SPIN_CLASS =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

export function numericFieldHandlers(onValue: (v: string) => void) {
  return {
    onWheel: (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur(),
    onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      onValue(sanitizeNumericPaste(e.clipboardData.getData("text")));
    },
    inputMode: "decimal" as const,
  };
}
