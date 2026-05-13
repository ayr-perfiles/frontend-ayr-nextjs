"use client";

import { useState, useEffect } from "react";
// 🚀 NUEVA IMPORTACIÓN PARA GENERAR EL EXCEL
import * as XLSX from "xlsx";
import {
  BarChart3,
  TrendingUp,
  Boxes,
  Users,
  Hourglass,
  Loader2,
  DollarSign,
  Trophy,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertOctagon,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
} from "recharts";

import { getYieldReport } from "@/services/reportsService";
import { YieldFilters } from "@/components/reports/YieldFilters";
import { YieldTable } from "@/components/reports/YieldTable";
import {
  getProductSalesReport,
  getInventoryValuationReport,
  getTopCustomersReport,
  getSlowMovingStockReport,
  getKardexMovementsReport, // 🚀 NUEVA FUNCIÓN IMPORTADA
} from "@/services/reportsService";

const PIE_COLORS = [
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#64748b",
];

export default function MasterReportsPage() {
  // 🚀 SE AGREGÓ LA PESTAÑA "KARDEX" AL ESTADO
  const [activeTab, setActiveTab] = useState<
    "PRODUCTION" | "SALES" | "VALUATION" | "CUSTOMERS" | "STAGNANT" | "KARDEX"
  >("PRODUCTION");

  const [isLoading, setIsLoading] = useState(false);
  const [isDebouncing, setIsDebouncing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [stagnantDays, setStagnantDays] = useState(60);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedStart, setDebouncedStart] = useState("");
  const [debouncedEnd, setDebouncedEnd] = useState("");

  const [prodLogs, setProdLogs] = useState<any[]>([]);
  const [prodStats, setProdStats] = useState({
    totalUsedMm: 0,
    totalScrapMm: 0,
    totalScrapKg: 0,
    avgEfficiency: 0,
    totalOps: 0,
  });

  const [salesData, setSalesData] = useState<any[]>([]);
  const [valuationData, setValuationData] = useState<{
    items: any[];
    totalCapital: number;
  }>({ items: [], totalCapital: 0 });
  const [customersData, setCustomersData] = useState<any[]>([]);
  const [stagnantData, setStagnantData] = useState<{
    items: any[];
    totalCapital: number;
  }>({ items: [], totalCapital: 0 });

  // 🚀 NUEVO ESTADO: Datos del Kardex Histórico
  const [kardexData, setKardexData] = useState<any[]>([]);

  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(10);
  const [valPage, setValPage] = useState(1);
  const [valPageSize, setValPageSize] = useState(10);
  const [custPage, setCustPage] = useState(1);
  const [custPageSize, setCustPageSize] = useState(10);
  const [stagPage, setStagPage] = useState(1);
  const [stagPageSize, setStagPageSize] = useState(10);
  const [kardexPage, setKardexPage] = useState(1);
  const [kardexPageSize, setKardexPageSize] = useState(25);

  useEffect(() => {
    setIsDebouncing(true);
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setDebouncedStart(startDate);
      setDebouncedEnd(endDate);
      setIsDebouncing(false);
    }, 800);
    return () => clearTimeout(handler);
  }, [searchTerm, startDate, endDate]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (activeTab === "PRODUCTION") {
          const data = await getYieldReport({
            pageSize: 15,
            searchTerm: debouncedSearch,
            startDate: debouncedStart,
            endDate: debouncedEnd,
          });
          setProdLogs(data.logs);
          setProdStats(data.stats);
        } else if (activeTab === "SALES") {
          const data = await getProductSalesReport(
            debouncedStart,
            debouncedEnd,
          );
          const filtered = debouncedSearch
            ? data.filter(
                (d) =>
                  d.name
                    .toLowerCase()
                    .includes(debouncedSearch.toLowerCase()) ||
                  d.sku.toLowerCase().includes(debouncedSearch.toLowerCase()),
              )
            : data;
          setSalesData(filtered);
          setSalesPage(1);
        } else if (activeTab === "VALUATION") {
          const data = await getInventoryValuationReport();
          const filteredItems = debouncedSearch
            ? data.items.filter(
                (d) =>
                  d.name
                    .toLowerCase()
                    .includes(debouncedSearch.toLowerCase()) ||
                  d.sku.toLowerCase().includes(debouncedSearch.toLowerCase()),
              )
            : data.items;
          setValuationData({
            items: filteredItems,
            totalCapital: data.totalCapital,
          });
          setValPage(1);
        } else if (activeTab === "CUSTOMERS") {
          const data = await getTopCustomersReport(
            debouncedStart,
            debouncedEnd,
          );
          const filtered = debouncedSearch
            ? data.filter(
                (d) =>
                  d.name
                    .toLowerCase()
                    .includes(debouncedSearch.toLowerCase()) ||
                  d.documentNumber.includes(debouncedSearch),
              )
            : data;
          setCustomersData(filtered);
          setCustPage(1);
        } else if (activeTab === "STAGNANT") {
          const data = await getSlowMovingStockReport(stagnantDays);
          const filteredItems = debouncedSearch
            ? data.items.filter(
                (d: any) =>
                  d.name
                    .toLowerCase()
                    .includes(debouncedSearch.toLowerCase()) ||
                  d.sku.toLowerCase().includes(debouncedSearch.toLowerCase()),
              )
            : data.items;
          setStagnantData({
            items: filteredItems,
            totalCapital: data.totalCapital,
          });
          setStagPage(1);
        } else if (activeTab === "KARDEX") {
          // 🚀 CARGAMOS EL KARDEX AL CAMBIAR A ESTA PESTAÑA
          const data = await getKardexMovementsReport(
            debouncedStart,
            debouncedEnd,
            debouncedSearch,
          );
          setKardexData(data);
          setKardexPage(1);
        }
      } catch (error) {
        toast.error("Error al cargar los datos del reporte.");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [activeTab, debouncedSearch, debouncedStart, debouncedEnd, stagnantDays]);

  const totalSalesPages = Math.ceil(salesData.length / salesPageSize);
  const currentSales = salesData.slice(
    (salesPage - 1) * salesPageSize,
    salesPage * salesPageSize,
  );

  const totalValPages = Math.ceil(valuationData.items.length / valPageSize);
  const currentValuations = valuationData.items.slice(
    (valPage - 1) * valPageSize,
    valPage * valPageSize,
  );

  const totalCustPages = Math.ceil(customersData.length / custPageSize);
  const currentCustomers = customersData.slice(
    (custPage - 1) * custPageSize,
    custPage * custPageSize,
  );

  const totalStagPages = Math.ceil(stagnantData.items.length / stagPageSize);
  const currentStagnant = stagnantData.items.slice(
    (stagPage - 1) * stagPageSize,
    stagPage * stagPageSize,
  );

  const totalKardexPages = Math.ceil(kardexData.length / kardexPageSize);
  const currentKardex = kardexData.slice(
    (kardexPage - 1) * kardexPageSize,
    kardexPage * kardexPageSize,
  );

  const pieDataWithColors = valuationData.items
    .slice(0, 5)
    .map((item, index) => ({
      ...item,
      fill: PIE_COLORS[index % PIE_COLORS.length],
    }));

  // 🚀 LÓGICA DE EXPORTACIÓN A EXCEL (XLSX)
  const handleExportKardexToExcel = () => {
    if (kardexData.length === 0)
      return toast.error("No hay datos para exportar en estas fechas.");

    // Mapeamos los datos para que las columnas del Excel sean amigables
    const dataForExcel = kardexData.map((item, index) => ({
      "N°": index + 1,
      "FECHA OPERACIÓN": item.date.toLocaleString("es-PE"),
      "CÓDIGO (SKU)": item.sku,
      "TIPO MOVIMIENTO": item.type === "IN" ? "ENTRADA" : "SALIDA",
      "CANTIDAD FÍSICA": item.type === "IN" ? item.quantity : -item.quantity,
      "SALDO (KARDEX)": item.balance,
      "TIPO DOCUMENTO": item.reference.startsWith("V-")
        ? "FACTURA/BOLETA"
        : "PARTE PRODUCCIÓN",
      "N° DOCUMENTO REFERENCIA": item.reference,
      DESCRIPCIÓN: item.description,
      "USUARIO RESPONSABLE": item.user,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kardex_SUNAT");

    // Ajustar el ancho de las columnas
    const wscols = [
      { wch: 5 },
      { wch: 20 },
      { wch: 15 },
      { wch: 18 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 25 },
      { wch: 40 },
      { wch: 25 },
    ];
    worksheet["!cols"] = wscols;

    XLSX.writeFile(
      workbook,
      `Kardex_Historico_AYR_${new Date().getTime()}.xlsx`,
    );
    toast.success("¡Excel de Kardex descargado!");
  };

  const FinancialFilters = ({ placeholder }: { placeholder: string }) => (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
      <div className="relative w-full md:flex-1">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={18}
        />
        <input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm"
        />
        {(isDebouncing || isLoading) && (
          <Loader2
            size={16}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 animate-spin"
          />
        )}
      </div>
      <div className="flex gap-2 w-full md:w-auto">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="flex-1 md:w-auto p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-600 font-medium"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="flex-1 md:w-auto p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-600 font-medium"
        />
      </div>
    </div>
  );

  const StagnantFilters = () => (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
      <div className="relative w-full md:flex-1">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={18}
        />
        <input
          type="text"
          placeholder="Buscar producto estancado..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-medium text-sm"
        />
        {(isDebouncing || isLoading) && (
          <Loader2
            size={16}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 animate-spin"
          />
        )}
      </div>
      <div className="flex items-center gap-2 w-full md:w-auto">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
          Sin ventas en:
        </label>
        <select
          value={stagnantDays}
          onChange={(e) => setStagnantDays(Number(e.target.value))}
          className="flex-1 md:w-auto p-2.5 bg-red-50 border border-red-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-bold text-red-700 cursor-pointer"
        >
          <option value={30}>Últimos 30 días</option>
          <option value={60}>Últimos 60 días</option>
          <option value={90}>Últimos 90 días</option>
          <option value={120}>Últimos 120 días</option>
        </select>
      </div>
    </div>
  );

  const PaginationControls = ({
    page,
    totalPages,
    setPage,
    pageSize,
    setPageSize,
  }: any) => (
    <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage((p: number) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 transition border border-slate-200"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-xs text-slate-500 font-medium">
          Pág.{" "}
          <span className="font-black text-slate-800 text-sm mx-1">{page}</span>{" "}
          de {totalPages || 1}
        </div>
        <button
          onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages || totalPages === 0}
          className="flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 transition border border-slate-200"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Mostrar:
        </label>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 transition shadow-sm cursor-pointer"
        >
          <option value={10}>10 ítems</option>
          <option value={25}>25 ítems</option>
          <option value={50}>50 ítems</option>
          <option value={100}>100 ítems</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-in fade-in">
      {/* CABECERA Y SELECTOR DE PESTAÑAS (AMPLIADO PARA INCLUIR KARDEX) */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 overflow-x-auto">
        <div className="flex w-full md:w-auto p-1 bg-slate-50 rounded-xl border border-slate-200 min-w-max">
          <button
            onClick={() => {
              setActiveTab("PRODUCTION");
              setSearchTerm("");
              setStartDate("");
              setEndDate("");
            }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all ${activeTab === "PRODUCTION" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <BarChart3 size={18} /> Producción
          </button>
          <button
            onClick={() => {
              setActiveTab("SALES");
              setSearchTerm("");
              setStartDate("");
              setEndDate("");
            }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all ${activeTab === "SALES" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <TrendingUp size={18} /> Top Ventas
          </button>
          <button
            onClick={() => {
              setActiveTab("CUSTOMERS");
              setSearchTerm("");
              setStartDate("");
              setEndDate("");
            }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all ${activeTab === "CUSTOMERS" ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <Users size={18} /> Clientes VIP
          </button>
          <button
            onClick={() => {
              setActiveTab("VALUATION");
              setSearchTerm("");
              setStartDate("");
              setEndDate("");
            }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all ${activeTab === "VALUATION" ? "bg-white text-purple-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <Boxes size={18} /> Valorización
          </button>
          <button
            onClick={() => {
              setActiveTab("STAGNANT");
              setSearchTerm("");
              setStartDate("");
              setEndDate("");
            }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all ${activeTab === "STAGNANT" ? "bg-white text-red-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <Hourglass size={18} /> Estancados
          </button>
          <button
            onClick={() => {
              setActiveTab("KARDEX");
              setSearchTerm("");
              setStartDate("");
              setEndDate("");
            }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all ${activeTab === "KARDEX" ? "bg-white text-indigo-600 shadow-sm border border-indigo-100" : "text-slate-500 hover:text-slate-700"}`}
          >
            <FileSpreadsheet size={18} /> Kardex SUNAT
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center py-20">
          <Loader2 size={40} className="animate-spin text-blue-500" />
        </div>
      )}

      {/* PESTAÑA 1: PRODUCCIÓN */}
      {activeTab === "PRODUCTION" && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <YieldFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            isSearching={isLoading || isDebouncing}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Eficiencia Global
              </p>
              <h3 className="text-4xl font-black text-slate-800">
                {prodStats.avgEfficiency.toFixed(1)}%
              </h3>
            </div>
            <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Chatarra Generada
              </p>
              <h3 className="text-4xl font-black text-orange-400">
                {prodStats.totalScrapKg.toFixed(2)} kg
              </h3>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Ciclos de Corte
              </p>
              <h3 className="text-4xl font-black text-slate-800">
                {prodStats.totalOps}
              </h3>
            </div>
          </div>
          <YieldTable logs={prodLogs} currentPage={1} pageSize={15} />
        </div>
      )}

      {/* PESTAÑA 2: VENTAS */}
      {activeTab === "SALES" && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <FinancialFilters placeholder="Buscar por código SKU o producto..." />
          {salesData.length > 0 && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-[400px]">
              <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6">
                Top 10 Productos con Mayor Ingreso
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={salesData.slice(0, 10)}
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
                    tickFormatter={(value) => `S/ ${value / 1000}k`}
                  />
                  <RechartsTooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value: any) => [
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
                  {currentSales.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-8 text-center text-slate-400 font-bold"
                      >
                        No se encontraron productos.
                      </td>
                    </tr>
                  ) : (
                    currentSales.map((item, idx) => (
                      <tr key={item.sku} className="hover:bg-slate-50">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-slate-300 w-6">
                              {(salesPage - 1) * salesPageSize + idx + 1}.
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
                          {item.quantitySold}
                        </td>
                        <td className="p-4 text-right font-bold text-slate-600">
                          S/{" "}
                          {item.revenueWithoutIGV.toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-4 text-right font-black text-emerald-600">
                          S/{" "}
                          {item.netProfit.toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {salesData.length > 0 && (
              <PaginationControls
                page={salesPage}
                totalPages={totalSalesPages}
                setPage={setSalesPage}
                pageSize={salesPageSize}
                setPageSize={setSalesPageSize}
              />
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 3: TOP CLIENTES */}
      {activeTab === "CUSTOMERS" && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <FinancialFilters placeholder="Buscar RUC o Razón Social..." />
          {customersData.length > 0 && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-[500px]">
              <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6">
                Top 10 Clientes por Ganancia Neta
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={customersData.slice(0, 10)}
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
                    tickFormatter={(value) => `S/ ${value / 1000}k`}
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
                    formatter={(value: any) => [
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
                  {currentCustomers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-8 text-center text-slate-400 font-bold"
                      >
                        No se encontraron clientes
                      </td>
                    </tr>
                  ) : (
                    currentCustomers.map((client, idx) => (
                      <tr
                        key={client.documentNumber}
                        className="hover:bg-slate-50"
                      >
                        <td className="p-4 pl-6">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-slate-300 w-6">
                              {(custPage - 1) * custPageSize + idx + 1}.
                            </span>
                            <div>
                              <p className="font-black text-slate-800">
                                {client.name}
                              </p>
                              <p className="text-xs text-slate-400 font-bold">
                                Doc: {client.documentNumber}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center font-black text-slate-600">
                          {client.totalOrders} docs
                        </td>
                        <td className="p-4 text-right font-bold text-slate-600">
                          S/{" "}
                          {client.revenueWithoutIGV.toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-4 pr-6 text-right font-black text-amber-600">
                          S/{" "}
                          {client.netProfit.toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {customersData.length > 0 && (
              <PaginationControls
                page={custPage}
                totalPages={totalCustPages}
                setPage={setCustPage}
                pageSize={custPageSize}
                setPageSize={setCustPageSize}
              />
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 4: VALORIZACIÓN */}
      {activeTab === "VALUATION" && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <FinancialFilters placeholder="Buscar por código SKU o producto..." />
          <div className="bg-purple-900 text-white p-8 rounded-3xl shadow-lg flex items-center justify-between">
            <div>
              <p className="text-purple-300 font-black uppercase tracking-widest text-xs mb-2">
                Capital Total Inmovilizado en Almacén
              </p>
              <h2 className="text-5xl font-black">
                S/{" "}
                {valuationData.totalCapital.toLocaleString("es-PE", {
                  minimumFractionDigits: 2,
                })}
              </h2>
            </div>
            <DollarSign size={64} className="text-purple-700 opacity-50" />
          </div>
          {valuationData.items.length > 0 && (
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
                    data={pieDataWithColors}
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
                      `S/ ${Number(value).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
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
                  {currentValuations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-8 text-center text-slate-400 font-bold"
                      >
                        No se encontraron productos inmovilizados.
                      </td>
                    </tr>
                  ) : (
                    currentValuations.map((item, idx) => (
                      <tr key={item.sku} className="hover:bg-slate-50">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-slate-300 w-6">
                              {(valPage - 1) * valPageSize + idx + 1}.
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
            {valuationData.items.length > 0 && (
              <PaginationControls
                page={valPage}
                totalPages={totalValPages}
                setPage={setValPage}
                pageSize={valPageSize}
                setPageSize={setValPageSize}
              />
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 5: INVENTARIO ESTANCADO */}
      {activeTab === "STAGNANT" && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <StagnantFilters />
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
                <strong>no han registrado ni una sola venta</strong> en los
                últimos {stagnantDays} días.
              </p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-red-100 flex flex-col items-center justify-center py-10">
            <p className="text-slate-400 font-black uppercase tracking-widest text-xs mb-2">
              Total de Dinero Estancado
            </p>
            <h2 className="text-5xl font-black text-red-600">
              S/{" "}
              {stagnantData.totalCapital.toLocaleString("es-PE", {
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
                  {currentStagnant.length === 0 ? (
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
                    currentStagnant.map((item, idx) => (
                      <tr key={item.sku} className="hover:bg-slate-50">
                        <td className="p-4 pl-6">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-slate-300 w-6">
                              {(stagPage - 1) * stagPageSize + idx + 1}.
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
            {stagnantData.items.length > 0 && (
              <PaginationControls
                page={stagPage}
                totalPages={totalStagPages}
                setPage={setStagPage}
                pageSize={stagPageSize}
                setPageSize={setStagPageSize}
              />
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 🚀 PESTAÑA 6: KARDEX SUNAT (NUEVA PESTAÑA) */}
      {/* ========================================================= */}
      {activeTab === "KARDEX" && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <FinancialFilters placeholder="Filtrar por SKU específico..." />

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
                  ordenados por fecha y los formatea listos para ser trabajados
                  por el área contable.
                </p>
              </div>
            </div>
            <button
              onClick={handleExportKardexToExcel}
              disabled={kardexData.length === 0}
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
                  {currentKardex.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-8 text-center text-slate-400 font-bold"
                      >
                        No se encontraron movimientos en este rango de fechas.
                      </td>
                    </tr>
                  ) : (
                    currentKardex.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50 text-sm">
                        <td className="p-4 pl-6 font-medium text-slate-600">
                          {item.date.toLocaleString("es-PE")}
                        </td>
                        <td className="p-4 font-black text-slate-800">
                          {item.sku}
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${item.type === "IN" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}
                          >
                            {item.type === "IN" ? "ENTRADA" : "SALIDA"}
                          </span>
                        </td>
                        <td
                          className={`p-4 text-center font-black ${item.type === "IN" ? "text-emerald-600" : "text-red-600"}`}
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
            {kardexData.length > 0 && (
              <PaginationControls
                page={kardexPage}
                totalPages={totalKardexPages}
                setPage={setKardexPage}
                pageSize={kardexPageSize}
                setPageSize={setKardexPageSize}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
