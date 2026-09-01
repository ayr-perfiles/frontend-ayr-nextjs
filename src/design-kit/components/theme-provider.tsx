"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Envoltorio de `next-themes` con los valores por defecto de GSM: la clase
 * `.dark` en el `<html>`, seguimiento del tema del sistema y sin transiciones
 * durante el cambio. Funciona igual en Next.js y en React puro.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
