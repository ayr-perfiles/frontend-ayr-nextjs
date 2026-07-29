"use client";

import React, { useState } from "react";
import { ProductionLog } from "@/types";
import { Activity, AlertCircle, Trash2, History, Layers } from "lucide-react";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { TableFilters } from "@/components/ui/TableFilters";
import { TablePagination } from "@/components/ui/TablePagination";
import { useTableData } from "@/hooks/useTableData";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import toast from "react-hot-toast";
import { voidProductionFromCoils } from "@/modules/metallic-roofing/services/productionService";
import { useMetallicProductionLogs } from "@/modules/metallic-roofing/hooks/useMetallicProductionLogs";
import { getProductionUnitAndValue } from "@/core/production/unitLogic";
import { formatQuoteDisplayId } from "@/core/production/queueLogic";

interface MetallicProductionHistoryProps {
  skuToFamily: Record<string, string>;
  onOpenQuote?: (quoteId: string) => void;
}

export function MetallicProductionHistory({ skuToFamily, onOpenQuote }: MetallicProductionHistoryProps) {
  const { role } = useAuth();
  const confirm = useConfirm();
  const { logs, loading, refresh } = useMetallicProductionLogs();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const {
    pageItems,
    currentPage,
    setCurrentPage,
    pageSize,
    searchValue,
    setSearchValue,
    filterValues,
    setFilterValue,
    totalFiltered,
  } = useTableData<ProductionLog>({
    data: logs,
    pageSize: 15,
    searchFields: ["sku", "parentCoilId"],
    filters: {
      dateRange: (row, _) => {
        if (!startDate || !endDate) return true;
        if (!row.timestamp?.toDate) return true;
        const rowDate = row.timestamp.toDate();
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return rowDate >= start && rowDate <= end;
      },
    },
  });

  // Keep `useTableData` dateRange filter synced with state
  React.useEffect(() => {
    setFilterValue("dateRange", startDate && endDate ? "CUSTOM" : "");
  }, [startDate, endDate]);

  const handleVoidLog = async (logId: string) => {
    if (
      await confirm({
        title: "Anular producción",
        message:
          "Se devolverá el peso a las bobinas y se retirará el stock de producto terminado. No se puede deshacer.",
        variant: "danger",
      })
    ) {
      try {
        await voidProductionFromCoils(logId);
        toast.success("Producción anulada exitosamente.");
        refresh();
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Error al anular la producción.");
      }
    }
  };

  const columns: ColumnDef<ProductionLog>[] = [
    {
      key: "timestamp",
      header: "Fecha",
      render: (log) => (
        <span className="text-sm font-medium text-slate-600 whitespace-nowrap">
          {log.timestamp?.toDate
            ? log.timestamp.toDate().toLocaleString("es-PE", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Reciente"}
        </span>
      ),
    },
    {
      key: "origin",
      header: "Bobinas Origen",
      render: (log) => {
        if (!log.perCoilBreakdown) {
          console.error(`Production log ${log.id || 'unknown'} (metallic-roofing) sin perCoilBreakdown`);
          return (
            <div className="flex items-center gap-1 text-red-500 text-[10px] font-bold uppercase tracking-widest bg-red-50 px-2 py-1 rounded">
              <AlertCircle size={12} /> ⚠ Dato Faltante
            </div>
          );
        }

        const isVoided = log.status === "VOIDED";
        const totalCoils = log.perCoilBreakdown.length;
        const isMulti = totalCoils > 1;

        return (
          <div className="flex flex-col gap-1 items-start">
            <div className="flex items-center gap-2">
              <span
                className={`font-black px-2.5 py-1 rounded-md text-xs border tracking-wider ${
                  isVoided
                    ? "text-red-400 border-red-200 line-through bg-red-50"
                    : "text-blue-900 bg-blue-50 border-blue-200"
                }`}
              >
                {isMulti ? `${totalCoils} Bobinas` : (log.parentCoilId || "Desconocido")}
              </span>
              {isVoided && (
                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-100 px-2 py-0.5 rounded-full">
                  Anulado
                </span>
              )}
            </div>
            {isMulti && (
              <div className="text-[10px] text-slate-400 font-bold leading-tight">
                {log.perCoilBreakdown?.map((b) => b.coilId).join(", ")}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "quote",
      header: "Cotización",
      render: (log) => {
        if (log.source && log.source.type === "QUOTE" && log.source.id) {
          if (onOpenQuote) {
            return (
              <button
                onClick={() => onOpenQuote(log.source!.id)}
                className="font-black px-2.5 py-1 rounded-md text-xs border tracking-wider bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors whitespace-nowrap"
              >
                {formatQuoteDisplayId(log.source.id)}
              </button>
            );
          }
          return (
            <span className="font-bold text-slate-600 whitespace-nowrap">
              {formatQuoteDisplayId(log.source.id)}
            </span>
          );
        }
        return <span className="text-slate-400">—</span>;
      },
    },
    {
      key: "product",
      header: "Producto",
      render: (log) => (
        <span
          className={`font-black ${
            log.status === "VOIDED" ? "text-slate-400 line-through" : "text-slate-800"
          }`}
        >
          {log.sku}
        </span>
      ),
    },
    {
      key: "production",
      header: "Producción",
      render: (log) => {
        if (log.status === "VOIDED") {
          return (
            <div className="flex items-center gap-1 text-red-400 text-xs font-bold uppercase tracking-widest">
              <AlertCircle size={14} /> Sin Efecto
            </div>
          );
        }
        
        const { value, unitLabel } = getProductionUnitAndValue(log, skuToFamily);

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-emerald-500" />
              <span className="text-emerald-600 font-black whitespace-nowrap">
                {value === null ? "—" : `+${value} ${unitLabel}`}
              </span>
            </div>
            {log.reportedWeight ? (
              <span className="text-slate-400 text-[10px] font-bold whitespace-nowrap">
                ({log.reportedWeight.toLocaleString()} kg)
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "stripCost",
      header: "Costo Corrida",
      align: "right",
      render: (log) => {
        if (!log.perCoilBreakdown) {
          return <span className="text-red-500 font-bold text-xs uppercase bg-red-50 px-2 py-1 rounded">⚠ Error</span>;
        }

        const totalCost = log.perCoilBreakdown.reduce((sum, b) => sum + (b.costPEN || 0), 0);

        return (
          <span
            className={`font-mono text-sm font-bold whitespace-nowrap ${
              log.status === "VOIDED" ? "text-slate-400 line-through" : "text-slate-600"
            }`}
          >
            S/{" "}
            {totalCost.toLocaleString("es-PE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        );
      },
    },
    {
      key: "costPerPiece",
      header: "Costo x Unidad",
      align: "right",
      render: (log) => (
        <span
          className={`font-mono font-black px-2.5 py-1 rounded border tracking-wide whitespace-nowrap ${
            log.status === "VOIDED"
              ? "text-slate-400 bg-slate-50 border-slate-200 line-through"
              : "text-emerald-700 bg-emerald-50 border-emerald-200"
          }`}
        >
          S/ {log.costPerPiece?.toFixed(4) || "0.0000"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "center",
      render: (log) => {
        if (role === "ADMIN" && log.status !== "VOIDED" && log.id) {
          return (
            <RowActionsMenu
              items={[
                {
                  id: "void",
                  label: "Anular Producción",
                  icon: <Trash2 size={16} />,
                  variant: "danger",
                  section: "danger",
                  onClick: () => handleVoidLog(log.id!),
                },
              ]}
            />
          );
        }
        return null;
      },
    },
  ];

  return (
    <section>
      <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 mt-8">
        <History size={16} /> Historial Operativo (Conformadora A2)
      </h2>

      <div className="mb-4">
        <TableFilters
          search={{
            value: searchValue,
            onChange: setSearchValue,
            placeholder: "Buscar por SKU o Bobina...",
          }}
          dateRange={{
            startDate,
            endDate,
            setStartDate,
            setEndDate,
          }}
          onClearAll={() => {
            setSearchValue("");
            setStartDate("");
            setEndDate("");
            setFilterValue("dateRange", "");
          }}
        />
      </div>

      <DataTable
        columns={columns}
        data={pageItems}
        getRowKey={(l) => l.id!}
        isLoading={loading}
        currentPage={currentPage}
        pageSize={pageSize}
        showRowNumber={true}
        minWidth="min-w-[900px]"
        getRowClassName={(l) =>
          `group transition-colors ${
            l.status === "VOIDED" ? "bg-red-50/10 hover:bg-red-50/20" : "hover:bg-blue-50/20"
          }`
        }
        emptyState={{
          icon: "Activity",
          title: "No hay resultados",
          description: "No se encontraron registros con los filtros actuales.",
        }}
      />

      <TablePagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={totalFiltered}
        onPageChange={setCurrentPage}
      />
    </section>
  );
}
