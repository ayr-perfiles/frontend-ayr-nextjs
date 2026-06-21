"use client";

import React, { useState, useEffect } from "react";
import { FilterSpec } from "../types";
import { X, Search, Filter, CheckCircle2, Calendar } from "lucide-react";
import { useFinishes } from "@/core/coils/hooks/useFinishes";

interface ReportFiltersProps {
  specs: FilterSpec[];
  values: any;
  onChange: (id: string, value: any) => void;
  onClear: () => void;
}

function MultiSelectDropdown({
  options,
  selectedValues,
  onChange,
}: {
  options: { value: string; label: string }[];
  selectedValues: string[];
  onChange: (vals: string[]) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const displayText =
    selectedValues.length === 0
      ? "Todos"
      : options
          .filter((o) => selectedValues.includes(o.value))
          .map((o) => o.label)
          .join(", ");

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm text-left flex justify-between items-center cursor-pointer"
      >
        <span className="truncate pr-2">{displayText}</span>
        <span className="text-slate-400 text-xs">▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto p-2 space-y-1">
          {options.map((opt) => {
            const isChecked = selectedValues.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggle(opt.value)}
                  className="w-4 h-4 rounded border-slate-200 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ReportFilters({ specs, values, onChange, onClear }: ReportFiltersProps) {
  const { finishes } = useFinishes(true);
  const [isOpen, setIsOpen] = useState(false);

  // Bloquear scroll del body y manejar escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const getOptionsForSpec = React.useCallback(
    (spec: FilterSpec) => {
      if (spec.id === "colorFilter") {
        return finishes
          .filter((f) => f.lines.includes("metallic-roofing"))
          .map((f) => ({ value: f.id, label: f.label }));
      }
      if (spec.id === "espesorFilter") {
        return ["0.30", "0.35", "0.40", "0.45"].map((val) => ({
          value: val,
          label: `${val} mm`,
        }));
      }
      return [];
    },
    [finishes],
  );

  if (specs.length === 0) return null;

  const textSpecs = specs.filter((s) => s.type === "TEXT");
  const drawerSpecs = specs.filter((s) => s.type !== "TEXT");

  const activeFiltersCount = drawerSpecs.reduce((acc, spec) => {
    if (spec.type === "PERIOD") {
      return acc + (values[spec.id] && values[spec.id] !== "HISTORICO" ? 1 : 0) + (values.startDate ? 1 : 0) + (values.endDate ? 1 : 0);
    }
    if (spec.type === "MULTISELECT") {
      return acc + (values[spec.id]?.length > 0 ? 1 : 0);
    }
    if (spec.type === "LINE") {
      return acc + (values[spec.id] && values[spec.id] !== "all" ? 1 : 0);
    }
    if (spec.type === "BOOLEAN") {
      return acc + (values[spec.id] ? 1 : 0);
    }
    return acc;
  }, 0);

  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6 relative">
      <div className="flex-1 flex flex-wrap gap-4">
        {textSpecs.map((spec) => (
          <div key={spec.id} className="relative flex-1 min-w-[200px] max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              value={values[spec.id] || ""}
              onChange={(e) => onChange(spec.id, e.target.value)}
              placeholder={spec.label}
              className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-10 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
            />
            {values[spec.id] && (
              <button
                onClick={() => onChange(spec.id, "")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {drawerSpecs.length > 0 && (
        <button
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all shadow-sm whitespace-nowrap
            ${
              activeFiltersCount > 0
                ? "bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }
          `}
        >
          <Filter size={18} className={activeFiltersCount > 0 ? "text-blue-600" : "text-slate-400"} />
          Filtros
          {activeFiltersCount > 0 && (
            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 ml-1 bg-blue-600 text-white text-[10px] rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-[60] flex flex-col transform transition-transform duration-300">
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                <Filter size={20} />
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Filtros</h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-700"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            {drawerSpecs.map((spec) => (
              <div key={spec.id} className="space-y-3">
                <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                  {spec.type === "PERIOD" && <Calendar size={14} className="text-blue-400" />}
                  {spec.label}
                </label>

                {spec.type === "PERIOD" && (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "HOY", label: "Hoy" },
                      { value: "MES", label: "Este Mes" },
                      { value: "MES_ANTERIOR", label: "Mes Pasado" },
                      { value: "TRIMESTRE", label: "Trimestre" },
                      { value: "ANIO", label: "Año" },
                      { value: "HISTORICO", label: "Histórico" },
                      { value: "CUSTOM", label: "Personalizado" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(spec.id, opt.value)}
                        className={`px-3 py-2 rounded-xl text-xs font-black transition-all border
                          ${
                            values[spec.id] === opt.value
                              ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }
                        `}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {spec.type === "LINE" && (
                  <select
                    value={values[spec.id]}
                    onChange={(e) => onChange(spec.id, e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm cursor-pointer text-slate-700"
                  >
                    <option value="all">Todas las líneas</option>
                    <option value="drywall">Drywall</option>
                    <option value="roofing">Roofing (UPVC)</option>
                    <option value="metallic-roofing">Metallic Roofing</option>
                    <option value="trading">Trading</option>
                    <option value="services">Services</option>
                  </select>
                )}

                {spec.type === "BOOLEAN" && (
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={!!values[spec.id]}
                      onChange={(e) => onChange(spec.id, e.target.checked)}
                      className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-sm font-bold text-slate-700">SÍ</span>
                  </label>
                )}

                {spec.type === "MULTISELECT" && (
                  <MultiSelectDropdown
                    options={getOptionsForSpec(spec)}
                    selectedValues={values[spec.id] || []}
                    onChange={(vals) => onChange(spec.id, vals)}
                  />
                )}
              </div>
            ))}

            {values.period === "CUSTOM" && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    Inicio
                  </label>
                  <input
                    type="date"
                    value={values.startDate || ""}
                    onChange={(e) => onChange("startDate", e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-500 shadow-sm text-slate-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    Fin
                  </label>
                  <input
                    type="date"
                    value={values.endDate || ""}
                    onChange={(e) => onChange("endDate", e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-500 shadow-sm text-slate-700"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
            <button
              onClick={() => {
                onClear();
                setIsOpen(false);
              }}
              className="px-4 py-3 rounded-xl font-black text-xs text-slate-500 hover:bg-slate-200 transition-colors flex items-center justify-center w-full"
            >
              LIMPIAR
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs transition-colors shadow-md shadow-blue-200 flex items-center justify-center gap-2 w-full"
            >
              <CheckCircle2 size={16} /> APLICAR Y CERRAR
            </button>
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[50] transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
