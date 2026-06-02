"use client";

import { useState, useEffect } from "react";
import { fetchAllKardexForExport, KardexMovement } from "@/services/kardexService";
import { getCatalog, ProductConfig } from "@/services/catalogService";
import { History, Package, FileSpreadsheet } from "lucide-react";
import toast from "react-hot-toast";

import { useKardex } from "@/core/hooks/useKardex";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { KardexFilters } from "@/components/kardex/KardexFilters";
import { KardexTable } from "@/components/kardex/KardexTable";
import { TablePagination } from "@/components/ui/TablePagination";

export default function KardexPage() {
  const [catalog, setCatalog] = useState<ProductConfig[]>([]);
  const [selectedSku, setSelectedSku] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    getCatalog().then((data) => setCatalog(data.sort((a, b) => a.sku.localeCompare(b.sku))));
  }, []);

  const { movements, loading, totalCount, globalStock, currentPage, hasNextPage, nextPage, prevPage } = useKardex({
    selectedSku, pageSize, startDate, endDate,
  });

  const handleExportExcel = async () => {
    toast.loading("Generando Excel...", { id: "excel" });
    try {
      const allData = await fetchAllKardexForExport(selectedSku, startDate, endDate);
      if (allData.length === 0) throw new Error("No hay datos para exportar");

      const headers = ["Fecha", "Hora", "Tipo de Movimiento", "Documento/Origen", "Detalle", "Cantidad", "Saldo Corriente", "Usuario Responsable"];
      const rows = allData.map((m: KardexMovement) => [
        m.date.toLocaleDateString("es-PE"),
        m.date.toLocaleTimeString("es-PE"),
        m.type === "IN" ? "ENTRADA" : "SALIDA",
        m.reference,
        m.description,
        m.type === "IN" ? `+${m.quantity}` : `-${m.quantity}`,
        m.balance,
        m.user,
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(","))].join("\n");
      const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `Reporte_Kardex_${selectedSku}_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Descargado exitosamente", { id: "excel" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al exportar", { id: "excel" });
    }
  };

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
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
          <EmptyState
            icon="ClipboardList"
            title="Esperando Selección"
            description="Busca un producto en la barra superior para calcular su Kardex."
          />
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-slate-900 p-6 rounded-3xl text-white flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-4">
              <div className="bg-slate-800 p-3 rounded-2xl">
                <Package size={24} className="text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Total Actual</p>
                <h2 className="text-3xl font-black">
                  {globalStock} <span className="text-lg text-slate-400 font-bold">Pzas</span>
                </h2>
              </div>
            </div>
          </div>

          <div className="relative">
            {loading && movements.length === 0 ? (
              <TableSkeleton rows={8} columns={8} />
            ) : (
              <KardexTable 
                movements={movements} 
                currentPage={currentPage} 
                pageSize={pageSize} 
                isLoading={loading && movements.length > 0} 
              />
            )}
          </div>

          <TablePagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={totalCount}
            totalLabel="movimientos"
            onPageChange={(page) => {
              if (page > currentPage) nextPage();
              else prevPage();
            }}
            pageSizeOptions={[15, 50]}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </div>
  );
}
