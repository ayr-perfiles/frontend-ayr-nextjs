import { ReactNode, useState, useRef, useEffect } from "react";
import {
  Search,
  Loader2,
  X,
  Filter,
  CheckCircle2,
  Calendar,
} from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
  cls?: string;
}

export interface FilterGroup {
  id: string;
  label?: string;
  layout?: "list" | "grid" | "grid-2";
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

interface TableFiltersProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    isSearching?: boolean;
    onClear?: () => void;
  };
  filterGroups?: FilterGroup[];
  dateRange?: {
    startDate: string;
    endDate: string;
    setStartDate: (value: string) => void;
    setEndDate: (value: string) => void;
  };
  onClearAll?: () => void;
  rightSlot?: ReactNode;
  extraContent?: ReactNode;
  additionalActiveCount?: number;
}

export function TableFilters({
  search,
  filterGroups,
  dateRange,
  onClearAll,
  rightSlot,
  extraContent,
  additionalActiveCount = 0,
}: TableFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const endDateRef = useRef<HTMLInputElement>(null);

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

  const activeFiltersCount =
    (dateRange?.startDate ? 1 : 0) +
    (dateRange?.endDate ? 1 : 0) +
    (filterGroups?.reduce((acc, group) => {
      const firstOptionValue = group.options[0]?.value;
      const isActive =
        group.value !== firstOptionValue &&
        group.value !== "ALL" &&
        group.value !== "TODOS";
      return acc + (isActive ? 1 : 0);
    }, 0) || 0) +
    additionalActiveCount;

  const handleClearAll = () => {
    if (onClearAll) {
      onClearAll();
    } else {
      search?.onChange("");
      filterGroups?.forEach((group) => group.onChange(group.options[0]?.value));
      dateRange?.setStartDate("");
      dateRange?.setEndDate("");
    }
  };

  return (
    <div className="w-full">
      {/* BARRA PRINCIPAL */}
      <div className="flex flex-col sm:flex-row gap-3 relative z-30 w-full">
        {/* Search Input */}
        {search && (
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              {search.isSearching ? (
                <Loader2 className="text-blue-500 animate-spin" size={18} />
              ) : (
                <Search className="text-slate-400" size={18} />
              )}
            </div>
            <input
              type="text"
              placeholder={search.placeholder || "Buscar..."}
              className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-medium text-slate-700 transition shadow-sm"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
            />
            {search.value && (
              <button
                onClick={() => (search.onClear ? search.onClear() : search.onChange(""))}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-red-500 transition"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Filters Button */}
        {((filterGroups?.length ?? 0) > 0 || dateRange) && (
          <div className="relative sm:w-auto w-full">
            <button
              onClick={() => setIsOpen(true)}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold transition border shadow-sm ${
                activeFiltersCount > 0
                  ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Filter
                size={18}
                className={
                  activeFiltersCount > 0 ? "text-blue-600" : "text-slate-400"
                }
              />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full ml-1">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Right Slot (Actions) */}
        {rightSlot && (
          <div className="flex items-center gap-2">
            {rightSlot}
          </div>
        )}
      </div>

      {/* DRAWER LATERAL */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] animate-in fade-in duration-300"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="fixed top-0 right-0 h-full w-full sm:max-w-md bg-white shadow-2xl z-[101] flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                  <Filter size={18} />
                </div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Filtros Avanzados</h2>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {filterGroups?.map((group) => (
                <div key={group.id} className="space-y-3">
                  {group.label && (
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">
                      {group.label}
                    </label>
                  )}
                  
                  {group.layout === "grid" || group.layout === "grid-2" ? (
                    <div className={`grid ${group.layout === "grid-2" ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3"} gap-2`}>
                      {group.options.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => group.onChange(opt.value)}
                          className={`px-3 py-2.5 rounded-xl text-[10px] font-bold transition border text-left flex flex-col justify-between h-full ${
                            group.value === opt.value
                              ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
                              : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100 hover:border-slate-200"
                          }`}
                        >
                          <span className={`${group.value === opt.value ? (opt.cls ?? "") : ""} leading-tight`}>
                            {opt.label}
                          </span>
                          {opt.count !== undefined && (
                            <span className={`mt-1 text-[9px] opacity-60 ${group.value === opt.value ? "text-blue-500" : "text-slate-400"}`}>
                              {opt.count} resultados
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-1.5 flex flex-col gap-1">
                      {group.options.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => group.onChange(opt.value)}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition ${
                            group.value === opt.value
                              ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                              : "text-slate-600 hover:bg-slate-200/50"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {opt.label}
                            {opt.count !== undefined && (
                              <span className="text-[10px] opacity-40 font-bold bg-slate-200/50 px-1.5 py-0.5 rounded-md">
                                {opt.count}
                              </span>
                            )}
                          </span>
                          {group.value === opt.value && (
                            <CheckCircle2 size={18} className="text-blue-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Date Range */}
              {dateRange && (
                <div className="space-y-3">
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={14} /> Rango de Fechas
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 ml-1 uppercase">Desde</span>
                      <input
                        type="date"
                        value={dateRange.startDate}
                        onChange={(e) => {
                          dateRange.setStartDate(e.target.value);
                          if (e.target.value) {
                            setTimeout(() => {
                              try {
                                endDateRef.current?.showPicker();
                              } catch (err) {
                                endDateRef.current?.focus();
                              }
                            }, 100);
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-100 text-slate-700 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition shadow-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 ml-1 uppercase">Hasta</span>
                      <input
                        ref={endDateRef}
                        type="date"
                        min={dateRange.startDate}
                        value={dateRange.endDate}
                        onChange={(e) => dateRange.setEndDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 text-slate-700 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Extra Content (Toggles, Custom inputs) */}
              {extraContent && (
                <div className="pt-4 border-t border-slate-100">
                  {extraContent}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-100 flex gap-3 bg-slate-50/50 sticky bottom-0">
              {activeFiltersCount > 0 && (
                <button
                  onClick={handleClearAll}
                  className="flex-1 bg-white border border-red-100 text-red-600 hover:bg-red-50 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition shadow-sm"
                >
                  <X size={16} /> Limpiar Todo
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="flex-[2] bg-slate-900 text-white hover:bg-blue-600 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition shadow-xl shadow-slate-200"
              >
                Aplicar y Cerrar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
