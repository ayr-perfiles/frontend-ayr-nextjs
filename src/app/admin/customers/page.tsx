"use client";

import { useEffect, useState } from "react";
import { fetchCustomersPaginated } from "@/services/crmService";
import { Users, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

import { CustomerFilters } from "@/components/crm/CustomerFilters";
import { CustomerTable } from "@/components/crm/CustomerTable";

export default function CustomersListPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // PAGINACIÓN Y BÚSQUEDA
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [pageSize, setPageSize] = useState(15); // Empezamos en 15 para clientes
  const [currentPage, setCurrentPage] = useState(1);
  const [firstDoc, setFirstDoc] = useState<any>(null);
  const [lastDoc, setLastDoc] = useState<any>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  // 1. EFECTO DEBOUNCE
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 2. FUNCIÓN DE CARGA
  const loadData = async (direction: "first" | "next" | "prev" = "first") => {
    setIsLoading(true);
    try {
      const res = await fetchCustomersPaginated({
        pageSize,
        searchTerm: debouncedSearchTerm,
        direction,
        cursorDoc:
          direction === "next"
            ? lastDoc
            : direction === "prev"
              ? firstDoc
              : null,
      });

      setCustomers(res.customers);
      setFirstDoc(res.firstDoc);
      setLastDoc(res.lastDoc);
      setFilteredTotal(res.totalCount || 0);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al cargar la cartera de clientes");
    } finally {
      setIsLoading(false);
    }
  };

  // 3. VIGILANTE DE BÚSQUEDA Y TAMAÑO
  useEffect(() => {
    setCurrentPage(1);
    loadData("first");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, pageSize]);

  // 4. HANDLERS NAVEGACIÓN
  const hasNextPage = customers.length === pageSize;
  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage((prev) => prev + 1);
      loadData("next");
    }
  };
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
      loadData("prev");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* CABECERA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="text-blue-600" /> Cartera de Clientes (CRM)
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Gestiona tus empresas, contactos e historial de compras de forma
            centralizada.
          </p>
        </div>
      </div>

      {/* FILTROS */}
      <CustomerFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        isSearching={isLoading && searchTerm !== ""}
      />

      {/* TABLA PRINCIPAL */}
      <div className="relative">
        <CustomerTable
          customers={customers}
          isLoading={isLoading}
          currentPage={currentPage}
          pageSize={pageSize}
        />
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* BOTONERA DE PAGINACIÓN */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-6 py-4 border border-slate-200 rounded-xl shadow-sm gap-4 mt-6">
        <div className="w-full sm:w-1/3 flex justify-center sm:justify-start">
          <div className="flex flex-col">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Clientes encontrados
            </p>
            <p className="text-sm font-black text-blue-600">
              {filteredTotal} {filteredTotal === 1 ? "empresa" : "empresas"}
            </p>
          </div>
        </div>

        <div className="w-full sm:w-1/3 flex items-center justify-center gap-3">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1 || isLoading}
            className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm border border-slate-200"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-xs font-bold text-slate-500 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 shadow-inner">
            Página{" "}
            <span className="font-black text-slate-800 text-sm mx-1">
              {currentPage}
            </span>
          </div>
          <button
            onClick={handleNextPage}
            disabled={!hasNextPage || isLoading}
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
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
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
