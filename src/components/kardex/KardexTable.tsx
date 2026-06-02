import React from "react";
import { KardexMovement } from "@/services/kardexService";
import {
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  AlertCircle,
} from "lucide-react";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";

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
      render: (mov) => (
        mov.type === "IN" ? (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-emerald-200">
            <ArrowDownRight size={12} /> Entrada
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-red-200">
            <ArrowUpRight size={12} /> Salida
          </span>
        )
      ),
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
      render: (mov) => (
        <span
          className={`font-mono text-base font-black ${mov.type === "IN" ? "text-emerald-600" : "text-red-600"}`}
        >
          {mov.type === "IN" ? "+" : "-"}
          {mov.quantity}
        </span>
      ),
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
