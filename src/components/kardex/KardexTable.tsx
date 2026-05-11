import React from "react";
import { KardexMovement } from "@/services/kardexService";
import {
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  User,
  AlertCircle,
} from "lucide-react";

interface KardexTableProps {
  movements: KardexMovement[];
  currentPage: number;
  pageSize: number;
}

export function KardexTable({
  movements,
  currentPage,
  pageSize,
}: KardexTableProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto min-h-[250px]">
      <table className="w-full text-left min-w-[800px] border-collapse">
        <thead className="bg-slate-50/80 border-b border-slate-100">
          <tr>
            <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center w-12">
              #
            </th>
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
              Fecha y Hora
            </th>
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
              Tipo
            </th>
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
              Documento / Detalle
            </th>
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
              Cantidad
            </th>
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
              Saldo Físico
            </th>
            <th className="p-4 pr-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
              Usuario
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {movements.length === 0 ? (
            <tr>
              <td colSpan={7} className="p-12 text-center text-slate-400">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4 text-slate-400">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-slate-900 font-bold text-lg">
                  Sin movimientos
                </h3>
                <p className="font-medium text-slate-500 mt-1">
                  No hay registros para este rango o producto.
                </p>
              </td>
            </tr>
          ) : (
            movements.map((mov, idx) => {
              const rowNumber = (currentPage - 1) * pageSize + idx + 1;
              return (
                <tr
                  key={mov.id + idx}
                  className="hover:bg-blue-50/20 transition"
                >
                  <td className="p-4 text-center">
                    <span className="text-xs font-bold text-slate-400">
                      {rowNumber}
                    </span>
                  </td>
                  <td className="p-4">
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
                  </td>
                  <td className="p-4">
                    {mov.type === "IN" ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-emerald-200">
                        <ArrowDownRight size={12} /> Entrada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-red-200">
                        <ArrowUpRight size={12} /> Salida
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <p className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                      <FileText size={12} className="text-blue-500" />{" "}
                      {mov.reference}
                    </p>
                    <p className="text-xs font-bold text-slate-500">
                      {mov.description}
                    </p>
                  </td>
                  <td className="p-4 text-right">
                    <span
                      className={`font-mono text-base font-black ${mov.type === "IN" ? "text-emerald-600" : "text-red-600"}`}
                    >
                      {mov.type === "IN" ? "+" : "-"}
                      {mov.quantity}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="font-mono text-base font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                      {mov.balance}
                    </span>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <p className="text-xs font-bold text-slate-500 truncate max-w-[100px] inline-block">
                      {mov.user}
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
