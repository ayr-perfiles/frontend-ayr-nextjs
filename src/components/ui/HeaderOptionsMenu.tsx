"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
} from "@/design-kit/components/ui/dropdown-menu";

/**
 * TANDA 19 — PILOTO DEL MÉTODO DE RE-SKIN.
 *
 * Esta pieza se eligió porque tiene UN SOLO consumidor
 * (`admin/lines/metallic-roofing/catalog/page.tsx`), así que sirve para
 * probar el método sobre una pantalla antes de aplicarlo a las 4 piezas
 * compartidas (22/22/22/17 consumidores), que son la Tanda 20.
 *
 * INVARIANTE DEL MÉTODO: la API pública NO cambia. `HeaderOptionItem` y
 * `HeaderOptionsMenuProps` quedan byte-idénticos a lo que había antes, y el
 * consumidor no se toca. Lo único que cambia son las tripas: el dropdown
 * hecho a mano (useState + backdrop `fixed inset-0` + panel `absolute`) pasa
 * a ser el `DropdownMenu` del kit (Radix), que trae gratis el manejo de
 * foco, `Escape`, click-afuera, portal y accesibilidad por teclado — todo
 * eso el hand-rolled no lo tenía.
 *
 * Colores: se usan las utilidades del kit (`bg-popover`, `text-primary`…),
 * que tras el MAPEO DE MARCA de esta misma tanda resuelven a los valores de
 * AYR y no a los neutros del kit (ver COLA `#64` y `globals.css`).
 */

export interface HeaderOptionItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}

interface HeaderOptionsMenuProps {
  label?: string;
  items: HeaderOptionItem[];
}

export function HeaderOptionsMenu({ label = "Opciones", items }: HeaderOptionsMenuProps) {
  return (
    <DropdownMenu>
      {/* Solo se usan utilidades REGISTRADAS en `@theme` (bg-card, border-border,
          text-foreground, bg-muted). `border-border-strong` NO existe como
          utilidad — `--color-border-strong` es un token de AYR fuera de
          `@theme`, así que esa clase no emitiría CSS (COLA `#64`). */}
      <DropdownMenuTrigger className="group flex items-center gap-2 bg-card border border-border text-foreground px-4 py-2.5 rounded-xl hover:bg-muted transition font-bold shadow-sm outline-none">
        {label}
        {/* `data-state` lo pone Radix en el TRIGGER, no en el icono — por eso
            va `group` en el trigger y `group-data-[state=open]` acá. Con
            `data-[state=open]` suelto el chevron no rotaba: medido en la
            captura del piloto, es exactamente el tipo de detalle de paridad
            que este piloto existe para encontrar antes de la Tanda 20. */}
        <ChevronDown
          size={18}
          className="transition-transform group-data-[state=open]:rotate-180"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-2xl shadow-xl py-2">
        <DropdownMenuLabel className="px-4 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
          Herramientas
        </DropdownMenuLabel>

        {items.map((item) => {
          const itemClass = `px-4 py-2.5 text-sm flex items-center gap-3 font-medium ${item.className || ""}`;

          if (item.href) {
            return (
              <DropdownMenuItem key={item.id} asChild className={itemClass}>
                <Link href={item.href}>
                  {item.icon} {item.label}
                </Link>
              </DropdownMenuItem>
            );
          }

          return (
            <DropdownMenuItem key={item.id} className={itemClass} onSelect={() => item.onClick?.()}>
              {item.icon} {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
