"use client";

import React from "react";
import { ProductionLog } from "@/types";
import { Activity, AlertCircle, Trash2 } from "lucide-react";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";

interface ProductionTableProps {
  logs: ProductionLog[];
  isLoading: boolean;
  role: string | null | undefined;
  currentPage: number;
  pageSize: number;
  onVoidLog: (logId: string, pieces: number) => void;
}

export function ProductionTable({
  logs,
  isLoading,
  role,
  currentPage,
  pageSize,
  onVoidLog,
}: ProductionTableProps) {
  const columns: ColumnDef<ProductionLog>[] = [
    {
      key: "timestamp",
      header: "Fecha",
      render: (log) => (
        <span className="text-sm font-medium text-slate-600">
          {log.timestamp?.toDate
            ? log.timestamp
                .toDate()
                .toLocaleString("es-PE", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
            : "Reciente"}
        </span>
      ),
    },
    {
      key: "origin",
      header: "Bobina Origen",
      render: (log) => {
        const isVoided = log.status === "VOIDED";
        return (
          <div className="flex items-center">
            <span
              className={`font-black px-2.5 py-1 rounded-md text-xs border tracking-wider ${
                isVoided
                  ? "text-red-400 border-red-200 line-through bg-red-50"
                  : "text-blue-900 bg-blue-50 border-blue-200"
              }`}
            >
              {log.parentCoilId || `Fleje ${log.totalUsedWidth}mm`}
            </span>
            {isVoided && (
              <span className="ml-2 text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-100 px-2 py-0.5 rounded-full">
                Anulado
              </span>
            )}
          </div>
        );
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
        return (
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-emerald-500" />
            <span className="text-emerald-600 font-black">
              +{log.piecesProduced} pzas
            </span>
          </div>
        );
      },
    },
    {
      key: "stripCost",
      header: "Costo Fleje",
      align: "right",
      render: (log) => (
        <span
          className={`font-mono text-sm font-bold ${
            log.status === "VOIDED" ? "text-slate-400 line-through" : "text-slate-600"
          }`}
        >
          S/{" "}
          {log.stripCost?.toLocaleString("es-PE", {
            minimumFractionDigits: 2,
          }) || "0.00"}
        </span>
      ),
    },
    {
      key: "costPerPiece",
      header: "Costo x Pieza",
      align: "right",
      render: (log) => (
        <span
          className={`font-mono font-black px-2.5 py-1 rounded border tracking-wide ${
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
                  onClick: () => onVoidLog(log.id!, log.piecesProduced),
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
    <DataTable
      columns={columns}
      data={logs}
      getRowKey={(l) => l.id!}
      isLoading={isLoading}
      currentPage={currentPage}
      pageSize={pageSize}
      showRowNumber={true}
      minWidth="min-w-[900px]"
      getRowClassName={(l) =>
        `group transition-colors ${l.status === "VOIDED" ? "bg-red-50/10 hover:bg-red-50/20" : "hover:bg-blue-50/20"}`
      }
      emptyState={{
        icon: "Activity",
        title: "No hay resultados",
        description: "No se encontraron registros con los filtros actuales.",
      }}
    />
  );
}
