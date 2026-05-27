"use client";

import { YieldFilters } from "@/components/reports/YieldFilters";
import { YieldTable } from "@/components/reports/YieldTable";
import { ExtendedLog } from "@/services/reportsService";

interface ProdStats {
  totalUsedMm: number;
  totalScrapMm: number;
  totalScrapKg: number;
  avgEfficiency: number;
  totalOps: number;
}

interface ProductionTabProps {
  logs: ExtendedLog[];
  stats: ProdStats;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  isSearching: boolean;
}

export function ProductionTab({
  logs,
  stats,
  searchTerm,
  setSearchTerm,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  isSearching,
}: ProductionTabProps) {
  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      <YieldFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        isSearching={isSearching}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Eficiencia Global
          </p>
          <h3 className="text-4xl font-black text-slate-800">
            {stats.avgEfficiency.toFixed(1)}%
          </h3>
        </div>
        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Chatarra Generada
          </p>
          <h3 className="text-4xl font-black text-orange-400">
            {stats.totalScrapKg.toFixed(2)} kg
          </h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Ciclos de Corte
          </p>
          <h3 className="text-4xl font-black text-slate-800">{stats.totalOps}</h3>
        </div>
      </div>
      <YieldTable logs={logs} currentPage={1} pageSize={15} />
    </div>
  );
}
