"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useReactToPrint } from "react-to-print";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase/clientApp";
import { algoliaClient, ALGOLIA_INDICES } from "@/lib/algoliaClient";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  limit,
  where,
} from "firebase/firestore";
import { Sale } from "@/types";
import { approveQuotation } from "@/services/salesService";
import { PrintableTicket } from "@/components/sales/PrintableTicket";
import {
  ShoppingBag,
  Plus,
  ChevronDown,
  Download,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

import { SalesMetrics } from "@/components/sales/SalesMetrics";
import { SalesFilters } from "@/components/sales/SalesFilters";
import { SalesTable } from "@/components/sales/SalesTable";
import toast from "react-hot-toast";
import { BulkUploadSales } from "@/components/sales/BulkUploadSales";
import { SaleDetailsModal } from "@/components/sales/SaleDetailsModal";

// --- SUB-COMPONENTE: MENÚ DESPLEGABLE DE OPCIONES ---
function HeaderOptions({
  onExport,
  onOpenExcel,
}: {
  onExport: () => void;
  onOpenExcel: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative z-40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition font-bold shadow-sm h-full"
      >
        Opciones{" "}
        <ChevronDown
          size={18}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in zoom-in-95">
            <p className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Exportar / Importar
            </p>

            <button
              onClick={() => {
                setIsOpen(false);
                onExport();
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 font-medium transition"
            >
              <Download size={18} className="text-gray-400" /> Descargar Reporte
              CSV
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                onOpenExcel();
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 font-medium transition"
            >
              <FileSpreadsheet size={18} className="text-green-500" /> Migración
              Masiva (Excel)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
// ------------------------------------------------------

export default function SalesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialCustomerDoc = searchParams.get("customerDoc");
  const { role } = useAuth();

  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [limitCount, setLimitCount] = useState(30);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [searchTerm, setSearchTerm] = useState(initialCustomerDoc || "");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [selectedCustomerDoc, setSelectedCustomerDoc] = useState<string | null>(
    initialCustomerDoc,
  );
  const searchInputRef = useRef<HTMLDivElement>(null);

  // Estados de Modales
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [showExcelModal, setShowExcelModal] = useState(false);

  const [saleToPrint, setSaleToPrint] = useState<Sale | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `AYR_STEEL_${saleToPrint?.id?.slice(-5) || "DOC"}`,
  });

  useEffect(() => {
    if (saleToPrint) {
      handlePrint();
      const timer = setTimeout(() => setSaleToPrint(null), 500);
      return () => clearTimeout(timer);
    }
  }, [saleToPrint, handlePrint]);

  const updateUrlParams = (docNum: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (docNum) params.set("customerDoc", docNum);
    else params.delete("customerDoc");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    let baseQuery = collection(db, "sales");
    let queryConstraints: any[] = [];

    if (selectedCustomerDoc)
      queryConstraints.push(where("documentNumber", "==", selectedCustomerDoc));
    if (statusFilter !== "ALL")
      queryConstraints.push(where("status", "==", statusFilter));

    if (startDate)
      queryConstraints.push(
        where("timestamp", ">=", new Date(startDate + "T00:00:00")),
      );
    if (endDate)
      queryConstraints.push(
        where("timestamp", "<=", new Date(endDate + "T23:59:59")),
      );

    queryConstraints.push(orderBy("timestamp", "desc"), limit(limitCount));

    const q = query(baseQuery, ...queryConstraints);
    const unsub = onSnapshot(q, (snapshot) => {
      setSales(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Sale[]);
      setIsLoading(false);
    });
    return () => unsub();
  }, [limitCount, startDate, endDate, statusFilter, selectedCustomerDoc]);

  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (selectedCustomerDoc && searchTerm === selectedCustomerDoc) return;
    if (selectedCustomerDoc && searchTerm !== selectedCustomerDoc) return;

    const getSuggestions = async () => {
      setIsSearching(true);
      try {
        const { hits } = await algoliaClient.searchSingleIndex({
          indexName: ALGOLIA_INDICES.CUSTOMERS,
          searchParams: { query: searchTerm, hitsPerPage: 5 },
        });
        setSuggestions(hits);
        setShowSuggestions(hits.length > 0);
      } catch (error) {
        console.error("Error Algolia:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(getSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedCustomerDoc]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const validSales = sales.filter((s) => s.status === "COMPLETED");
  const totalRevenue = validSales.reduce(
    (sum, s) => sum + (s.totalAmount || 0),
    0,
  );
  const totalProfit = validSales.reduce(
    (sum, s) => sum + (s.totalProfit || 0),
    0,
  );
  const totalWeight = validSales.reduce(
    (sum, s) => sum + ((s as any).totalWeight || 0),
    0,
  );

  const handleApprove = async (sale: Sale) => {
    if (
      !confirm(
        `¿Deseas aprobar la cotización de ${sale.customerName}? Se descontará el stock de inmediato.`,
      )
    )
      return;
    setIsProcessing(true);
    try {
      await approveQuotation(sale.id!);
      toast.success(
        "✅ ¡Cotización aprobada! Ahora es una Venta y el stock ha sido actualizado.",
      );
    } catch (error: any) {
      toast.error(`❌ Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectCustomer = (docNumber: string, customerName: string) => {
    setSelectedCustomerDoc(docNumber);
    setSearchTerm(customerName);
    setShowSuggestions(false);
    setLimitCount(30);
    updateUrlParams(docNumber);
  };

  const handleClearSearch = () => {
    setSelectedCustomerDoc(null);
    setSearchTerm("");
    setLimitCount(30);
    updateUrlParams(null);
  };

  const exportSalesToExcel = () => {
    const headers = [
      "Documento",
      "Fecha",
      "Cliente",
      "RUC/DNI",
      "Estado",
      "Total (S/)",
      "Ganancia Neta (S/)",
    ];
    const rows = sales.map((s) => [
      s.id,
      s.timestamp?.toDate ? s.timestamp.toDate().toLocaleDateString() : "",
      s.customerName,
      s.documentNumber || "",
      s.status,
      s.totalAmount?.toFixed(2) || "0.00",
      s.totalProfit?.toFixed(2) || "0.00",
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `Reporte_Ventas_${new Date().toLocaleDateString()}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-10 relative">
      {/* CABECERA LIMPIA Y PROFESIONAL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-gray-800 tracking-tight">
            <ShoppingBag className="text-blue-600" /> Registro Comercial
          </h1>
          <p className="text-gray-500 text-sm font-medium mt-1">
            Historial de operaciones, facturación y despachos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <HeaderOptions
            onExport={exportSalesToExcel}
            onOpenExcel={() => setShowExcelModal(true)}
          />

          <Link
            href="/admin/sales/new"
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition active:scale-95 shadow-md shadow-blue-200 font-black flex-1 md:flex-none"
          >
            <Plus size={20} /> Nueva Operación
          </Link>
        </div>
      </div>

      <SalesMetrics
        totalRevenue={totalRevenue}
        totalProfit={totalProfit}
        totalWeight={totalWeight}
      />

      <SalesFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        isSearching={isSearching}
        showSuggestions={showSuggestions}
        setShowSuggestions={setShowSuggestions}
        suggestions={suggestions}
        selectedCustomerDoc={selectedCustomerDoc}
        searchInputRef={searchInputRef}
        setLimitCount={setLimitCount}
        onSelectSuggestion={handleSelectCustomer}
        onClearSearch={handleClearSearch}
      />

      <SalesTable
        displaySales={sales}
        isLoading={isLoading}
        role={role}
        isProcessing={isProcessing}
        onPrint={setSaleToPrint}
        onDuplicate={(id) => router.push(`/admin/sales/new?duplicateId=${id}`)}
        onApprove={handleApprove}
        onViewDetails={setViewingSale}
      />

      {sales.length >= limitCount && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setLimitCount((prev) => prev + 30)}
            className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:border-blue-500 hover:text-blue-600 transition shadow-sm active:scale-95"
          >
            Cargar 30 anteriores <ChevronDown size={20} />
          </button>
        </div>
      )}

      {/* --- MODALES --- */}

      {viewingSale && (
        <SaleDetailsModal
          sale={viewingSale}
          onClose={() => setViewingSale(null)}
        />
      )}

      {showExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl relative my-8 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowExcelModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 z-10 bg-white rounded-full p-1 shadow-sm border border-gray-100 transition"
            >
              <X size={20} />
            </button>
            <div className="p-6">
              <BulkUploadSales />
            </div>
          </div>
        </div>
      )}

      {/* --- TICKET OCULTO PARA IMPRESIÓN --- */}
      <div className="hidden">
        <div ref={printRef}>
          {saleToPrint && <PrintableTicket sale={saleToPrint} />}
        </div>
      </div>
    </div>
  );
}
