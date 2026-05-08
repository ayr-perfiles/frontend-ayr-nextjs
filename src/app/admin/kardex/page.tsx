"use client";

import { useState, useEffect } from "react";
import {
  fetchKardexPaginated,
  fetchAllKardexForExport,
  KardexMovement,
} from "@/services/kardexService";
import { getCatalog, ProductConfig } from "@/services/catalogService";
import {
  History,
  Package,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from "lucide-react";
import toast from "react-hot-toast";

import { KardexFilters } from "@/components/kardex/KardexFilters";
import { KardexTable } from "@/components/kardex/KardexTable";

export default function KardexPage() {
  const [catalog, setCatalog] = useState<ProductConfig[]>([]);
  const [selectedSku, setSelectedSku] = useState<string>("");

  const [movements, setMovements] = useState<KardexMovement[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filtros y Paginación
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [firstDoc, setFirstDoc] = useState<any>(null);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [globalStock, setGlobalStock] = useState(0);

  // 1. Cargar el Catálogo al iniciar
  useEffect(() => {
    const loadCatalog = async () => {
      const data = await getCatalog();
      setCatalog(data.sort((a, b) => a.sku.localeCompare(b.sku)));
    };
    loadCatalog();
  }, []);

  // 2. Cargar historial del servidor
  const loadData = async (direction: "first" | "next" | "prev" = "first") => {
    if (!selectedSku) return;
    setIsLoading(true);
    try {
      const res = await fetchKardexPaginated({
        sku: selectedSku,
        pageSize,
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

      setMovements(res.movements);
      if (direction === "first" && res.movements.length > 0) {
        setGlobalStock(res.movements[0].balance);
      }
      setFirstDoc(res.firstDoc);
      setLastDoc(res.lastDoc);
      setTotalCount(res.totalCount);
    } catch (error) {
      toast.error("Error al cargar el Kardex.");
    } finally {
      setIsLoading(false);
    }
  };

  // Escuchar cambios
  useEffect(() => {
    if (!selectedSku) {
      setMovements([]);
      setTotalCount(0);
      return;
    }
    if ((startDate && !endDate) || (!startDate && endDate)) return;
    setCurrentPage(1);
    loadData("first");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSku, startDate, endDate, pageSize]);

  // Navegación
  const hasNextPage = movements.length === pageSize;
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

  // 5. EXPORTAR REPORTE A EXCEL
  const handleExportExcel = async () => {
    toast.loading("Generando Excel...", { id: "excel" });
    try {
      const allData = await fetchAllKardexForExport(
        selectedSku,
        startDate,
        endDate,
      );
      if (allData.length === 0) throw new Error("No hay datos para exportar");

      const headers = [
        "Fecha",
        "Hora",
        "Tipo de Movimiento",
        "Documento/Origen",
        "Detalle",
        "Cantidad",
        "Saldo Corriente",
        "Usuario Responsable",
      ];
      const rows = allData.map((m) => [
        m.date.toLocaleDateString("es-PE"),
        m.date.toLocaleTimeString("es-PE"),
        m.type === "IN" ? "ENTRADA" : "SALIDA",
        m.reference,
        m.description,
        m.type === "IN" ? `+${m.quantity}` : `-${m.quantity}`,
        m.balance,
        m.user,
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((r) => r.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute(
        "download",
        `Reporte_Kardex_${selectedSku}_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Descargado exitosamente", { id: "excel" });
    } catch (e: any) {
      toast.error(e.message, { id: "excel" });
    }
  };

  const currentStock = movements.length > 0 ? movements[0].balance : 0;
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <History className="text-blue-600" /> Kardex de Inventario
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Audita las entradas y salidas históricas manteniendo el saldo real.
          </p>
        </div>
        {selectedSku && (
          <button
            onClick={handleExportExcel}
            className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition active:scale-95 shadow-md shadow-emerald-200 font-black uppercase tracking-widest text-xs w-full md:w-auto"
          >
            <FileSpreadsheet size={18} /> Exportar Excel
          </button>
        )}
      </div>

      <KardexFilters
        selectedSku={selectedSku}
        setSelectedSku={setSelectedSku}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        catalog={catalog}
      />

      {!selectedSku ? (
        <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center flex flex-col items-center shadow-sm">
          <Package size={64} className="text-slate-200 mb-4" />
          <h3 className="text-xl font-black text-slate-400">
            Esperando Selección
          </h3>
          <p className="text-sm font-medium text-slate-400 mt-2">
            Busca un producto en la barra superior para calcular su Kardex.
          </p>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-slate-900 p-6 rounded-3xl text-white flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-4">
              <div className="bg-slate-800 p-3 rounded-2xl">
                <Package size={24} className="text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Stock Total Actual
                </p>
                <h2 className="text-3xl font-black">
                  {globalStock}{" "}
                  <span className="text-lg text-slate-400 font-bold">Pzas</span>
                </h2>
              </div>
            </div>
          </div>

          <div className="relative">
            <KardexTable
              movements={movements}
              currentPage={currentPage}
              pageSize={pageSize}
            />
            {isLoading && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-3xl">
                <Loader2 className="animate-spin text-blue-600" size={32} />
              </div>
            )}
          </div>

          {/* BOTONERA DE PAGINACIÓN */}
          <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-6 py-4 border border-slate-200 rounded-xl shadow-sm gap-4 mt-6">
            <div className="w-full sm:w-1/3 flex justify-center sm:justify-start">
              <p className="text-sm font-black text-blue-600">
                {totalCount} Movimientos Totales
              </p>
            </div>
            <div className="w-full sm:w-1/3 flex items-center justify-center gap-3">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1 || isLoading}
                className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-blue-50 disabled:opacity-50 transition border border-slate-200"
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
                className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-blue-50 disabled:opacity-50 transition border border-slate-200"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="w-full sm:w-1/3 flex justify-center sm:justify-end">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-slate-200 rounded-lg p-2 text-xs font-bold bg-slate-50"
              >
                <option value={15}>15 ítems</option>
                <option value={50}>50 ítems</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
