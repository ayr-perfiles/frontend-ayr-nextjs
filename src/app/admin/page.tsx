"use client";

import { useEffect, useState } from "react";
import { getDashboardData, TimeFilter } from "@/services/dashboardService";
import { useAuth } from "@/context/AuthContext";
// AHORA IMPORTAMOS EL NUEVO REPORTE EXCLUSIVO DEL DASHBOARD
import { PrintableDashboardReport } from "@/components/dashboard/PrintableDashboardReport";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  FileText,
  AlertTriangle,
  Package,
  Loader2,
  BarChart3,
  CheckCircle2,
  Download,
  Calendar,
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("MONTH");
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const dashboardData = await getDashboardData(timeFilter);
      setData(dashboardData);
      setIsLoading(false);
    };
    loadData();
  }, [timeFilter]);

  const handlePrintPDF = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-blue-600">
        <Loader2 size={48} className="animate-spin mb-4" />
        <p className="font-bold text-gray-500">
          Cargando Inteligencia de Negocios...
        </p>
      </div>
    );
  }

  const getFilterLabel = () => {
    if (timeFilter === "7D") return "los Últimos 7 Días";
    if (timeFilter === "MONTH") return "este Mes";
    return "este Año";
  };

  const getPeriodLabel = () => {
    const now = new Date();
    if (timeFilter === "7D")
      return `Semana ${now.getDate() - 6} - ${now.getDate()}`;
    if (timeFilter === "MONTH")
      return now.toLocaleDateString("es-PE", {
        month: "long",
        year: "numeric",
      });
    return `Año ${now.getFullYear()}`;
  };

  // RENDERIZA EL NUEVO COMPONENTE AL EXPORTAR
  if (isPrinting) {
    return (
      <PrintableDashboardReport data={data} periodLabel={getPeriodLabel()} />
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 no-print">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <BarChart3 className="text-blue-600" /> Reporte Gerencial
          </h1>
          <p className="text-gray-500 text-sm font-medium mt-1">
            Resumen de operaciones de {getFilterLabel()}.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-48">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar size={16} className="text-gray-400" />
            </div>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-blue-500 cursor-pointer transition appearance-none"
            >
              <option value="7D">Últimos 7 Días</option>
              <option value="MONTH">Este Mes (Actual)</option>
              <option value="YEAR">Este Año</option>
            </select>
          </div>

          {/* <button
            onClick={handlePrintPDF}
            className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-black transition active:scale-95 shadow-lg shadow-gray-900/20 whitespace-nowrap"
          >
            <Download size={16} />{" "}
            <span className="hidden sm:inline">Exportar PDF</span>
          </button> */}
        </div>
      </div>

      {isLoading && (
        <div className="text-sm font-bold text-blue-500 flex items-center gap-2 animate-pulse">
          <Loader2 size={16} className="animate-spin" /> Actualizando datos...
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            icon: TrendingUp,
            label: "Ventas (Día)",
            value: `S/ ${data.todaySales.toFixed(2)}`,
            color: "blue",
          },
          {
            icon: DollarSign,
            label: "Ganancia Neta",
            value: `S/ ${data.periodProfit.toFixed(2)}`,
            color: "emerald",
          },
          {
            icon: FileText,
            label: "Cotizaciones Pend.",
            value: `${data.pendingQuotes} Docs`,
            color: "orange",
          },
          {
            icon: AlertTriangle,
            label: "Alertas de Stock",
            value: `${data.lowStockItems.length} SKUs`,
            color: "red",
          },
        ].map((kpi, idx) => (
          <div
            key={idx}
            className={`bg-${kpi.color}-50 p-6 rounded-2xl border border-${kpi.color}-100 relative overflow-hidden group`}
          >
            <div
              className={`absolute -right-4 -top-4 bg-${kpi.color}-100 w-24 h-24 rounded-full transition-transform group-hover:scale-150 z-0 opacity-50`}
            ></div>
            <div className="relative z-10">
              <p
                className={`text-xs font-black text-${kpi.color}-500 uppercase tracking-widest mb-1`}
              >
                {kpi.label}
              </p>
              <h3 className="text-3xl font-black text-gray-900">{kpi.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
          <h2 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
            <TrendingUp className="text-blue-500" size={20} /> Evolución de
            Ventas ({getFilterLabel()})
          </h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.evolutionChart}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f3f4f6"
                />
                <XAxis
                  dataKey="fecha"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#6b7280", fontWeight: "bold" }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#6b7280", fontWeight: "bold" }}
                  tickFormatter={(val) => `S/ ${val.toLocaleString("es-PE")}`}
                  width={80}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                  formatter={(value: any) =>
                    `S/ ${Number(value).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`
                  }
                  labelStyle={{ fontWeight: "bold", color: "#1f2937" }}
                />
                <Bar
                  dataKey="ventas"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2 border-b pb-4">
              <Package className="text-emerald-500" size={18} /> Top 5 Perfiles
              Vendidos
            </h2>
            {data.topProductsChart.length === 0 ? (
              <p className="text-xs text-gray-400 font-bold text-center py-4">
                No hay ventas.
              </p>
            ) : (
              <div className="space-y-4">
                {data.topProductsChart.map((prod: any, index: number) => (
                  <div
                    key={prod.sku}
                    className="flex justify-between items-center"
                  >
                    <span className="font-bold text-gray-800 text-sm">
                      {prod.sku}
                    </span>
                    <span className="font-mono text-sm font-bold text-emerald-600">
                      {prod.cantidad} pzas
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100">
            <h2 className="text-sm font-black text-red-600 mb-4 flex items-center gap-2 border-b pb-4">
              <AlertTriangle size={18} /> Alertas de Inventario
            </h2>
            {data.lowStockItems.length === 0 ? (
              <p className="text-xs text-green-700 font-bold text-center py-4">
                Inventario Saludable
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                {data.lowStockItems.map((item: any) => (
                  <div
                    key={item.sku}
                    className="flex justify-between items-center p-3 bg-red-50 rounded-xl border border-red-100"
                  >
                    <span className="font-black text-gray-800 text-sm">
                      {item.sku}
                    </span>
                    <span
                      className={`font-mono text-sm font-black ${item.quantity === 0 ? "text-red-600" : "text-orange-600"}`}
                    >
                      {item.quantity} und.
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
