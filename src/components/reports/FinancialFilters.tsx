"use client";

import { Search, Loader2 } from "lucide-react";

interface FinancialFiltersProps {
  placeholder: string;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  isLoading: boolean;
  isDebouncing: boolean;
}

export function FinancialFilters({
  placeholder,
  searchTerm,
  setSearchTerm,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  isLoading,
  isDebouncing,
}: FinancialFiltersProps) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
      <div className="relative w-full md:flex-1">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={18}
        />
        <input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm"
        />
        {(isDebouncing || isLoading) && (
          <Loader2
            size={16}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 animate-spin"
          />
        )}
      </div>
      <div className="flex gap-2 w-full md:w-auto">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="flex-1 md:w-auto p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-600 font-medium"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="flex-1 md:w-auto p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-600 font-medium"
        />
      </div>
    </div>
  );
}
