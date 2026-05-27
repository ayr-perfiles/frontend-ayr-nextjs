"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface InventoryPaginationProps {
  filteredTotal: number;
  currentPage: number;
  hasNextPage: boolean;
  isAlgoliaMode: boolean;
  algoliaTotalPages: number;
  loading: boolean;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
  onPageSizeChange: (size: number) => void;
}

export function InventoryPagination({
  filteredTotal,
  currentPage,
  hasNextPage,
  isAlgoliaMode,
  algoliaTotalPages,
  loading,
  pageSize,
  onPrev,
  onNext,
  onPageSizeChange,
}: InventoryPaginationProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-6 py-4 border border-slate-200 rounded-xl shadow-sm gap-4 mt-6">
      <div className="w-full sm:w-1/3 flex justify-center sm:justify-start">
        <div className="flex flex-col">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Resultados encontrados
          </p>
          <p className="text-sm font-black text-blue-600">
            {filteredTotal} {filteredTotal === 1 ? "bobina" : "bobinas"}
          </p>
        </div>
      </div>

      <div className="w-full sm:w-1/3 flex items-center justify-center gap-3">
        <button
          onClick={onPrev}
          disabled={currentPage === 1 || loading}
          className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm border border-slate-200"
          title="Página anterior"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="text-xs font-bold text-slate-500 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 shadow-inner">
          Página{" "}
          <span className="font-black text-slate-800 text-sm mx-1">
            {currentPage}
          </span>
          {isAlgoliaMode && algoliaTotalPages > 0 && (
            <span> de {algoliaTotalPages}</span>
          )}
        </div>

        <button
          onClick={onNext}
          disabled={!hasNextPage || loading}
          className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm border border-slate-200"
          title="Página siguiente"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="w-full sm:w-1/3 flex items-center justify-center sm:justify-end gap-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Ver:
        </label>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 transition shadow-sm"
        >
          <option value={10}>10 ítems</option>
          <option value={25}>25 ítems</option>
          <option value={50}>50 ítems</option>
          <option value={100}>100 ítems</option>
        </select>
      </div>
    </div>
  );
}
