import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

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
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative z-40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition font-bold shadow-sm"
      >
        {label} <ChevronDown size={18} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in zoom-in-95">
            <p className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Herramientas</p>
            {items.map((item) => {
              const baseClassName = `w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 font-medium transition hover:bg-blue-50 hover:text-blue-700 ${item.className || "text-slate-700"}`;
              if (item.href) {
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={baseClassName}
                  >
                    {item.icon} {item.label}
                  </Link>
                );
              }
              return (
                <button
                  key={item.id}
                  onClick={() => { setIsOpen(false); item.onClick?.(); }}
                  className={baseClassName}
                >
                  {item.icon} {item.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
