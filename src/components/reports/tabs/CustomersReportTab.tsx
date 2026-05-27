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

interface CustomersReportTabProps {
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

export function CustomersReportTab({
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
}: CustomersReportTabProps) {
  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      <FinancialFilters
        placeholder="Buscar RUC o Razón Social..."
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
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-[500px]">
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6">
            Top 10 Clientes por Ganancia Neta
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={allData.slice(0, 10)}
              margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="#f1f5f9"
              />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#64748b" }}
                tickFormatter={(v: number) => `S/ ${v / 1000}k`}
              />
              <YAxis
                dataKey="name"
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#64748b", fontWeight: "bold" }}
                width={180}
                tickFormatter={(name: string) =>
                  name.length > 22 ? name.substring(0, 22) + "..." : name
                }
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
                name="Ingreso Total"
                fill="#fcd34d"
                radius={[0, 4, 4, 0]}
                maxBarSize={16}
              />
              <Bar
                dataKey="netProfit"
                name="Ganancia Neta"
                fill="#d97706"
                radius={[0, 4, 4, 0]}
                maxBarSize={16}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-amber-50/50 border-b border-amber-100">
              <tr>
                <th className="p-4 pl-6 text-[10px] font-black text-amber-700 uppercase tracking-widest">
                  Razón Social / Nombre
                </th>
                <th className="p-4 text-[10px] font-black text-amber-700 uppercase tracking-widest text-center">
                  Cant. Compras
                </th>
                <th className="p-4 text-[10px] font-black text-amber-700 uppercase tracking-widest text-right">
                  Volumen Ingresos
                </th>
                <th className="p-4 pr-6 text-[10px] font-black text-amber-700 uppercase tracking-widest text-right">
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
                    No se encontraron clientes
                  </td>
                </tr>
              ) : (
                currentData.map((client, idx) => (
                  <tr
                    key={String(client.documentNumber)}
                    className="hover:bg-slate-50"
                  >
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-300 w-6">
                          {(page - 1) * pageSize + idx + 1}.
                        </span>
                        <div>
                          <p className="font-black text-slate-800">
                            {String(client.name)}
                          </p>
                          <p className="text-xs text-slate-400 font-bold">
                            Doc: {String(client.documentNumber)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center font-black text-slate-600">
                      {String(client.totalOrders)} docs
                    </td>
                    <td className="p-4 text-right font-bold text-slate-600">
                      S/{" "}
                      {Number(client.revenueWithoutIGV).toLocaleString(
                        "es-PE",
                        { minimumFractionDigits: 2 },
                      )}
                    </td>
                    <td className="p-4 pr-6 text-right font-black text-amber-600">
                      S/{" "}
                      {Number(client.netProfit).toLocaleString("es-PE", {
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
