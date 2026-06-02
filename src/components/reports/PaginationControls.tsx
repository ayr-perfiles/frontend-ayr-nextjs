"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import React from "react";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: React.Dispatch<React.SetStateAction<number>>;
}

export function PaginationControls({
  page,
  totalPages,
  setPage,
  pageSize,
  setPageSize,
}: PaginationControlsProps) {
  return (
    <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 transition border border-slate-200"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-xs text-slate-500 font-medium">
          Pág.{" "}
          <span className="font-black text-slate-800 text-sm mx-1">{page}</span>{" "}
          de {totalPages || 1}
        </div>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages || totalPages === 0}
          className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 transition border border-slate-200"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Mostrar:
        </label>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 transition shadow-sm cursor-pointer"
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
