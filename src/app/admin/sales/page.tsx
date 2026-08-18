"use client";

import { useState } from "react";
import { Sale } from "@/types";
import {
  Plus,
  FileSpreadsheet,
  Download,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";

import { approveQuotation, cancelQuotation } from "@/services/salesService";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useSales } from "@/core/hooks/useSales";
import { SalesMetrics } from "@/components/sales/SalesMetrics";
import { SalesFilters } from "@/components/sales/SalesFilters";
import { SalesTable } from "@/components/sales/SalesTable";
import { SaleDetailsModal } from "@/components/sales/SaleDetailsModal";
import { TablePagination } from "@/components/ui/TablePagination";

function HeaderOptions({ onExport }: { onExport: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative z-40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition font-bold shadow-sm"
      >
        Opciones <ChevronDown size={18} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in zoom-in-95">
            <p className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Herramientas</p>
            <button
              onClick={() => { setIsOpen(false); onExport(); }}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 font-medium transition"
            >
              <Download size={18} className="text-slate-400" /> Descargar Reporte Excel
            </button>
            <button
              onClick={() => { setIsOpen(false); window.location.href = "/admin/sales/import"; }}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 font-medium transition"
            >
              <FileSpreadsheet size={18} className="text-green-500" /> Importar Ventas (Excel)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function SalesPage() {
  const { user, role } = useAuth();
  const confirm = useConfirm();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [businessLine, setBusinessLine] = useState<"ALL" | "drywall" | "roofing" | "metallic-roofing" | "trading" | "services">("ALL");
  const [sunatFilter, setSunatFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pageSize, setPageSize] = useState(10);

  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { sales, loading, error, filteredTotal, aggregateCount, aggregates, isAlgolia, currentPage, nextPage, prevPage, refresh, metricLabel } = useSales({
    pageSize, statusFilter, businessLine, searchTerm, startDate, endDate, sunatFilter,
  });



  const handleApprove = async (sale: Sale) => {
    if (
      !(await confirm({
        title: "Convertir Cotización",
        message: `¿Deseas convertir la cotización ${sale.id} en una Venta Real? Esto descontará stock.`,
        variant: "default",
        confirmLabel: "Convertir",
      }))
    )
      return;
    setIsProcessing(true);
    try {
      await approveQuotation(sale.id!);
      toast.success("Venta aprobada correctamente");
      refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Error al aprobar venta");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async (saleId: string) => {
    if (
      !(await confirm({
        title: "Cancelar Cotización",
        message: `¿Deseas cancelar la cotización ${saleId}? Esto la marcará como rechazada.`,
        variant: "danger",
      }))
    )
      return;
    setIsProcessing(true);
    try {
      await cancelQuotation(saleId, user?.email || "usuario");
      toast.success("Cotización cancelada");
      refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Error al cancelar cotización");
    } finally {
      setIsProcessing(false);
    }
  };

  const totalRevenue = aggregates?.totalAmount || 0;
  const totalProfit = aggregates?.totalProfit || 0;
  const totalWeight = aggregates?.totalWeight || 0;

  return (
    <div className="space-y-6 relative pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Historial de Ventas</h1>
          <p className="text-slate-500 font-medium mt-1">Registro de operaciones, cotizaciones y utilidades</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <HeaderOptions
            onExport={() => toast.success("Generando Excel...")}
          />
          <button
            onClick={() => (window.location.href = "/admin/sales/new")}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition active:scale-95 shadow-md shadow-blue-200 font-black flex-1 md:flex-none"
          >
            <Plus size={20} /> Nueva Venta
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
          <div>
            <h3 className="font-bold text-sm">Error al cargar datos</h3>
            <p className="text-xs mt-1 font-medium">{error}</p>
          </div>
        </div>
      )}

      <SalesMetrics
        totalRevenue={totalRevenue}
        totalProfit={totalProfit}
        totalWeight={totalWeight}
        count={aggregateCount}
        isAlgolia={isAlgolia}
        metricLabel={metricLabel}
      />



      <SalesFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        businessLine={businessLine}
        setBusinessLine={setBusinessLine}
        sunatFilter={sunatFilter}
        setSunatFilter={setSunatFilter}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        onClear={() => {
          setSearchTerm("");
          setStatusFilter("ALL");
          setBusinessLine("ALL");
          setSunatFilter("ALL");
          setStartDate("");
          setEndDate("");
        }}
      />

      <div className="relative">
        <SalesTable
          displaySales={sales}
          isLoading={loading}
          onViewDetails={(sale) => setViewingSale(sale)}
          onApprove={handleApprove}
          onCancel={handleCancel}
          isProcessing={isProcessing}
          role={role}
          currentPage={currentPage}
          pageSize={pageSize}
          onDuplicate={(saleId) => (window.location.href = `/admin/sales/new?duplicateId=${saleId}`)}
          onEdit={(saleId) => (window.location.href = `/admin/sales/${saleId}/edit`)}
        />
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-2xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}
      </div>

      <TablePagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={filteredTotal}
        onPageChange={(page) => {
          if (page > currentPage) nextPage();
          else if (page < currentPage) prevPage();
        }}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 15, 25, 50]}
        mode="cursor"
      />

      {viewingSale && (
        <SaleDetailsModal sale={viewingSale} onClose={() => setViewingSale(null)} onSuccess={refresh} />
      )}
    </div>
  );
}
