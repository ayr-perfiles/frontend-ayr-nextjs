import React from "react";
import { AuditLog } from "@/services/auditService";
import {
  Trash2,
  Edit2,
  Info,
  FileText,
  User,
  Clock,
} from "lucide-react";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";

interface AuditTableProps {
  logs: AuditLog[];
  isLoading: boolean;
  currentPage: number;
  pageSize: number;
}

export function AuditTable({
  logs,
  isLoading,
  currentPage,
  pageSize,
}: AuditTableProps) {
  const getActionBadge = (action: string) => {
    switch (action) {
      case "VOID_COIL":
      case "VOID_PRODUCTION":
        return (
          <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-red-200">
            <Trash2 size={12} /> Anulación
          </span>
        );
      case "EDIT_COIL":
        return (
          <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-200">
            <Edit2 size={12} /> Edición
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200">
            <Info size={12} /> {action}
          </span>
        );
    }
  };

  const columns: ColumnDef<AuditLog>[] = [
    {
      key: "timestamp",
      header: (
        <span className="flex items-center gap-1">
          <Clock size={12} /> Fecha y Hora
        </span>
      ),
      render: (log) => (
        <div>
          <p className="text-sm font-bold text-slate-800">
            {log.timestamp?.toDate
              ? log.timestamp
                  .toDate()
                  .toLocaleDateString("es-PE", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
              : "---"}
          </p>
          <p className="text-[10px] font-bold text-slate-400">
            {log.timestamp?.toDate
              ? log.timestamp
                  .toDate()
                  .toLocaleTimeString("es-PE", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
              : "---"}
          </p>
        </div>
      ),
    },
    {
      key: "user",
      header: "Usuario",
      render: (log) => (
        <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <User size={14} className="text-slate-400" />{" "}
          {log.userEmail.split("@")[0]}
        </p>
      ),
    },
    {
      key: "action",
      header: "Acción",
      render: (log) => getActionBadge(log.action),
    },
    {
      key: "entity",
      header: "Entidad Afectada",
      render: (log) => (
        <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded flex items-center gap-1 w-max">
          <FileText size={12} /> {log.entityId}
        </span>
      ),
    },
    {
      key: "details",
      header: "Detalles Técnicos",
      cellClassName: "pr-6",
      render: (log) => (
        <p className="text-xs font-medium text-slate-600 max-w-sm leading-relaxed">
          {log.details}
        </p>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={logs}
      getRowKey={(l) => l.id}
      isLoading={isLoading}
      currentPage={currentPage}
      pageSize={pageSize}
      showRowNumber={true}
      minWidth="min-w-[850px]"
      getRowClassName={() => "hover:bg-purple-50/30 transition-colors"}
      emptyState={{
        icon: "AlertCircle",
        title: "No hay registros",
        description:
          "Aún no se han realizado acciones críticas o no coinciden con tu búsqueda.",
      }}
    />
  );
}
