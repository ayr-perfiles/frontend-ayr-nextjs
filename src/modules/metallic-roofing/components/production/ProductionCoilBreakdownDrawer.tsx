import React from "react";
import { X, AlertTriangle } from "lucide-react";
import { buildCoilBreakdownRows } from "@/core/production/coilBreakdownRows";
import { formatQuoteDisplayId } from "@/core/production/queueLogic";

interface ProductionCoilBreakdownDrawerProps {
  log: any; // We receive the raw log from MetallicProductionHistory
  productName: string;
  onClose: () => void;
}

export function ProductionCoilBreakdownDrawer({
  log,
  productName,
  onClose,
}: ProductionCoilBreakdownDrawerProps) {
  const isVoided = log.status === "VOIDED";
  const { rows, totals } = buildCoilBreakdownRows(log.perCoilBreakdown);

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Desglose de Bobinas</h2>
            <p className="text-sm text-slate-500">
              {log.sku} - {productName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {isVoided && (
          <div className="bg-red-50 text-red-700 px-4 py-3 border-b border-red-200 flex items-center gap-2 text-sm">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="font-semibold uppercase tracking-wider">
              Registro Anulado / Sin Efecto
            </span>
          </div>
        )}

        <div className="p-4 grid grid-cols-2 gap-4 border-b bg-slate-50/50">
          <div>
            <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Fecha de Producción
            </span>
            <span className="text-sm font-medium text-slate-800">
              {log.timestamp?.toDate
                ? log.timestamp.toDate().toLocaleString("es-PE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Cotización
            </span>
            <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 inline-block">
              {log.source?.type === "QUOTE" ? formatQuoteDisplayId(log.source.id) : "—"}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-50">
                <th className="py-2.5 px-3 font-semibold text-slate-600">Bobina</th>
                <th className="py-2.5 px-3 font-semibold text-slate-600 text-right">Piezas</th>
                <th className="py-2.5 px-3 font-semibold text-slate-600 text-right">Longitud</th>
                <th className="py-2.5 px-3 font-semibold text-slate-600 text-right">ML</th>
                <th className="py-2.5 px-3 font-semibold text-slate-600 text-right">Kg</th>
                <th className="py-2.5 px-3 font-semibold text-slate-600 text-right">Costo (S/)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                    {row.coilId}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-600">
                    {row.piezas !== null ? row.piezas : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-600">
                    {row.longitudM !== null ? `${row.longitudM.toFixed(2)} m` : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                    {row.ml > 0 ? row.ml.toFixed(2) : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                    {row.kg > 0 ? row.kg.toFixed(2) : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-emerald-700">
                    {row.costo > 0 ? row.costo.toFixed(2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td className="py-3 px-3 font-bold text-slate-800 uppercase text-xs tracking-wider">
                  TOTALES
                </td>
                <td className="py-3 px-3 text-right font-bold text-slate-800">
                  {totals.piezas !== null ? totals.piezas : "—"}
                </td>
                <td className="py-3 px-3 text-right font-bold text-slate-800">—</td>
                <td className="py-3 px-3 text-right font-bold text-slate-800">
                  {totals.ml > 0 ? totals.ml.toFixed(2) : "—"}
                </td>
                <td className="py-3 px-3 text-right font-bold text-slate-800">
                  {totals.kg > 0 ? totals.kg.toFixed(2) : "—"}
                </td>
                <td className="py-3 px-3 text-right font-black text-emerald-700">
                  {totals.costo > 0 ? totals.costo.toFixed(2) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
