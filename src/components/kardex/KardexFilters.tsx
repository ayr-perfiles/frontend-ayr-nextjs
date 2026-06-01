import React from "react";
import { PackageSearch, ChevronDown, Calendar, Clock } from "lucide-react";
import { ProductConfig } from "@/services/catalogService";
import { TableFilters } from "@/components/ui/TableFilters";

interface KardexFiltersProps {
  selectedSku: string;
  setSelectedSku: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  catalog: ProductConfig[];
}

export function KardexFilters({
  selectedSku,
  setSelectedSku,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  catalog,
}: KardexFiltersProps) {
  const applyDatePreset = (daysBack: number, isMonth = false) => {
    const today = new Date();
    const end = today.toISOString().split("T")[0];
    let start = new Date();
    if (isMonth) start = new Date(today.getFullYear(), today.getMonth(), 1);
    else start.setDate(today.getDate() - daysBack);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end);
  };

  const extraContent = (
    <div className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
        <Clock size={12} /> Presets de Tiempo
      </h4>
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => applyDatePreset(0)}
          className="bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 text-[10px] font-black py-2.5 rounded-xl transition uppercase tracking-widest border border-slate-200/50"
        >
          Hoy
        </button>
        <button
          onClick={() => applyDatePreset(7)}
          className="bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 text-[10px] font-black py-2.5 rounded-xl transition uppercase tracking-widest border border-slate-200/50"
        >
          7 Días
        </button>
        <button
          onClick={() => applyDatePreset(0, true)}
          className="bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 text-[10px] font-black py-2.5 rounded-xl transition uppercase tracking-widest border border-slate-200/50"
        >
          Mes
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col sm:flex-row gap-3 relative z-30">
      {/* 1. SELECTOR PRINCIPAL DE SKU */}
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <PackageSearch className="text-slate-400" size={18} />
        </div>
        <select
          value={selectedSku}
          onChange={(e) => setSelectedSku(e.target.value)}
          className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-black text-slate-800 transition shadow-sm appearance-none cursor-pointer uppercase"
        >
          <option value="">-- SELECCIONA UN PRODUCTO (SKU) --</option>
          {catalog.map((p) => (
            <option key={p.sku} value={p.sku}>
              {p.sku} - {p.name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
      </div>

      {/* 2. TABLE FILTERS (FECHAS) */}
      <div className="sm:w-auto w-full">
        <TableFilters
          dateRange={{
            startDate,
            endDate,
            setStartDate,
            setEndDate,
          }}
          extraContent={extraContent}
          onClearAll={() => {
            setStartDate("");
            setEndDate("");
          }}
          rightSlot={null}
        />
      </div>
    </div>
  );
}
