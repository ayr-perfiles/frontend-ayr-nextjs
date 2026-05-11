"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/clientApp";
import { collection, query, onSnapshot } from "firebase/firestore";
import { ProductionLog, StockSummary } from "@/types";
import {
  Factory,
  Package,
  History,
  DollarSign,
  TrendingUp,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  revertProductionLog,
  fetchProductionLogs,
} from "@/services/productionService";
import toast from "react-hot-toast";

import { ProductionFilters } from "@/components/production/ProductionFilters";
import { ProductionTable } from "@/components/production/ProductionTable";

export default function ProductionPage() {
  const { user, role } = useAuth();

  // ESTADOS DE STOCK Y LOGS
  const [stock, setStock] = useState<StockSummary[]>([]);
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // PAGINACIÓN Y FILTROS
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [firstDoc, setFirstDoc] = useState<any>(null);
  const [lastDoc, setLastDoc] = useState<any>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterSku, setFilterSku] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // 1. CARGA DE STOCK GLOBAL (En tiempo real)
  useEffect(() => {
    const qStock = query(collection(db, "inventory_stock"));
    const unsubStock = onSnapshot(qStock, (snapshot) => {
      setStock(
        snapshot.docs.map((doc) => ({
          sku: doc.id,
          ...doc.data(),
        })) as StockSummary[],
      );
    });
    return () => unsubStock();
  }, []);

  // 2. DEBOUNCE PARA BÚSQUEDA DE BOBINAS
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 3. CARGAR DATOS DE PRODUCCIÓN
  const loadData = async (direction: "first" | "next" | "prev" = "first") => {
    setIsLoading(true);
    try {
      const res = await fetchProductionLogs({
        pageSize,
        skuFilter: filterSku,
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

      setLogs(res.logs);
      setFirstDoc(res.firstDoc);
      setLastDoc(res.lastDoc);
      setFilteredTotal(res.totalCount || 0);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al cargar historial");
    } finally {
      setIsLoading(false);
    }
  };

  // 4. VIGILANTE DE FILTROS
  useEffect(() => {
    if ((startDate && !endDate) || (!startDate && endDate)) return;
    setCurrentPage(1);
    loadData("first");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSku, startDate, endDate, pageSize, debouncedSearchTerm]);

  // 5. NAVEGACIÓN
  const hasNextPage = logs.length === pageSize;
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

  // 6. ACCIONES
  const handleVoidLog = async (logId: string, pieces: number) => {
    if (
      confirm(
        `¿Estás seguro de ANULAR este corte de ${pieces} piezas? El inventario se restará y el fleje volverá a la bobina.`,
      )
    ) {
      try {
        await revertProductionLog(logId, user?.email || "Admin");
        toast.success("✅ Producción anulada y costos revertidos.");
        loadData("first"); // Refrescamos la tabla tras anular
      } catch (error: any) {
        toast.error(error.message);
      }
    }
  };

  const exportStockToExcel = () => {
    const headers = [
      "Producto (SKU)",
      "Unidades Físicas",
      "Costo Unitario (S/)",
      "Valor Total (S/)",
    ];
    const rows = stock.map((item) => {
      const costPerPiece = item.lastCostPerPiece || 0;
      return [
        item.sku,
        item.totalQuantity,
        costPerPiece.toFixed(4),
        (item.totalQuantity * costPerPiece).toFixed(2),
      ];
    });
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
      `Valorizacion_Stock_${new Date().toLocaleDateString()}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Factory className="text-blue-600" /> Producción y Costos
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Control de inventario valorizado y trazabilidad de máquina.
          </p>
        </div>
        <button
          onClick={exportStockToExcel}
          className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition active:scale-95 shadow-md shadow-emerald-200 font-black uppercase tracking-widest text-xs"
        >
          <Download size={18} /> Exportar Stock
        </button>
      </div>

      <section>
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Package size={16} /> Stock Disponible para Venta
        </h2>

        {stock.length === 0 && !isLoading ? (
          <div className="p-6 bg-white rounded-xl border border-dashed border-slate-300 text-center text-slate-500">
            Aún no hay productos procesados.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {stock.map((item) => {
              const costPerPiece = item.lastCostPerPiece || 0;
              const totalValue = item.totalQuantity * costPerPiece;
              return (
                <div
                  key={item.sku}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-black text-slate-700 uppercase bg-slate-100 px-3 py-1 rounded-full group-hover:bg-blue-50 group-hover:text-blue-700 transition">
                      {item.sku}
                    </span>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                      <Package size={18} />
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-4xl font-black text-slate-800 tracking-tighter">
                      {item.totalQuantity}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                      Unidades Físicas
                    </p>
                  </div>
                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-bold flex items-center gap-1">
                        <DollarSign size={12} /> Costo Unit.
                      </span>
                      <span className="font-mono font-black text-emerald-600">
                        S/ {costPerPiece.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-bold flex items-center gap-1">
                        <TrendingUp size={12} /> Valor Total
                      </span>
                      <span className="font-mono font-black text-slate-700">
                        S/{" "}
                        {totalValue.toLocaleString("es-PE", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 mt-8">
          <History size={16} /> Historial Operativo (Conformadora)
        </h2>

        <div className="mb-4">
          <ProductionFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filterSku={filterSku}
            setFilterSku={setFilterSku}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            stock={stock}
            isSearching={isLoading && searchTerm !== ""}
          />
        </div>

        <div className="relative">
          <ProductionTable
            logs={logs}
            isLoading={isLoading}
            role={role}
            currentPage={currentPage}
            pageSize={pageSize}
            onVoidLog={handleVoidLog}
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
                Cortes encontrados
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
      </section>
    </div>
  );
}
