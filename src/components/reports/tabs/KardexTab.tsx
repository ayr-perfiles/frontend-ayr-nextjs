"use client";

import React from "react";
import { FileSpreadsheet, Download } from "lucide-react";
import { FinancialFilters } from "@/components/reports/FinancialFilters";
import { PaginationControls } from "@/components/reports/PaginationControls";

interface KardexItem {
  id: string;
  date: { toLocaleString: (locale: string) => string };
  sku: string;
  type: "IN" | "OUT";
  quantity: number;
  balance: number;
  reference: string;
  description: string;
}

interface KardexTabProps {
  allData: KardexItem[];
  currentData: KardexItem[];
  page: number;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: React.Dispatch<React.SetStateAction<number>>;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  isLoading: boolean;
  isDebouncing: boolean;
  onExport: () => void;
}

export function KardexTab({
  allData,
  currentData,
  page,
  totalPages,
  setPage,
  pageSize,
  setPageSize,
  searchTerm,
  setSearchTerm,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  isLoading,
  isDebouncing,
  onExport,
}: KardexTabProps) {
  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      <FinancialFilters
        placeholder="Filtrar por SKU específico..."
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        isLoading={isLoading}
        isDebouncing={isDebouncing}
      />
      <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="bg-indigo-100 p-3 rounded-2xl shrink-0">
            <FileSpreadsheet className="text-indigo-600" size={32} />
          </div>
          <div>
            <h3 className="text-indigo-900 font-black text-lg">
              Registro de Inventario Permanente Físico (Kardex SUNAT)
            </h3>
            <p className="text-indigo-700 text-sm font-medium mt-1">
              Este reporte extrae los movimientos históricos estrictamente
              ordenados por fecha y los formatea listos para ser trabajados por
              el área contable.
            </p>
          </div>
        </div>
        <button
          onClick={onExport}
          disabled={allData.length === 0}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 transition disabled:opacity-50 shadow-lg active:scale-95 shrink-0 whitespace-nowrap"
        >
          <Download size={18} /> Exportar Excel
        </button>
      </div>
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-indigo-50/50 border-b border-indigo-100">
              <tr>
                <th className="p-4 pl-6 text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                  Fecha y Hora
                </th>
                <th className="p-4 text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                  Producto (SKU)
                </th>
                <th className="p-4 text-[10px] font-black text-indigo-700 uppercase tracking-widest text-center">
                  Movimiento
                </th>
                <th className="p-4 text-[10px] font-black text-indigo-700 uppercase tracking-widest text-center">
                  Cant.
                </th>
                <th className="p-4 text-[10px] font-black text-indigo-700 uppercase tracking-widest text-center">
                  Saldo
                </th>
                <th className="p-4 text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                  Doc. Referencia
                </th>
                <th className="p-4 pr-6 text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                  Descripción / Razón
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentData.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-slate-400 font-bold"
                  >
                    No se encontraron movimientos en este rango de fechas.
                  </td>
                </tr>
              ) : (
                currentData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 text-sm">
                    <td className="p-4 pl-6 font-medium text-slate-600">
                      {item.date.toLocaleString("es-PE")}
                    </td>
                    <td className="p-4 font-black text-slate-800">{item.sku}</td>
                    <td className="p-4 text-center">
                      <span
                        className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                          item.type === "IN"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {item.type === "IN" ? "ENTRADA" : "SALIDA"}
                      </span>
                    </td>
                    <td
                      className={`p-4 text-center font-black ${
                        item.type === "IN" ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {item.type === "IN" ? "+" : "-"}
                      {item.quantity}
                    </td>
                    <td className="p-4 text-center font-black text-indigo-600 bg-indigo-50/30">
                      {item.balance}
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-500 text-xs">
                      {item.reference}
                    </td>
                    <td
                      className="p-4 pr-6 font-medium text-slate-600 truncate max-w-[200px]"
                      title={item.description}
                    >
                      {item.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {allData.length > 0 && (
          <PaginationControls
            page={page}
            totalPages={totalPages}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
          />
        )}
      </div>
    </div>
  );
}
