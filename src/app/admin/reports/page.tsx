"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import {
  getYieldReport,
  getProductSalesReport,
  getInventoryValuationReport,
  getTopCustomersReport,
  getSlowMovingStockReport,
  getKardexMovementsReport,
  ExtendedLog,
} from "@/services/reportsService";

import { ReportsTabs, ReportTab } from "@/components/reports/ReportsTabs";
import { ProductionTab } from "@/components/reports/tabs/ProductionTab";
import { SalesReportTab } from "@/components/reports/tabs/SalesReportTab";
import { CustomersReportTab } from "@/components/reports/tabs/CustomersReportTab";
import { ValuationTab } from "@/components/reports/tabs/ValuationTab";
import { StagnantTab } from "@/components/reports/tabs/StagnantTab";
import { KardexTab } from "@/components/reports/tabs/KardexTab";

const PIE_COLORS = [
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#64748b",
];

export default function MasterReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("PRODUCTION");
  const [isLoading, setIsLoading] = useState(false);
  const [isDebouncing, setIsDebouncing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [stagnantDays, setStagnantDays] = useState(60);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedStart, setDebouncedStart] = useState("");
  const [debouncedEnd, setDebouncedEnd] = useState("");

  const [prodLogs, setProdLogs] = useState<ExtendedLog[]>([]);
  const [prodStats, setProdStats] = useState({
    totalUsedMm: 0,
    totalScrapMm: 0,
    totalScrapKg: 0,
    avgEfficiency: 0,
    totalOps: 0,
  });

  const [salesData, setSalesData] = useState<Record<string, unknown>[]>([]);
  const [valuationData, setValuationData] = useState<{
    items: { sku: string; name: string; quantity: number; avgCost: number; totalValue: number }[];
    totalCapital: number;
  }>({ items: [], totalCapital: 0 });
  const [customersData, setCustomersData] = useState<Record<string, unknown>[]>([]);
  const [stagnantData, setStagnantData] = useState<{
    items: { sku: string; name: string; daysStagnant: number; quantity: number; totalValue: number }[];
    totalCapital: number;
  }>({ items: [], totalCapital: 0 });
  const [kardexData, setKardexData] = useState<
    { id: string; date: { toLocaleString: (l: string) => string }; sku: string; type: "IN" | "OUT"; quantity: number; balance: number; reference: string; description: string; user: string }[]
  >([]);

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
          const data = await getProductSalesReport(debouncedStart, debouncedEnd);
          const filtered = debouncedSearch
            ? data.filter(
                (d) =>
                  d.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                  d.sku.toLowerCase().includes(debouncedSearch.toLowerCase()),
              )
            : data;
          setSalesData(filtered as Record<string, unknown>[]);
          setSalesPage(1);
        } else if (activeTab === "VALUATION") {
          const data = await getInventoryValuationReport();
          const filteredItems = debouncedSearch
            ? data.items.filter(
                (d) =>
                  d.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                  d.sku.toLowerCase().includes(debouncedSearch.toLowerCase()),
              )
            : data.items;
          setValuationData({ items: filteredItems, totalCapital: data.totalCapital });
          setValPage(1);
        } else if (activeTab === "CUSTOMERS") {
          const data = await getTopCustomersReport(debouncedStart, debouncedEnd);
          const filtered = debouncedSearch
            ? data.filter(
                (d) =>
                  d.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                  d.documentNumber.includes(debouncedSearch),
              )
            : data;
          setCustomersData(filtered as Record<string, unknown>[]);
          setCustPage(1);
        } else if (activeTab === "STAGNANT") {
          const data = await getSlowMovingStockReport(stagnantDays);
          const filteredItems = debouncedSearch
            ? data.items.filter(
                (d: { name: string; sku: string }) =>
                  d.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                  d.sku.toLowerCase().includes(debouncedSearch.toLowerCase()),
              )
            : data.items;
          setStagnantData({ items: filteredItems, totalCapital: data.totalCapital });
          setStagPage(1);
        } else if (activeTab === "KARDEX") {
          const data = await getKardexMovementsReport(
            debouncedStart,
            debouncedEnd,
            debouncedSearch,
          );
          setKardexData(data);
          setKardexPage(1);
        }
      } catch {
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
    .map((item, index) => ({ ...item, fill: PIE_COLORS[index % PIE_COLORS.length] }));

  const handleExportKardexToExcel = () => {
    if (kardexData.length === 0)
      return toast.error("No hay datos para exportar en estas fechas.");

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
    worksheet["!cols"] = [
      { wch: 5 }, { wch: 20 }, { wch: 15 }, { wch: 18 }, { wch: 15 },
      { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 40 }, { wch: 25 },
    ];
    XLSX.writeFile(workbook, `Kardex_Historico_AYR_${new Date().getTime()}.xlsx`);
    toast.success("¡Excel de Kardex descargado!");
  };

  const handleTabChange = (tab: ReportTab) => {
    setActiveTab(tab);
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-in fade-in">
      <ReportsTabs activeTab={activeTab} onTabChange={handleTabChange} />

      {isLoading && (
        <div className="flex justify-center items-center py-20">
          <Loader2 size={40} className="animate-spin text-blue-500" />
        </div>
      )}

      {activeTab === "PRODUCTION" && (
        <ProductionTab
          logs={prodLogs}
          stats={prodStats}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          isSearching={isLoading || isDebouncing}
        />
      )}

      {activeTab === "SALES" && (
        <SalesReportTab
          allData={salesData}
          currentData={currentSales}
          page={salesPage}
          totalPages={totalSalesPages}
          setPage={setSalesPage}
          pageSize={salesPageSize}
          setPageSize={setSalesPageSize}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          isLoading={isLoading}
          isDebouncing={isDebouncing}
        />
      )}

      {activeTab === "CUSTOMERS" && (
        <CustomersReportTab
          allData={customersData}
          currentData={currentCustomers}
          page={custPage}
          totalPages={totalCustPages}
          setPage={setCustPage}
          pageSize={custPageSize}
          setPageSize={setCustPageSize}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          isLoading={isLoading}
          isDebouncing={isDebouncing}
        />
      )}

      {activeTab === "VALUATION" && (
        <ValuationTab
          data={valuationData}
          currentData={currentValuations}
          pieData={pieDataWithColors}
          page={valPage}
          totalPages={totalValPages}
          setPage={setValPage}
          pageSize={valPageSize}
          setPageSize={setValPageSize}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          isLoading={isLoading}
          isDebouncing={isDebouncing}
        />
      )}

      {activeTab === "STAGNANT" && (
        <StagnantTab
          data={stagnantData}
          currentData={currentStagnant}
          stagnantDays={stagnantDays}
          setStagnantDays={setStagnantDays}
          page={stagPage}
          totalPages={totalStagPages}
          setPage={setStagPage}
          pageSize={stagPageSize}
          setPageSize={setStagPageSize}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          isLoading={isLoading}
          isDebouncing={isDebouncing}
        />
      )}

      {activeTab === "KARDEX" && (
        <KardexTab
          allData={kardexData}
          currentData={currentKardex}
          page={kardexPage}
          totalPages={totalKardexPages}
          setPage={setKardexPage}
          pageSize={kardexPageSize}
          setPageSize={setKardexPageSize}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          isLoading={isLoading}
          isDebouncing={isDebouncing}
          onExport={handleExportKardexToExcel}
        />
      )}
    </div>
  );
}
