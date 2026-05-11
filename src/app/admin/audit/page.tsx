"use client";

import { useEffect, useState } from "react";
import { fetchAuditLogsPaginated, AuditLog } from "@/services/auditService";
import { ShieldAlert, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

import { AuditFilters } from "@/components/audit/AuditFilters";
import { AuditTable } from "@/components/audit/AuditTable";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // PAGINACIÓN Y FILTROS
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [firstDoc, setFirstDoc] = useState<any>(null);
  const [lastDoc, setLastDoc] = useState<any>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadData = async (direction: "first" | "next" | "prev" = "first") => {
    setIsLoading(true);
    try {
      const res = await fetchAuditLogsPaginated({
        pageSize,
        searchTerm: debouncedSearchTerm,
        actionFilter,
        startDate,
        endDate,
        direction,
        cursorDoc:
          direction === "next"
            ? lastDoc
            : direction === "prev"
              ? firstDoc
              : null,
      });

      setLogs(res.logs);
      setFirstDoc(res.firstDoc);
      setLastDoc(res.lastDoc);
      setTotalCount(res.totalCount);
    } catch (error) {
      toast.error("Error al cargar la auditoría.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if ((startDate && !endDate) || (!startDate && endDate)) return;
    setCurrentPage(1);
    loadData("first");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, actionFilter, startDate, endDate, pageSize]);

  const handleNextPage = () => {
    if (logs.length === pageSize) {
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

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
            <ShieldAlert className="text-purple-600" /> Registro de Auditoría
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Supervisa las acciones críticas realizadas por tu equipo en el
            sistema.
          </p>
        </div>
      </div>

      <AuditFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        actionFilter={actionFilter}
        setActionFilter={setActionFilter}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        isSearching={isLoading && !!debouncedSearchTerm}
      />

      <div className="relative">
        <AuditTable
          logs={logs}
          isLoading={isLoading}
          currentPage={currentPage}
          pageSize={pageSize}
        />
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-3xl">
            <Loader2 className="animate-spin text-purple-600" size={32} />
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-6 py-4 border border-slate-200 rounded-xl shadow-sm gap-4 mt-6">
        <div className="w-full sm:w-1/3 flex justify-center sm:justify-start">
          <div className="flex flex-col">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Logs detectados
            </p>
            <p className="text-sm font-black text-purple-600">
              {totalCount} Acciones
            </p>
          </div>
        </div>
        <div className="w-full sm:w-1/3 flex items-center justify-center gap-3">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1 || isLoading}
            className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-purple-50 disabled:opacity-50 transition border border-slate-200"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-xs font-bold text-slate-500 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 shadow-inner">
            Página{" "}
            <span className="font-black text-slate-800 text-sm mx-1">
              {currentPage}
            </span>{" "}
            de {totalPages || 1}
          </div>
          <button
            onClick={handleNextPage}
            disabled={logs.length < pageSize || isLoading}
            className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-purple-50 disabled:opacity-50 transition border border-slate-200"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="w-full sm:w-1/3 flex justify-center sm:justify-end gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right mt-2">
            Mostrar:
          </label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:border-purple-500 transition shadow-sm cursor-pointer"
          >
            <option value={15}>15 ítems</option>
            <option value={50}>50 ítems</option>
            <option value={100}>100 ítems</option>
          </select>
        </div>
      </div>
    </div>
  );
}
