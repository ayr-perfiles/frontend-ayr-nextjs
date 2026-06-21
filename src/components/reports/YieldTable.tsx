import React from "react";
import { ExtendedLog } from "@/services/reportsService";
import { AlertCircle } from "lucide-react";

interface YieldTableProps {
  logs: ExtendedLog[];
  currentPage: number;
  pageSize: number;
}

export function YieldTable({ logs, currentPage, pageSize }: YieldTableProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
      <table className="w-full text-left min-w-[850px]">
        <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100">
          <tr>
            <th className="p-4 text-center w-12 border-b border-slate-50">#</th>
            <th className="p-4 pl-2 border-b border-slate-50">Bobina Madre</th>
            <th className="p-4 border-b border-slate-50">Producto</th>
            <th className="p-4 border-b border-slate-50">Usado (mm)</th>
            <th className="p-4 border-b border-slate-50">Merma (mm)</th>
            <th className="p-4 border-b border-slate-50 text-orange-600">
              Merma Est. (kg)
            </th>
            <th className="p-4 pr-6 text-center border-b border-slate-50 w-48">
              Rendimiento
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {logs.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="p-8 text-center text-slate-400 font-medium"
              >
                No hay registros para este periodo.
              </td>
            </tr>
          ) : (
            logs.map((log, idx) => {
              const isVoided = log.status === "VOIDED";
              const u = log.totalUsedWidth || 0;
              const s = log.scrapWidth || 0;
              const kg = log.scrapWeightKg || 0;
              const yieldPct = u + s > 0 ? (u / (u + s)) * 100 : 0;
              const rowNumber = (currentPage - 1) * pageSize + idx + 1;

              return (
                <tr
                  key={log.id}
                  className={`transition group ${isVoided ? "bg-red-50/20 hover:bg-red-50/40" : "hover:bg-blue-50/30"}`}
                >
                  <td className="p-4 text-center">
                    <span className="text-xs font-bold text-slate-400">
                      {rowNumber}
                    </span>
                  </td>
                  <td className="p-4 pl-2">
                    <span
                      className={`text-sm font-black ${isVoided ? "text-red-400 line-through" : "text-blue-900"}`}
                    >
                      {log.parentCoilId}
                    </span>
                    {isVoided && (
                      <span className="ml-2 text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded uppercase tracking-widest">
                        Anulado
                      </span>
                    )}
                  </td>
                  <td
                    className={`p-4 font-black text-sm ${isVoided ? "text-slate-400 line-through" : "text-slate-800"}`}
                  >
                    {log.sku}
                  </td>
                  <td
                    className={`p-4 text-xs font-bold ${isVoided ? "text-slate-400" : "text-slate-600"}`}
                  >
                    {u > 0 ? `${u} ` : "---"}
                  </td>
                  <td
                    className={`p-4 text-xs font-black ${isVoided ? "text-slate-400" : s > 50 ? "text-orange-500" : "text-slate-400"}`}
                  >
                    {s > 0 ? `${s} ` : "---"}
                  </td>
                  <td
                    className={`p-4 text-xs font-black ${isVoided ? "text-slate-400 line-through" : "text-orange-600"}`}
                  >
                    {kg > 0 ? `${kg.toFixed(2)} kg` : "---"}
                  </td>
                  <td className="p-4 pr-6">
                    {isVoided ? (
                      <div className="flex items-center justify-center gap-1 text-red-400 text-xs font-bold uppercase">
                        <AlertCircle size={14} /> Sin efecto
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${yieldPct > 95 ? "bg-emerald-500" : "bg-orange-400"}`}
                            style={{ width: `${yieldPct}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-black w-10 text-right text-slate-700">
                          {yieldPct > 0 ? yieldPct.toFixed(1) : "0.0"}%
                        </span>
                      </div>
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
