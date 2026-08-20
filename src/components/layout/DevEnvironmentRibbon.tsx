"use client";

import { firebaseConfig } from "@/lib/firebase/clientApp";
import { isTestEnvironment } from "@/core/env/isTestEnvironment";

/**
 * Franja diagonal "MODO DESARROLLO" en la esquina superior derecha.
 *
 * Se muestra SOLO cuando el projectId de Firebase no es el de producción
 * (`isTestEnvironment`). El eje es el projectId, NUNCA `NODE_ENV` — ver el docblock del
 * helper para el porqué.
 *
 * `pointerEvents: "none"` en el contenedor: la franja es puramente visual y no puede
 * interceptar un click de ningún control que quede debajo, aunque el z-index sea alto.
 *
 * `position: fixed` no queda clipeado por el `overflow-x-hidden` del root de `AdminShell`:
 * un ancestro con `overflow` solo recorta elementos `fixed` si además tiene
 * `transform`/`filter`/`will-change`, y no es el caso.
 *
 * `aria-hidden`: es decoración para el operador, no contenido; no debe leerse en el
 * lector de pantalla en medio del flujo de la página.
 */
export function DevEnvironmentRibbon() {
  if (!isTestEnvironment(firebaseConfig.projectId)) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="dev-environment-ribbon"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 150,
        height: 150,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 2147483000,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 34,
          right: -54,
          width: 220,
          transform: "rotate(45deg)",
          transformOrigin: "center",
          background: "var(--color-env-dev)",
          color: "#fff",
          textAlign: "center",
          padding: "5px 0",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          boxShadow: "0 1px 4px rgb(0 0 0 / 0.28)",
        }}
      >
        Modo Desarrollo
      </div>
    </div>
  );
}
