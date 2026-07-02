import React from "react";
import { KardexMovement } from "@/services/kardexService";
import {
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";
import { getKardexMovementDisplay } from "@/core/kardex/kardexMovementDisplay";

interface KardexTableProps {
  movements: KardexMovement[];
  currentPage: number;
  pageSize: number;
  isLoading?: boolean;
}

export function KardexTable({
  movements,
  currentPage,
  pageSize,
  isLoading = false,
}: KardexTableProps) {
  const columns: ColumnDef<KardexMovement>[] = [
    {
      key: "date",
      header: "Fecha y Hora",
      render: (mov) => (
        <div>
          <p className="text-sm font-bold text-slate-800">
            {mov.date.toLocaleDateString("es-PE", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
          <p className="text-[10px] font-bold text-slate-400">
            {mov.date.toLocaleTimeString("es-PE", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      render: (mov) => {
        const display = getKardexMovementDisplay(mov.type);
        let Icon = AlertCircle;
        if (mov.type === "IN" || mov.type === "ENTRADA" || mov.type === "SCRAP_REVERSAL") {
          Icon = ArrowDownRight;
        } else if (mov.type === "OUT" || mov.type === "SALIDA") {
          Icon = ArrowUpRight;
        } else if (mov.type === "SCRAP") {
          Icon = AlertTriangle;
        }

        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${display.className}`}>
            <Icon size={12} /> {display.label}
          </span>
        );
      },
    },
    {
      key: "reference",
      header: "Documento / Detalle",
      render: (mov) => (
        <div>
          <p className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1 mb-0.5">
            <FileText size={12} className="text-blue-500" />{" "}
            {mov.reference}
          </p>
          <p className="text-xs font-bold text-slate-500">
            {mov.description}
          </p>
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Cantidad",
      align: "right",
      render: (mov) => {
        const display = getKardexMovementDisplay(mov.type);
        const colorClass = display.sign === "+" 
          ? "text-emerald-600" 
          : display.sign === "-" 
            ? (mov.type === "SCRAP" ? "text-amber-600" : "text-red-600")
            : "text-gray-600";
            
        return (
          <span className={`font-mono text-base font-black ${colorClass}`}>
            {display.sign}{mov.quantity}
          </span>
        );
      },
    },
    {
      key: "balance",
      header: "Saldo Físico",
      align: "right",
      render: (mov) => (
        <span className="font-mono text-base font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
          {mov.balance}
        </span>
      ),
    },
    {
      key: "user",
      header: "Usuario",
      align: "right",
      headerClassName: "pr-6",
      cellClassName: "pr-6",
      render: (mov) => (
        <p className="text-xs font-bold text-slate-500 truncate max-w-[100px] inline-block">
          {mov.user}
        </p>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={movements}
      getRowKey={(mov: KardexMovement, idx: number) => mov.id + idx}
      isLoading={isLoading}
      currentPage={currentPage}
      pageSize={pageSize}
      showRowNumber={true}
      minWidth="min-w-[800px]"
      emptyState={{
        icon: "AlertCircle",
        title: "Sin movimientos",
        description: "No hay registros para este rango o producto.",
      }}
    />
  );
}
