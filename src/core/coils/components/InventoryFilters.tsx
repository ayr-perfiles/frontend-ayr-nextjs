"use client";

import React from "react";
import { TableFilters, FilterGroup } from "@/components/ui/TableFilters";
import { useFinishes } from "@/core/coils/hooks/useFinishes";

interface InventoryFiltersProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  isSearching: boolean;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  finishFilter: string;
  setFinishFilter: (val: string) => void;
  currencyFilter: string;
  setCurrencyFilter: (val: string) => void;
  providerFilter: string;
  setProviderFilter: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  onClear: () => void;
}

export function InventoryFilters({
  searchTerm,
  setSearchTerm,
  isSearching,
  statusFilter,
  setStatusFilter,
  finishFilter,
  setFinishFilter,
  currencyFilter,
  setCurrencyFilter,
  providerFilter,
  setProviderFilter,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  onClear,
}: InventoryFiltersProps) {
  const { finishes } = useFinishes(true);

  const filterGroups: FilterGroup[] = [
    {
      id: "status",
      label: "Estado de Bobina",
      layout: "list",
      value: statusFilter,
      onChange: setStatusFilter,
      options: [
        { value: "ALL", label: "Todas las Activas" },
        { value: "AVAILABLE", label: "Solo Disponibles" },
        { value: "EN_TERCERO", label: "En Corte Externo" },
        { value: "IN_PROGRESS", label: "En Producción" },
        { value: "PROCESSED", label: "Ya Procesadas" },
      ],
    },
    {
      id: "finish",
      label: "Acabado",
      layout: "grid",
      value: finishFilter,
      onChange: setFinishFilter,
      options: [
        { value: "ALL", label: "Todos" },
        ...finishes.map(f => ({ value: f.id, label: f.label })),
      ],
    },
    {
      id: "currency",
      label: "Moneda",
      layout: "grid",
      value: currencyFilter,
      onChange: setCurrencyFilter,
      options: [
        { value: "ALL", label: "Todas" },
        { value: "PEN", label: "Soles (PEN)" },
        { value: "USD", label: "Dólares (USD)" },
      ],
    },
  ];

  return (
    <TableFilters
      search={{
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: "Buscar por serie, documento o proveedor...",
        isSearching,
        onClear: () => setSearchTerm(""),
      }}
      filterGroups={filterGroups}
      dateRange={{
        startDate,
        endDate,
        setStartDate,
        setEndDate,
      }}
      onClearAll={onClear}
      additionalActiveCount={providerFilter ? 1 : 0}
      extraContent={
        <div className="space-y-2">
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">
            Proveedor
          </label>
          <input 
            type="text"
            placeholder="Filtrar Proveedor..."
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 text-slate-700 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition shadow-sm"
          />
        </div>
      }
    />
  );
}
