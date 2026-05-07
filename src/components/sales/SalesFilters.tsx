import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  Loader2,
  X,
  Filter,
  Calendar,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";

interface SalesFiltersProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  isSearching: boolean;
  onClearSearch: () => void;
}

export function SalesFilters(props: SalesFiltersProps) {
  const {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    isSearching,
    onClearSearch,
  } = props;

  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const activeFiltersCount =
    (startDate ? 1 : 0) + (endDate ? 1 : 0) + (statusFilter !== "ALL" ? 1 : 0);

  const handleClearAll = () => {
    setStartDate("");
    setEndDate("");
    setStatusFilter("ALL");
    setSearchTerm("");
    onClearSearch();
    setIsOpen(false);
  };

  return (
    <div
      className="flex flex-col sm:flex-row gap-3 relative z-30"
      ref={menuRef}
    >
      {/* 1. BARRA DE BÚSQUEDA PRINCIPAL */}
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          {isSearching ? (
            <Loader2 className="text-blue-500 animate-spin" size={18} />
          ) : (
            <Search className="text-slate-400" size={18} />
          )}
        </div>
        <input
          type="text"
          placeholder="Buscar cliente, documento o correlativo..."
          className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-medium text-slate-700 transition shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-red-500 transition"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* 2. BOTÓN DE FILTROS AVANZADOS */}
      <div className="relative sm:w-auto w-full">
        <button
          onClick={() => setIsOpen(!isOpen)}
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
          <ChevronDown
            size={16}
            className={`ml-1 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* 3. MENÚ DESPLEGABLE (POPOVER) */}
        {isOpen && (
          <div className="absolute right-0 sm:left-auto left-0 top-full mt-2 w-full sm:w-80 bg-white border border-slate-100 rounded-2xl shadow-2xl p-5 animate-in fade-in zoom-in-95 z-50">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Filter size={14} /> Filtros de Operación
            </h4>

            <div className="space-y-5">
              {/* Filtro de Estado */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                  Estado
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-1 flex flex-col gap-1">
                  {[
                    { id: "ALL", label: "Todas las Operaciones" },
                    { id: "COMPLETED", label: "Ventas Cerradas" },
                    { id: "QUOTATION", label: "Cot. Pendientes" },
                    { id: "CONVERTED", label: "Cot. Aprobadas (Hist)" },
                  ].map((status) => (
                    <button
                      key={status.id}
                      onClick={() => setStatusFilter(status.id)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-bold transition ${
                        statusFilter === status.id
                          ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                          : "text-slate-600 hover:bg-slate-200/50"
                      }`}
                    >
                      {status.label}
                      {statusFilter === status.id && (
                        <CheckCircle2 size={16} className="text-blue-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtro de Fechas */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                  <Calendar size={12} /> Rango de Fechas
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 ml-1">
                      Desde
                    </span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
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
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 ml-1">
                      Hasta
                    </span>
                    <input
                      ref={endDateRef}
                      type="date"
                      min={startDate}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer del Menú */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200 py-2.5 rounded-xl text-sm font-bold transition"
              >
                Cerrar
              </button>
              {activeFiltersCount > 0 && (
                <button
                  onClick={handleClearAll}
                  className="flex-1 bg-red-50 text-red-600 hover:bg-red-100 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1 transition"
                >
                  <X size={16} /> Limpiar Todo
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
