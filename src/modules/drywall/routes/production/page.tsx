"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useProduction } from "@/modules/drywall/hooks/useProduction";
import {
  Factory,
  History,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/clientApp";
import { useProductionLogs } from "@/modules/drywall/hooks/useProductionLogs";
import toast from "react-hot-toast";

import { ProductionFilters } from "@/modules/drywall/components/production/ProductionFilters";
import { ProductionTable } from "@/modules/drywall/components/production/ProductionTable";
import { StripsProductionModal } from "../../components/production/StripsProductionModal";
import { OutsourcedProductionForm } from "../../components/forms/OutsourcedProductionForm";
import { StripStock } from "@/types";
import { useConfirm } from "@/context/ConfirmContext";

export default function ProductionPage() {
  const { user, role } = useAuth();
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const skuParam = searchParams.get("sku");

  const { stock } = useProduction();

  // PRODUCCION FLOW
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedStrip, setSelectedStrip] = useState<StripStock | null>(null);

  // FILTROS DE PRODUCCIÓN
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSku, setFilterSku] = useState(skuParam || "ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pageSize, setPageSize] = useState(10);

  const {
    logs,
    loading,
    error,
    currentPage,
    filteredTotal,
    hasNextPage,
    nextPage,
    prevPage,
    refresh,
  } = useProductionLogs({ searchTerm, skuFilter: filterSku, startDate, endDate, pageSize });

  useEffect(() => {
    if (skuParam) {
      setFilterSku(skuParam);
    }
  }, [skuParam]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // ACCIONES
  const handleSelectStrip = (strip: StripStock) => {
    setSelectedStrip(strip);
    setShowStartModal(false);
  };

  const handleCloseProduction = () => {
    setSelectedStrip(null);
    refresh();
  };

  const handleVoidLog = async (logId: string, pieces: number) => {
    if (
      await confirm({
        title: "Anular Registro",
        message: `¿Estás seguro de ANULAR este registro de ${pieces} piezas? El inventario se restará y se ajustará el costo.`,
        variant: "danger",
        confirmLabel: "Anular",
      })
    ) {
      try {
        const revertFn = httpsCallable(functions, "revertProductionLog");
        await revertFn({ logId });
        toast.success("✅ Producción anulada y costos revertidos.");
        refresh();
      } catch (error: any) {
        toast.error(error.message || "Error al anular el registro.");
      }
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Factory className="text-blue-600" /> Producción y Costos
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Trazabilidad de máquina y control de costos de producción (Drywall).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowStartModal(true)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition active:scale-95 shadow-md shadow-blue-200 font-black uppercase tracking-widest text-xs"
          >
            <Factory size={18} /> Iniciar Producción
          </button>
        </div>
      </div>

      {showStartModal && (
        <StripsProductionModal
          onClose={() => setShowStartModal(false)}
          onSelect={handleSelectStrip}
        />
      )}

      {selectedStrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95">
            <OutsourcedProductionForm
              strip={selectedStrip}
              onClose={handleCloseProduction}
            />
          </div>
        </div>
      )}

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
            isSearching={loading && searchTerm !== ""}
          />
        </div>

        <div className="relative">
          <ProductionTable
            logs={logs}
            isLoading={loading}
            role={role}
            currentPage={currentPage}
            pageSize={pageSize}
            onVoidLog={handleVoidLog}
          />
          {loading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-6 py-4 border border-slate-200 rounded-xl shadow-sm gap-4 mt-6">
          <div className="w-full sm:w-1/3 flex justify-center sm:justify-start">
            <div className="flex flex-col">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Registros encontrados
              </p>
              <p className="text-sm font-black text-blue-600">
                {filteredTotal} {filteredTotal === 1 ? "registro" : "registros"}
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
              Página{" "}
              <span className="font-black text-slate-800 text-sm mx-1">
                {currentPage}
              </span>
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
              onChange={(e) => {
                setPageSize(Number(e.target.value));
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
