"use client";

import { useState } from "react";
import { Users, ChevronLeft, ChevronRight } from "lucide-react";

import { useCustomers } from "@/core/hooks/useCustomers";
import { CustomerFilters } from "@/components/crm/CustomerFilters";
import { CustomerTable } from "@/components/crm/CustomerTable";

export default function CustomersListPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(15);

  const { customers, loading, filteredTotal, currentPage, hasNextPage, nextPage, prevPage } = useCustomers({
    pageSize, searchTerm,
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="text-blue-600" /> Cartera de Clientes (CRM)
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Gestiona tus empresas, contactos e historial de compras de forma centralizada.
          </p>
        </div>
      </div>

      <CustomerFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        isSearching={loading && searchTerm !== ""}
      />

      <div className="relative">
        <CustomerTable
          customers={customers}
          isLoading={loading}
          currentPage={currentPage}
          pageSize={pageSize}
        />
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-6 py-4 border border-slate-200 rounded-xl shadow-sm gap-4 mt-6">
        <div className="w-full sm:w-1/3 flex justify-center sm:justify-start">
          <div className="flex flex-col">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clientes encontrados</p>
            <p className="text-sm font-black text-blue-600">
              {filteredTotal} {filteredTotal === 1 ? "empresa" : "empresas"}
            </p>
          </div>
        </div>
        <div className="w-full sm:w-1/3 flex items-center justify-center gap-3">
          <button
            onClick={prevPage}
            disabled={currentPage === 1 || loading}
            className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm border border-slate-200"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-xs font-bold text-slate-500 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 shadow-inner">
            Página <span className="font-black text-slate-800 text-sm mx-1">{currentPage}</span>
          </div>
          <button
            onClick={nextPage}
            disabled={!hasNextPage || loading}
            className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm border border-slate-200"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="w-full sm:w-1/3 flex items-center justify-center sm:justify-end gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
            Mostrar:
          </label>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 transition shadow-sm"
          >
            <option value={15}>15 empresas</option>
            <option value={30}>30 empresas</option>
            <option value={50}>50 empresas</option>
          </select>
        </div>
      </div>
    </div>
  );
}
