"use client";

import React, { ReactNode } from "react";
import { MoreHorizontal, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/design-kit/components/ui/dropdown-menu";

/**
 * TANDA 20 — pieza 1 de 4 del re-skin (18 consumidores).
 *
 * API PÚBLICA BYTE-IDÉNTICA: `RowAction` y `RowActionsMenuProps` no cambian,
 * y ningún consumidor se toca. Lo que cambia son las tripas.
 *
 * QUÉ SE BORRÓ, y por qué el reemplazo es mejor y no solo distinto: la
 * versión anterior mantenía a mano `useState` + `useRef` + `useLayoutEffect`
 * + `createPortal` + ~45 líneas de aritmética de posicionamiento (flip
 * vertical, clamp y flip horizontal, listeners de `scroll`/`resize`/`click`).
 * Radix hace todo eso — colisión con el viewport incluida — y además agrega
 * lo que la versión a mano NO tenía: navegación por teclado, `Escape`,
 * manejo de foco y roles ARIA (`menu`/`menuitem`).
 *
 * `align` y `menuWidth` siguen siendo props públicas: se traducen al
 * vocabulario de Radix acá adentro (`right`→`end`, `left`→`start`), que es
 * justamente el tipo de mapeo que permite conservar la firma.
 */

export interface RowAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "default" | "primary" | "danger" | "warning";
  disabled?: boolean;
  loading?: boolean;
  hidden?: boolean;
  section?: string;
}

interface RowActionsMenuProps {
  trigger?: ReactNode;
  items: RowAction[];
  align?: "right" | "left";
  menuWidth?: number;
}

const variantClasses: Record<NonNullable<RowAction["variant"]>, string> = {
  default: "text-slate-700 focus:bg-slate-50 focus:text-slate-900",
  primary: "text-blue-600 focus:bg-blue-50 focus:text-blue-700",
  danger: "text-red-600 focus:bg-red-50 focus:text-red-700",
  warning: "text-orange-600 focus:bg-orange-50 focus:text-orange-700",
};

export function RowActionsMenu({
  trigger,
  items,
  align = "right",
  menuWidth = 208, // w-52
}: RowActionsMenuProps) {
  // Agrupación por sección, preservando el orden de aparición — mismo
  // criterio que la versión anterior.
  const visibleItems = items.filter((item) => !item.hidden);
  const sections: Record<string, RowAction[]> = {};
  const sectionOrder: string[] = [];
  visibleItems.forEach((item) => {
    const name = item.section || "default";
    if (!sections[name]) {
      sections[name] = [];
      sectionOrder.push(name);
    }
    sections[name].push(item);
  });

  return (
    <div className="relative flex justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="group p-2 rounded-lg transition-all text-slate-400 hover:bg-slate-100 hover:text-blue-600 data-[state=open]:bg-blue-50 data-[state=open]:text-blue-600 outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          {trigger || <MoreHorizontal size={20} />}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align={align === "right" ? "end" : "start"}
          sideOffset={4}
          style={{ width: menuWidth }}
          className="rounded-xl shadow-2xl py-2 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {sectionOrder.map((sectionName, sIdx) => (
            <React.Fragment key={sectionName}>
              {sIdx > 0 && <DropdownMenuSeparator className="my-1 mx-2" />}
              {sections[sectionName].map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  disabled={item.disabled || item.loading}
                  onSelect={() => {
                    if (!item.disabled && !item.loading) item.onClick();
                  }}
                  className={`px-4 py-2 text-sm font-semibold flex items-center gap-2 ${
                    variantClasses[item.variant || "default"]
                  }`}
                >
                  {item.loading ? <Loader2 size={16} className="animate-spin" /> : item.icon}
                  {item.label}
                </DropdownMenuItem>
              ))}
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
