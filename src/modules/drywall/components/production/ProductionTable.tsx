import React from "react";
import { ProductionLog } from "@/types";
import { Activity, AlertCircle, Trash2 } from "lucide-react";

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
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto min-h-[250px]">
      <table className="w-full text-left min-w-[900px] border-collapse">
        <thead className="bg-slate-50/80 border-b border-slate-100">
          <tr>
            <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center w-12">
              #
            </th>
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
              Fecha
            </th>
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
              Bobina Origen
            </th>
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
              Producto
            </th>
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
              Producción
            </th>
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
              Costo Fleje
            </th>
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
              Costo x Pieza
            </th>
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {logs.length === 0 && !isLoading ? (
            <tr>
              <td colSpan={8} className="p-12 text-center text-slate-400">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4 text-slate-400">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-slate-900 font-bold text-lg">
                  No hay resultados
                </h3>
                <p className="font-medium text-slate-500 mt-1">
                  No se encontraron registros con los filtros actuales.
                </p>
              </td>
            </tr>
          ) : (
            logs.map((log, index) => {
              const isVoided = log.status === "VOIDED";
              const rowNumber = (currentPage - 1) * pageSize + index + 1;

              return (
                <tr
                  key={log.id}
                  className={`group transition-colors ${isVoided ? "bg-red-50/10" : "hover:bg-blue-50/20"}`}
                >
                  <td className="p-4 text-center">
                    <span className="text-xs font-bold text-slate-400">
                      {rowNumber}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-medium text-slate-600">
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
                  </td>
                  <td className="p-4">
                    <span
                      className={`font-black px-2.5 py-1 rounded-md text-xs border tracking-wider ${isVoided ? "text-red-400 border-red-200 line-through bg-red-50" : "text-blue-900 bg-blue-50 border-blue-200"}`}
                    >
                      {log.parentCoilId}
                    </span>
                    {isVoided && (
                      <span className="ml-2 text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-100 px-2 py-0.5 rounded-full">
                        Anulado
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <span
                      className={`font-black ${isVoided ? "text-slate-400 line-through" : "text-slate-800"}`}
                    >
                      {log.sku}
                    </span>
                  </td>
                  <td className="p-4">
                    {isVoided ? (
                      <div className="flex items-center gap-1 text-red-400 text-xs font-bold uppercase tracking-widest">
                        <AlertCircle size={14} /> Sin Efecto
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Activity size={16} className="text-emerald-500" />
                        <span className="text-emerald-600 font-black">
                          +{log.piecesProduced} pzas
                        </span>
                      </div>
                    )}
                  </td>
                  <td
                    className={`p-4 text-right font-mono text-sm font-bold ${isVoided ? "text-slate-400 line-through" : "text-slate-600"}`}
                  >
                    S/{" "}
                    {log.stripCost?.toLocaleString("es-PE", {
                      minimumFractionDigits: 2,
                    }) || "0.00"}
                  </td>
                  <td className="p-4 text-right">
                    <span
                      className={`font-mono font-black px-2.5 py-1 rounded border tracking-wide ${isVoided ? "text-slate-400 bg-slate-50 border-slate-200 line-through" : "text-emerald-700 bg-emerald-50 border-emerald-200"}`}
                    >
                      S/ {log.costPerPiece?.toFixed(4) || "0.0000"}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {role === "ADMIN" && !isVoided && log.id && (
                      <button
                        onClick={() => onVoidLog(log.id!, log.piecesProduced)}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                        title="Anular Producción"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
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
