"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Factory, Package, Zap, Layers, Home } from "lucide-react";
import { useBusinessLine } from "@/context/BusinessLineContext";
import type { BusinessLineModule } from "@/core/contracts";

function ModuleIcon({ name, size = 15 }: { name: string; size?: number }) {
  switch (name) {
    case "Factory":
      return <Factory size={size} />;
    case "Home":
      return <Home size={size} />;
    case "Package":
      return <Package size={size} />;
    case "Zap":
      return <Zap size={size} />;
    default:
      return <Layers size={size} />;
  }
}

export function BusinessLineSelector() {
  const { activeModule, availableModules, setActiveModuleId } =
    useBusinessLine();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (module: BusinessLineModule) => {
    setActiveModuleId(module.id);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative px-4 py-3 border-b border-gray-100">
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">
        Línea de negocio
      </p>

      {/* Trigger */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-colors duration-200"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-shrink-0 text-blue-600">
            <ModuleIcon name={activeModule.icon} />
          </span>
          <span className="text-sm font-bold truncate">
            {activeModule.displayName}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-blue-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          className="absolute left-4 right-4 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
        >
          {availableModules.map((module) => {
            const isActive = module.id === activeModule.id;
            return (
              <button
                key={module.id}
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(module)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors duration-150 first:rounded-t-xl last:rounded-b-xl ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`flex-shrink-0 ${
                      isActive ? "text-blue-600" : "text-gray-400"
                    }`}
                  >
                    <ModuleIcon name={module.icon} />
                  </span>
                  <span className="text-sm font-semibold truncate">
                    {module.displayName}
                  </span>
                </div>
                {isActive && (
                  <Check size={14} className="flex-shrink-0 text-blue-500" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
