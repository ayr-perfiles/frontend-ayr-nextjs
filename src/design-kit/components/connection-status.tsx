"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { useOnlineStatus } from "../hooks/use-online-status";
import { getStrings } from "../strings/es";
import { cn } from "../lib/utils";

/** Cuánto se queda arriba la confirmación de "conexión restablecida". */
const RESTORED_MS = 3000;

/**
 * Indicador global de conectividad: una franja fija mientras el navegador
 * reporta que no hay red, y una confirmación breve al volver. Sin incidencias no
 * renderiza nada, así que no le cuesta atención al usuario.
 *
 * El estado offline se lee con `useSyncExternalStore` en vez de un efecto, para
 * que una página abierta ya sin conexión muestre la franja en el primer pintado.
 *
 * Solo usa `navigator.onLine` y los eventos `online`/`offline`: no depende de
 * ningún service worker ni de la infraestructura PWA de la app.
 */
export function ConnectionStatus() {
  const online = useOnlineStatus();
  const [restored, setRestored] = useState(false);
  const t = getStrings().common;

  useEffect(() => {
    let timer = 0;
    const onOnline = () => {
      setRestored(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setRestored(false), RESTORED_MS);
    };
    const onOffline = () => {
      window.clearTimeout(timer);
      setRestored(false);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const offline = !online;
  if (!offline && !restored) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="connection-status"
      data-state={offline ? "offline" : "online"}
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <div
        className={cn(
          "pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur",
          offline
            ? "border-amber-500/30 bg-amber-50/95 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/90 dark:text-amber-100"
            : "border-emerald-500/30 bg-emerald-50/95 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950/90 dark:text-emerald-100",
        )}
      >
        {offline ? (
          <WifiOff className="size-3.5 shrink-0" aria-hidden />
        ) : (
          <Wifi className="size-3.5 shrink-0" aria-hidden />
        )}
        <span className="truncate">
          {offline ? t.offlineBanner : t.onlineBanner}
          {offline ? (
            <span className="hidden font-normal opacity-80 sm:inline">
              {" "}
              · {t.offlineBannerDescription}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
