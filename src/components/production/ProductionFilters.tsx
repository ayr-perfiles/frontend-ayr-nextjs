import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  Loader2,
  X,
  Filter,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { StockSummary } from "@/types";

interface ProductionFiltersProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  filterSku: string;
  setFilterSku: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  stock: StockSummary[];
  isSearching: boolean;
}

export function ProductionFilters(props: ProductionFiltersProps) {
  const {
    searchTerm,
    setSearchTerm,
    filterSku,
    setFilterSku,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    stock,
    isSearching,
  } = props;
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node))
        setIsOpen(false);
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const activeFiltersCount =
    (startDate ? 1 : 0) + (endDate ? 1 : 0) + (filterSku !== "ALL" ? 1 : 0);

  const handleClearAll = () => {
    setStartDate("");
    setEndDate("");
    setFilterSku("ALL");
    setSearchTerm("");
    setIsOpen(false);
  };

  // PRESETS DE FECHA RÁPIDOS (Sin bugs)
  const applyDatePreset = (daysBack: number, isMonth = false) => {
    const today = new Date();
    const end = today.toISOString().split("T")[0];

    let start = new Date();
    if (isMonth) {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else {
      start.setDate(today.getDate() - daysBack);
    }

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end);
  };

  return (
    <div
      className="flex flex-col sm:flex-row gap-3 relative z-30"
      ref={menuRef}
    >
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
          placeholder="Buscar exactamente la Bobina de Origen..."
          className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-medium text-slate-700 transition shadow-sm uppercase"
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

        {isOpen && (
          <div className="absolute right-0 sm:left-auto left-0 top-full mt-2 w-full sm:w-80 bg-white border border-slate-100 rounded-2xl shadow-2xl p-5 animate-in fade-in zoom-in-95 z-50">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Filter size={14} /> Filtros de Producción
            </h4>

            <div className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                  Producto Específico (SKU)
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 transition"
                  value={filterSku}
                  onChange={(e) => setFilterSku(e.target.value)}
                >
                  <option value="ALL">Todos los Productos</option>
                  {stock.map((item) => (
                    <option key={item.sku} value={item.sku}>
                      {item.sku}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                  <Calendar size={12} /> Rango de Fechas
                </label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    onClick={() => applyDatePreset(0)}
                    className="bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 text-[10px] font-black py-2 rounded-lg transition uppercase tracking-wider"
                  >
                    Hoy
                  </button>
                  <button
                    onClick={() => applyDatePreset(7)}
                    className="bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 text-[10px] font-black py-2 rounded-lg transition uppercase tracking-wider"
                  >
                    7 Días
                  </button>
                  <button
                    onClick={() => applyDatePreset(0, true)}
                    className="bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 text-[10px] font-black py-2 rounded-lg transition uppercase tracking-wider"
                  >
                    Mes
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 ml-1">
                      Desde
                    </span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-2 outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 ml-1">
                      Hasta
                    </span>
                    <input
                      type="date"
                      min={startDate}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-2 outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200 py-2.5 rounded-xl text-sm font-bold transition"
              >
                Cerrar
              </button>
              {(searchTerm || activeFiltersCount > 0) && (
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
