"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { DollarSign } from "lucide-react";
import { FinancialFilters } from "@/components/reports/FinancialFilters";
import { PaginationControls } from "@/components/reports/PaginationControls";

interface ValuationItem {
  sku: string;
  name: string;
  quantity: number;
  avgCost: number;
  totalValue: number;
  fill?: string;
}

interface ValuationTabProps {
  data: { items: ValuationItem[]; totalCapital: number };
  currentData: ValuationItem[];
  pieData: ValuationItem[];
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

export function ValuationTab({
  data,
  currentData,
  pieData,
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
}: ValuationTabProps) {
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
      <div className="bg-purple-900 text-white p-8 rounded-3xl shadow-lg flex items-center justify-between">
        <div>
          <p className="text-purple-300 font-black uppercase tracking-widest text-xs mb-2">
            Capital Total Inmovilizado en Almacén
          </p>
          <h2 className="text-5xl font-black">
            S/{" "}
            {data.totalCapital.toLocaleString("es-PE", {
              minimumFractionDigits: 2,
            })}
          </h2>
        </div>
        <DollarSign size={64} className="text-purple-700 opacity-50" />
      </div>
      {data.items.length > 0 && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-[350px] flex flex-col md:flex-row items-center">
          <div className="w-full md:w-1/3 mb-4 md:mb-0 text-center md:text-left">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
              Distribución del Capital
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Top 5 productos con mayor inversión inmovilizada en almacén.
            </p>
          </div>
          <ResponsiveContainer
            width="100%"
            height="100%"
            className="md:w-2/3"
          >
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={120}
                paddingAngle={5}
                dataKey="totalValue"
                nameKey="sku"
              />
              <RechartsTooltip
                formatter={(value: any) => [
                  `S/ ${Number(value || 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
                  "Valorización",
                ]}
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.1)",
                }}
              />
              <Legend
                verticalAlign="middle"
                align="right"
                layout="vertical"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-purple-50/50 border-b border-purple-100">
              <tr>
                <th className="p-4 text-[10px] font-black text-purple-600 uppercase tracking-widest">
                  Producto
                </th>
                <th className="p-4 text-[10px] font-black text-purple-600 uppercase tracking-widest text-center">
                  Stock Físico Actual
                </th>
                <th className="p-4 text-[10px] font-black text-purple-600 uppercase tracking-widest text-right">
                  Costo Promedio Unit.
                </th>
                <th className="p-4 pr-6 text-[10px] font-black text-purple-600 uppercase tracking-widest text-right">
                  Valorización Total
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
                    No se encontraron productos inmovilizados.
                  </td>
                </tr>
              ) : (
                currentData.map((item, idx) => (
                  <tr key={item.sku} className="hover:bg-slate-50">
                    <td className="p-4">
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
                    <td className="p-4 text-center font-black text-slate-600">
                      {item.quantity}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-slate-500">
                      S/ {item.avgCost.toFixed(4)}
                    </td>
                    <td className="p-4 pr-6 text-right font-black text-purple-700">
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
