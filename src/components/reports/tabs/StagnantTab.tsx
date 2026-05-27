"use client";

import React from "react";
import { AlertOctagon } from "lucide-react";
import { StagnantFilters } from "@/components/reports/StagnantFilters";
import { PaginationControls } from "@/components/reports/PaginationControls";

interface StagnantItem {
  sku: string;
  name: string;
  daysStagnant: number;
  quantity: number;
  totalValue: number;
}

interface StagnantTabProps {
  data: { items: StagnantItem[]; totalCapital: number };
  currentData: StagnantItem[];
  stagnantDays: number;
  setStagnantDays: (v: number) => void;
  page: number;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: React.Dispatch<React.SetStateAction<number>>;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  isLoading: boolean;
  isDebouncing: boolean;
}

export function StagnantTab({
  data,
  currentData,
  stagnantDays,
  setStagnantDays,
  page,
  totalPages,
  setPage,
  pageSize,
  setPageSize,
  searchTerm,
  setSearchTerm,
  isLoading,
  isDebouncing,
}: StagnantTabProps) {
  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      <StagnantFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        stagnantDays={stagnantDays}
        setStagnantDays={setStagnantDays}
        isLoading={isLoading}
        isDebouncing={isDebouncing}
      />
      <div className="bg-red-50 border border-red-200 p-6 rounded-3xl shadow-sm flex items-start gap-4">
        <div className="bg-red-100 p-3 rounded-2xl shrink-0">
          <AlertOctagon className="text-red-600" size={32} />
        </div>
        <div>
          <h3 className="text-red-900 font-black text-lg">
            Alerta de Capital Dormido
          </h3>
          <p className="text-red-700 text-sm font-medium mt-1">
            Estos productos tienen stock en almacén, pero{" "}
            <strong>no han registrado ni una sola venta</strong> en los últimos{" "}
            {stagnantDays} días.
          </p>
        </div>
      </div>
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-red-100 flex flex-col items-center justify-center py-10">
        <p className="text-slate-400 font-black uppercase tracking-widest text-xs mb-2">
          Total de Dinero Estancado
        </p>
        <h2 className="text-5xl font-black text-red-600">
          S/{" "}
          {data.totalCapital.toLocaleString("es-PE", {
            minimumFractionDigits: 2,
          })}
        </h2>
      </div>
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-red-50/50 border-b border-red-100">
              <tr>
                <th className="p-4 pl-6 text-[10px] font-black text-red-600 uppercase tracking-widest">
                  Producto Estancado
                </th>
                <th className="p-4 text-[10px] font-black text-red-600 uppercase tracking-widest text-center">
                  Días sin Vender
                </th>
                <th className="p-4 text-[10px] font-black text-red-600 uppercase tracking-widest text-center">
                  Stock Atrapado
                </th>
                <th className="p-4 pr-6 text-[10px] font-black text-red-600 uppercase tracking-widest text-right">
                  Capital Inmovilizado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentData.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="p-8 text-center text-slate-400 font-bold"
                  >
                    ¡Felicidades! Todo tu inventario está rotando
                    saludablemente.
                  </td>
                </tr>
              ) : (
                currentData.map((item, idx) => (
                  <tr key={item.sku} className="hover:bg-slate-50">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-300 w-6">
                          {(page - 1) * pageSize + idx + 1}.
                        </span>
                        <div>
                          <p className="font-black text-slate-800">
                            {item.name}
                          </p>
                          <p className="text-xs text-slate-400 font-bold">
                            {item.sku}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center font-black text-red-500">
                      +{item.daysStagnant} días
                    </td>
                    <td className="p-4 text-center font-bold text-slate-600">
                      {item.quantity} unidades
                    </td>
                    <td className="p-4 pr-6 text-right font-black text-red-700">
                      S/{" "}
                      {item.totalValue.toLocaleString("es-PE", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data.items.length > 0 && (
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
