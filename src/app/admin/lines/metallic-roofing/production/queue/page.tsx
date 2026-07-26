"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSales } from "@/core/hooks/useSales";
import { getQuoteFulfillmentLogs } from "@/modules/metallic-roofing/services/productionService";
import { buildQueueRow, sortQueueFifo, getTimestampMillis, formatQuoteDisplayId, QueueRow } from "@/core/production/queueLogic";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";
import { TableFilters } from "@/components/ui/TableFilters";
import { TablePagination } from "@/components/ui/TablePagination";
import { useTableData } from "@/hooks/useTableData";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { Factory, Eye, Loader2 } from "lucide-react";
import { SaleDetailsModal } from "@/components/sales/SaleDetailsModal";
import { Sale } from "@/types";

export default function ProductionQueuePage() {
  const router = useRouter();
  
  const { sales: quotes, loading: loadingQuotes } = useSales({
    pageSize: 100,
    statusFilter: "QUOTATION",
    businessLine: "metallic-roofing",
    searchTerm: "",
    startDate: "",
    endDate: "",
    sunatFilter: "",
    productionStatusFilter: "CONFIRMED",
    skipAggregates: true,
  });

  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // Filtros propios de la página
  const [hideCompleted, setHideCompleted] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Sale | null>(null);

  useEffect(() => {
    if (!quotes || quotes.length === 0) {
      setRows([]);
      return;
    }
    
    let isMounted = true;
    
    const fetchLogs = async () => {
      setLoadingLogs(true);
      try {
        const rowPromises = quotes.map(async (q) => {
          const logs = await getQuoteFulfillmentLogs(q.id!);
          return buildQueueRow(q, logs);
        });
        const builtRows = await Promise.all(rowPromises);
        
        if (isMounted) {
          setRows(sortQueueFifo(builtRows));
        }
      } catch (err) {
        console.error("Error al cargar logs de producción:", err);
      } finally {
        if (isMounted) {
          setLoadingLogs(false);
        }
      }
    };
    
    fetchLogs();
    
    return () => { isMounted = false; };
  }, [quotes]);

  const {
    pageItems,
    searchValue,
    setSearchValue,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    setFilterValue,
    totalFiltered,
  } = useTableData({
    data: rows,
    filters: {
      "status-filter": (row, value) => {
        if (Array.isArray(value) && value.includes("hide_completed") && row.status === "CUMPLIDA") {
          return false;
        }
        return true;
      }
    },
    pageSize: 50,
  });

  const columns: ColumnDef<QueueRow>[] = useMemo(() => [
    {
      key: "quoteId",
      header: "N° Cotización",
      render: (row) => (
        <div className="font-semibold text-slate-800">
          {formatQuoteDisplayId(row.quoteId)}
        </div>
      )
    },
    {
      key: "customer",
      header: "Cliente",
      render: (row) => row.customerName
    },
    {
      key: "timestamp",
      header: "Fecha",
      render: (row) => {
        const millis = getTimestampMillis(row.timestamp);
        if (millis === Infinity) return <span className="text-slate-400">—</span>;
        const d = new Date(millis);
        const dateStr = d.toLocaleDateString("es-PE", { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima' });
        const timeStr = d.toLocaleTimeString("es-PE", { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' });
        return `${dateStr} ${timeStr}`;
      }
    },
    {
      key: "lines",
      header: "Líneas (Solicitado / Producido)",
      render: (row) => {
        const MAX_VISIBLE = 3;
        const visibleLines = row.lines.slice(0, MAX_VISIBLE);
        const hiddenCount = row.lines.length - MAX_VISIBLE;

        return (
          <div className="flex flex-col gap-1 text-sm">
            {visibleLines.map((l, i) => (
              <div key={i} className="flex flex-col border-b border-slate-100 last:border-0 pb-1 last:pb-0">
                <div className="flex flex-col mb-1">
                  {l.productNames.map((name, idx) => (
                    <span key={idx} className="font-medium text-slate-700 text-xs">{name}</span>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Req: {l.quantityRequested} ML</span>
                  <span>Prod: {l.quantityProduced.toFixed(2)} ML ({Math.round(l.pct)}%)</span>
                </div>
              </div>
            ))}
            {hiddenCount > 0 && (
              <div className="text-xs text-slate-400 font-medium pt-1 text-center bg-slate-50 rounded">
                +{hiddenCount} más
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: "status",
      header: "Estado",
      render: (row) => {
        const s = row.status;
        let color = "bg-slate-100 text-slate-600";
        if (s === "PENDIENTE") color = "bg-amber-100 text-amber-700";
        if (s === "PARCIAL") color = "bg-blue-100 text-blue-700";
        if (s === "CUMPLIDA") color = "bg-green-100 text-green-700";
        if (s === "SOBRE_PRODUCIDA") color = "bg-purple-100 text-purple-700";
        
        return (
          <span className={`px-2 py-1 rounded-md text-xs font-semibold ${color}`}>
            {s.replace("_", " ")}
          </span>
        );
      }
    },
    {
      key: "confirmedBy",
      header: "Confirmado por",
      render: (row) => row.confirmedBy || <span className="text-slate-400">—</span>
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <RowActionsMenu
          items={[
            {
              id: "produce",
              label: "PRODUCIR",
              icon: <Factory size={16} />,
              onClick: () => router.push(`/admin/lines/metallic-roofing/production/new?quoteId=${row.quoteId}`),
            },
            {
              id: "view",
              label: "Ver cotización",
              icon: <Eye size={16} />,
              onClick: () => {
                const sale = quotes.find(q => q.id === row.quoteId);
                if (sale) setSelectedQuote(sale);
              },
            }
          ]}
        />
      ),
    }
  ], [router]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cola de Producción (Aluzinc)</h1>
          <p className="text-slate-500 mt-1">Órdenes pendientes de conformación</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            {totalFiltered} cotizaciones en cola
          </span>
        </div>
      </div>

      {quotes && quotes.length === 100 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg flex items-center gap-3">
          <span className="font-semibold">Mostrando las primeras 100.</span>
          <span>Hay más cotizaciones en cola.</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <TableFilters
          search={{
            value: searchValue,
            onChange: setSearchValue,
            placeholder: "Buscar por cliente o cotización..."
          }}
          filterGroups={[
            {
              id: "status-filter",
              label: "Estado",
              multiple: true,
              options: [
                { value: "hide_completed", label: "Ocultar cumplidas" }
              ],
              value: hideCompleted ? ["hide_completed"] : [],
              onChange: (v) => {
                const arr = v as string[];
                setHideCompleted(arr.includes("hide_completed"));
                setFilterValue("status-filter", arr);
              }
            }
          ]}
        />

        <div className="p-4">
          <DataTable
            columns={columns}
            data={pageItems}
            getRowKey={(row) => row.quoteId}
            isLoading={loadingQuotes || loadingLogs}
            currentPage={currentPage}
            pageSize={pageSize}
            emptyState={{
              icon: "box",
              title: "No hay órdenes en cola",
              description: "No se encontraron cotizaciones confirmadas para producción."
            }}
          />
          <TablePagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={totalFiltered}
            onPageChange={setCurrentPage}
            pageSizeOptions={[15, 30, 50, 100]}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {selectedQuote && (
        <SaleDetailsModal 
          sale={selectedQuote}
          onClose={() => setSelectedQuote(null)}
        />
      )}
    </div>
  );
}
