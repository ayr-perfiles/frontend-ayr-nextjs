"use client";

import { useEffect, useState } from "react";
import {
  getYieldReport,
  fetchAllYieldForExport,
  ExtendedLog,
} from "@/services/reportsService";
import {
  BarChart3,
  Download,
  ChevronLeft,
  ChevronRight,
  Target,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

import { YieldFilters } from "@/components/reports/YieldFilters";
import { YieldTable } from "@/components/reports/YieldTable";

export default function ReportsPage() {
  const [logs, setLogs] = useState<ExtendedLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsedMm: 0,
    totalScrapMm: 0,
    totalScrapKg: 0,
    avgEfficiency: 0,
    totalOps: 0,
  });

  // Paginación y Filtros
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  // Cursores para Firebase
  const [firstDoc, setFirstDoc] = useState<any>(null);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadReport = async (direction: "first" | "next" | "prev" = "first") => {
    setIsLoading(true);
    try {
      const data = await getYieldReport({
        pageSize,
        searchTerm: debouncedSearchTerm,
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

      setLogs(data.logs);
      setStats(data.stats);
      setFirstDoc(data.firstDoc);
      setLastDoc(data.lastDoc);
      setTotalCount(data.stats.totalOps); // Obtenido con agregación en servidor
    } catch (error) {
      toast.error("Error al cargar el reporte");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if ((startDate && !endDate) || (!startDate && endDate)) return;
    setCurrentPage(1);
    loadReport("first");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, debouncedSearchTerm, pageSize]);

  // Manejadores de Paginación
  const handleNextPage = () => {
    if (logs.length === pageSize) {
      setCurrentPage((prev) => prev + 1);
      loadReport("next");
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
      loadReport("prev");
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Exportar Excel usando el servicio masivo
  const exportToExcel = async () => {
    toast.loading("Generando Excel...", { id: "excel" });
    try {
      const allData = await fetchAllYieldForExport(
        startDate,
        endDate,
        debouncedSearchTerm,
      );
      if (allData.length === 0) throw new Error("No hay datos para exportar");

      const headers = [
        "Bobina Madre",
        "Producto",
        "Ancho Usado (mm)",
        "Merma Generada (mm)",
        "Merma Estimada (kg)",
        "Fecha",
        "Estado",
      ];
      const rows = allData.map((log) => [
        log.parentCoilId,
        log.sku,
        log.totalUsedWidth || 0,
        log.scrapWidth || 0,
        (log.scrapWeightKg || 0).toFixed(2),
        log.timestamp?.toDate
          ? log.timestamp.toDate().toLocaleString()
          : "Sin fecha",
        log.status === "VOIDED" ? "ANULADO" : "VÁLIDO",
      ]);
      const csvContent = [
        headers.join(","),
        ...rows.map((r) => r.join(",")),
      ].join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute(
        "download",
        `Reporte_Produccion_${new Date().toLocaleDateString()}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Excel descargado correctamente", { id: "excel" });
    } catch (error: any) {
      toast.error(error.message, { id: "excel" });
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      {/* CABECERA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-slate-900 tracking-tight">
            <BarChart3 className="text-blue-600" /> Rendimiento de Planta
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Análisis de aprovechamiento y control de mermas.
          </p>
        </div>
        <button
          onClick={exportToExcel}
          className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-emerald-700 transition shadow-sm font-black uppercase tracking-widest text-xs w-full md:w-auto justify-center"
        >
          <Download size={18} /> Exportar Reporte
        </button>
      </div>

      {/* KPIs SUPERIORES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Eficiencia Global
          </p>
          <h3 className="text-4xl font-black text-slate-800 tracking-tighter">
            {stats.avgEfficiency.toFixed(1)}%
          </h3>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-4">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${stats.avgEfficiency}%` }}
            ></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Merma (Ancho)
          </p>
          <h3 className="text-4xl font-black text-slate-800 tracking-tighter">
            {stats.totalScrapMm}{" "}
            <span className="text-lg font-bold text-slate-400">mm</span>
          </h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden bg-slate-900 text-white">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Merma (Peso Estimado)
          </p>
          <h3 className="text-4xl font-black tracking-tighter text-orange-400">
            {stats.totalScrapKg}{" "}
            <span className="text-lg font-bold text-slate-500">kg</span>
          </h3>
          <p className="text-[10px] text-slate-400 mt-2">
            Chatarra valorizable
          </p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Operaciones
          </p>
          <h3 className="text-4xl font-black text-slate-800 tracking-tighter">
            {stats.totalOps}
          </h3>
          <p className="text-xs text-slate-400 mt-2 font-medium">
            Ciclos procesados.
          </p>
        </div>
      </div>

      {/* SECCIÓN PRINCIPAL: FILTROS + TABLA */}
      <section className="space-y-4 relative">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 pt-2">
          <Target size={16} className="text-blue-500" /> Detalle de
          Aprovechamiento
        </h2>

        <YieldFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          isSearching={isLoading && !!debouncedSearchTerm}
        />

        <div className="relative">
          <YieldTable
            logs={logs} // <-- Ahora pasamos logs directos, sin el slice
            currentPage={currentPage}
            pageSize={pageSize}
          />
          {isLoading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-3xl">
              <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
          )}
        </div>

        {/* PAGINACIÓN INFERIOR DE 3 COLUMNAS */}
        <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-6 py-4 border border-slate-200 rounded-xl shadow-sm gap-4 mt-6">
          <div className="w-full sm:w-1/3 flex justify-center sm:justify-start">
            <div className="flex flex-col">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Cortes Analizados
              </p>
              <p className="text-sm font-black text-blue-600">
                {totalCount} Registros
              </p>
            </div>
          </div>
          <div className="w-full sm:w-1/3 flex items-center justify-center gap-3">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1 || isLoading}
              className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 transition border border-slate-200"
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
              className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 transition border border-slate-200"
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
              className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 transition shadow-sm cursor-pointer"
            >
              <option value={15}>15 ítems</option>
              <option value={50}>50 ítems</option>
              <option value={100}>100 ítems</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}
