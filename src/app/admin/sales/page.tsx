"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  query,
  where,
  getCountFromServer,
  getAggregateFromServer,
  sum,
} from "firebase/firestore";
import { Sale } from "@/types";
import {
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";

import { fetchSales, approveQuotation } from "@/services/salesService";
import { useAuth } from "@/context/AuthContext";
import { SalesMetrics } from "@/components/sales/SalesMetrics";
import { SalesFilters } from "@/components/sales/SalesFilters";
import { SalesTable } from "@/components/sales/SalesTable";
import { SaleDetailsModal } from "@/components/sales/SaleDetailsModal";
import { BulkUploadSales } from "@/components/sales/BulkUploadSales";

// --- SUB-COMPONENTE: MENÚ DE OPCIONES ---
function HeaderOptions({ onExport, onOpenExcel }: any) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative z-40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition font-bold shadow-sm"
      >
        Opciones{" "}
        <ChevronDown
          size={18}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in zoom-in-95">
            <p className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Herramientas
            </p>
            <button
              onClick={() => {
                setIsOpen(false);
                onExport();
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 font-medium transition"
            >
              <Download size={18} className="text-slate-400" /> Descargar
              Reporte Excel
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenExcel();
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 font-medium transition"
            >
              <FileSpreadsheet size={18} className="text-green-500" /> Importar
              Ventas (Excel)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function SalesPage() {
  const { user, role } = useAuth();

  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [firstDoc, setFirstDoc] = useState<any>(null);
  const [lastDoc, setLastDoc] = useState<any>(null);

  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [showExcelModal, setShowExcelModal] = useState(false);

  // 1. EFECTO DEBOUNCE (Para que no colapse al teclear rápido)
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
      const res = await fetchSales({
        pageSize,
        statusFilter,
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

      setSales(res.sales);
      setFirstDoc(res.firstDoc);
      setLastDoc(res.lastDoc);
      setFilteredTotal(res.totalCount || 0);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al cargar las ventas");
    } finally {
      setIsLoading(false);
    }
  };

  // 3. VIGILANTE DE FILTROS Y BÚSQUEDA
  useEffect(() => {
    if ((startDate && !endDate) || (!startDate && endDate)) return;

    setCurrentPage(1);
    loadData("first");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, startDate, endDate, pageSize, debouncedSearchTerm]);

  // 4. PAGINACIÓN
  const hasNextPage = sales.length === pageSize;

  const handleNextPage = () => {
    if (!hasNextPage) return;
    setCurrentPage((prev) => prev + 1);
    loadData("next");
  };

  const handlePrevPage = () => {
    if (currentPage <= 1) return;
    setCurrentPage((prev) => prev - 1);
    loadData("prev");
  };

  const handleApprove = async (sale: Sale) => {
    if (
      !confirm(
        `¿Deseas convertir la cotización ${sale.id} en una Venta Real? Esto descontará stock.`,
      )
    )
      return;
    setIsProcessing(true);
    try {
      await approveQuotation(sale.id!);
      toast.success("Venta aprobada correctamente");
      loadData("first");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Cálculos de métricas
  const totalRevenue = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const totalProfit = sales.reduce((sum, s) => sum + (s.totalProfit || 0), 0);
  const totalWeight = sales.reduce(
    (sum, s) => sum + ((s as any).totalWeight || 0),
    0,
  );

  return (
    <div className="space-y-6 relative pb-10">
      {/* CABECERA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Historial de Ventas
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Registro de operaciones, cotizaciones y utilidades
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <HeaderOptions
            onExport={() => toast.success("Generando Excel...")}
            onOpenExcel={() => setShowExcelModal(true)}
          />
          <button className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition active:scale-95 shadow-md shadow-blue-200 font-black flex-1 md:flex-none">
            <Plus size={20} /> Nueva Venta
          </button>
        </div>
      </div>

      <SalesMetrics
        totalRevenue={totalRevenue}
        totalProfit={totalProfit}
        totalWeight={totalWeight}
      />

      {/* COMPONENTE DE FILTROS TOTALMENTE LIMPIO */}
      <SalesFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        isSearching={isLoading && searchTerm !== ""}
        onClearSearch={() => {}}
      />

      <div className="relative">
        <SalesTable
          displaySales={sales}
          isLoading={isLoading}
          role={role}
          isProcessing={isProcessing}
          currentPage={currentPage}
          pageSize={pageSize}
          onPrint={(sale) => window.print()}
          onDuplicate={(id) => toast.success(`Duplicando ${id}`)}
          onApprove={handleApprove}
          onViewDetails={setViewingSale}
        />

        {isLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-6 py-4 border border-slate-200 rounded-xl shadow-sm gap-4 mt-6">
        <div className="w-full sm:w-1/3 flex justify-center sm:justify-start">
          <div className="flex flex-col">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Operaciones encontradas
            </p>
            <p className="text-sm font-black text-blue-600">
              {filteredTotal} {filteredTotal === 1 ? "registro" : "registros"}
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
            <option value={10}>10 ítems</option>
            <option value={25}>25 ítems</option>
            <option value={50}>50 ítems</option>
          </select>
        </div>
      </div>

      {viewingSale && (
        <SaleDetailsModal
          sale={viewingSale}
          onClose={() => setViewingSale(null)}
        />
      )}

      {showExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl relative my-8 animate-in fade-in zoom-in-95">
            <button
              onClick={() => {
                setShowExcelModal(false);
                loadData("first");
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 z-10 bg-white rounded-full p-1 shadow-sm border border-slate-100 transition"
            >
              <X size={20} />
            </button>
            <BulkUploadSales />
          </div>
        </div>
      )}
    </div>
  );
}
