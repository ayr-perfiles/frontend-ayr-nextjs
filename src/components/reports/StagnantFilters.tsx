"use client";

import { Search, Loader2 } from "lucide-react";

interface StagnantFiltersProps {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  stagnantDays: number;
  setStagnantDays: (v: number) => void;
  isLoading: boolean;
  isDebouncing: boolean;
}

export function StagnantFilters({
  searchTerm,
  setSearchTerm,
  stagnantDays,
  setStagnantDays,
  isLoading,
  isDebouncing,
}: StagnantFiltersProps) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
      <div className="relative w-full md:flex-1">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={18}
        />
        <input
          type="text"
          placeholder="Buscar producto estancado..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-medium text-sm"
        />
        {(isDebouncing || isLoading) && (
          <Loader2
            size={16}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 animate-spin"
          />
        )}
      </div>
      <div className="flex items-center gap-2 w-full md:w-auto">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
          Sin ventas en:
        </label>
        <select
          value={stagnantDays}
          onChange={(e) => setStagnantDays(Number(e.target.value))}
          className="flex-1 md:w-auto p-2.5 bg-red-50 border border-red-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-bold text-red-700 cursor-pointer"
        >
          <option value={30}>Últimos 30 días</option>
          <option value={60}>Últimos 60 días</option>
          <option value={90}>Últimos 90 días</option>
          <option value={120}>Últimos 120 días</option>
        </select>
      </div>
    </div>
  );
}
