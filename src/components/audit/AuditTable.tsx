import React from "react";
import { AuditLog } from "@/services/auditService";
import {
  Clock,
  User,
  Trash2,
  Edit2,
  Info,
  FileText,
  AlertCircle,
} from "lucide-react";

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

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto min-h-[250px]">
      <table className="w-full text-left min-w-[850px] border-collapse">
        <thead className="bg-slate-50/50 border-b border-slate-100">
          <tr>
            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center w-12">
              #
            </th>
            <th className="p-4 pl-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Clock size={12} /> Fecha y Hora
            </th>
            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Usuario
            </th>
            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Acción
            </th>
            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Entidad Afectada
            </th>
            <th className="p-4 pr-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Detalles Técnicos
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {logs.length === 0 && !isLoading ? (
            <tr>
              <td colSpan={6} className="p-16 text-center text-slate-400">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4 text-slate-400">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-xl font-black text-slate-500">
                  No hay registros
                </h3>
                <p className="font-medium mt-2">
                  Aún no se han realizado acciones críticas o no coinciden con
                  tu búsqueda.
                </p>
              </td>
            </tr>
          ) : (
            logs.map((log, idx) => {
              const rowNumber = (currentPage - 1) * pageSize + idx + 1;
              return (
                <tr key={log.id} className="hover:bg-purple-50/30 transition">
                  <td className="p-4 text-center">
                    <span className="text-xs font-bold text-slate-400">
                      {rowNumber}
                    </span>
                  </td>
                  <td className="p-4 pl-2">
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
                  </td>
                  <td className="p-4">
                    <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <User size={14} className="text-slate-400" />{" "}
                      {log.userEmail.split("@")[0]}
                    </p>
                  </td>
                  <td className="p-4">{getActionBadge(log.action)}</td>
                  <td className="p-4">
                    <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded flex items-center gap-1 w-max">
                      <FileText size={12} /> {log.entityId}
                    </span>
                  </td>
                  <td className="p-4 pr-6">
                    <p className="text-xs font-medium text-slate-600 max-w-sm leading-relaxed">
                      {log.details}
                    </p>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
