import React from "react";
import { TableFilters, FilterGroup } from "@/components/ui/TableFilters";
import { Calendar } from "lucide-react";

interface AuditFiltersProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  actionFilter: string;
  setActionFilter: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  isSearching: boolean;
}

export function AuditFilters({
  searchTerm,
  setSearchTerm,
  actionFilter,
  setActionFilter,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  isSearching,
}: AuditFiltersProps) {
  const applyDatePreset = (daysBack: number, isMonth = false) => {
    const today = new Date();
    const end = today.toISOString().split("T")[0];
    let start = new Date();
    if (isMonth) start = new Date(today.getFullYear(), today.getMonth(), 1);
    else start.setDate(today.getDate() - daysBack);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end);
  };

  const filterGroups: FilterGroup[] = [
    {
      id: "action",
      label: "Tipo de Acción",
      value: actionFilter,
      onChange: (v) => setActionFilter(v),
      options: [
        { value: "ALL", label: "Todas las Acciones" },
        { value: "VOID_PRODUCTION", label: "Cortes Anulados" },
        { value: "VOID_COIL", label: "Bobinas Anuladas" },
        { value: "EDIT_COIL", label: "Edición de Bobinas" },
      ],
      layout: "list",
    },
  ];

  const handleClearAll = () => {
    setStartDate("");
    setEndDate("");
    setActionFilter("ALL");
    setSearchTerm("");
  };

  const extraContent = (
    <div className="space-y-3">
      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
        <Calendar size={14} /> Accesos Rápidos (Fechas)
      </label>
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => applyDatePreset(0)}
          className="bg-slate-100 hover:bg-purple-50 text-slate-600 hover:text-purple-600 text-[10px] font-black py-2.5 rounded-xl transition uppercase tracking-wider border border-transparent hover:border-purple-200"
        >
          Hoy
        </button>
        <button
          onClick={() => applyDatePreset(7)}
          className="bg-slate-100 hover:bg-purple-50 text-slate-600 hover:text-purple-600 text-[10px] font-black py-2.5 rounded-xl transition uppercase tracking-wider border border-transparent hover:border-purple-200"
        >
          7 Días
        </button>
        <button
          onClick={() => applyDatePreset(0, true)}
          className="bg-slate-100 hover:bg-purple-50 text-slate-600 hover:text-purple-600 text-[10px] font-black py-2.5 rounded-xl transition uppercase tracking-wider border border-transparent hover:border-purple-200"
        >
          Mes
        </button>
      </div>
    </div>
  );

  return (
    <TableFilters
      search={{
        value: searchTerm,
        onChange: (val) => setSearchTerm(val.toLowerCase()),
        placeholder: "Buscar por correo electrónico del usuario...",
        isSearching,
      }}
      filterGroups={filterGroups}
      dateRange={{
        startDate,
        endDate,
        setStartDate,
        setEndDate,
      }}
      extraContent={extraContent}
      onClearAll={handleClearAll}
    />
  );
}
