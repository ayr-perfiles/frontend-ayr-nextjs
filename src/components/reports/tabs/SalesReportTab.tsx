"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { FinancialFilters } from "@/components/reports/FinancialFilters";
import { PaginationControls } from "@/components/reports/PaginationControls";

interface SalesReportTabProps {
  allData: Record<string, unknown>[];
  currentData: Record<string, unknown>[];
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
}

export function SalesReportTab({
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
}: SalesReportTabProps) {
  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      <FinancialFilters
        placeholder="Buscar por código SKU o producto..."
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        isLoading={isLoading}
        isDebouncing={isDebouncing}
      />
      {allData.length > 0 && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-[400px]">
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6">
            Top 10 Productos con Mayor Ingreso
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={allData.slice(0, 10)}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />
              <XAxis
                dataKey="sku"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#64748b", fontWeight: "bold" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#64748b" }}
                tickFormatter={(v: number) => `S/ ${v / 1000}k`}
              />
              <RechartsTooltip
                cursor={{ fill: "#f8fafc" }}
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.1)",
                }}
                formatter={(value: number) => [
                  `S/ ${Number(value).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
                  "",
                ]}
              />
              <Legend wrapperStyle={{ paddingTop: "20px" }} />
              <Bar
                dataKey="revenueWithoutIGV"
                name="Ingresos Reales"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
              <Bar
                dataKey="netProfit"
                name="Ganancia Neta"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-emerald-50/50 border-b border-emerald-100">
              <tr>
                <th className="p-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                  Producto
                </th>
                <th className="p-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center">
                  Unidades Vendidas
                </th>
                <th className="p-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right">
                  Ingresos (Sin IGV)
                </th>
                <th className="p-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right">
                  Ganancia Neta
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
                    No se encontraron productos.
                  </td>
                </tr>
              ) : (
                currentData.map((item, idx) => (
                  <tr key={String(item.sku)} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-300 w-6">
                          {(page - 1) * pageSize + idx + 1}.
                        </span>
                        <div>
                          <p className="font-black text-slate-800">
                            {String(item.name)}
                          </p>
                          <p className="text-xs text-slate-400 font-bold">
                            {String(item.sku)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center font-black text-slate-600">
                      {String(item.quantitySold)}
                    </td>
                    <td className="p-4 text-right font-bold text-slate-600">
                      S/{" "}
                      {Number(item.revenueWithoutIGV).toLocaleString("es-PE", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-4 text-right font-black text-emerald-600">
                      S/{" "}
                      {Number(item.netProfit).toLocaleString("es-PE", {
                        minimumFractionDigits: 2,
                      })}
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
