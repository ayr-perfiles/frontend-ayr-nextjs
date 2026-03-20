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
import { ShoppingBag, Plus, ChevronDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

import { SalesMetrics } from "@/components/sales/SalesMetrics";
import { SalesFilters } from "@/components/sales/SalesFilters";
import { SalesTable } from "@/components/sales/SalesTable";
import toast from "react-hot-toast";

export default function SalesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Ahora guardamos el documento del cliente en la URL, no el ID de una venta
  const initialCustomerDoc = searchParams.get("customerDoc");
  const { role } = useAuth();

  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [limitCount, setLimitCount] = useState(30);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Búsqueda de Clientes
  const [searchTerm, setSearchTerm] = useState(initialCustomerDoc || "");
  const [suggestions, setSuggestions] = useState<any[]>([]); // Clientes de Algolia
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [selectedCustomerDoc, setSelectedCustomerDoc] = useState<string | null>(
    initialCustomerDoc,
  );
  const searchInputRef = useRef<HTMLDivElement>(null);

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

  // 1. CONSULTA PRINCIPAL A FIREBASE (Aplica TODOS los filtros dinámicamente)
  useEffect(() => {
    let baseQuery = collection(db, "sales");
    let queryConstraints: any[] = [];

    // Filtro por Cliente
    if (selectedCustomerDoc) {
      queryConstraints.push(where("documentNumber", "==", selectedCustomerDoc));
    }
    // Filtro por Estado
    if (statusFilter !== "ALL") {
      queryConstraints.push(where("status", "==", statusFilter));
    }
    // Filtros de Fecha
    if (startDate) {
      queryConstraints.push(
        where("timestamp", ">=", new Date(startDate + "T00:00:00")),
      );
    }
    if (endDate) {
      queryConstraints.push(
        where("timestamp", "<=", new Date(endDate + "T23:59:59")),
      );
    }

    queryConstraints.push(orderBy("timestamp", "desc"), limit(limitCount));

    const q = query(baseQuery, ...queryConstraints);
    const unsub = onSnapshot(q, (snapshot) => {
      setSales(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Sale[]);
      setIsLoading(false);
    });
    return () => unsub();
  }, [limitCount, startDate, endDate, statusFilter, selectedCustomerDoc]);

  // 2. ALGOLIA SEARCH (Busca CLIENTES, no ventas)
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Evita buscar si lo que hay en el input es el RUC/DNI ya seleccionado
    if (selectedCustomerDoc && searchTerm === selectedCustomerDoc) return;
    if (selectedCustomerDoc && searchTerm !== selectedCustomerDoc) return; // Bloquea si hay cliente seleccionado pero tipean

    const getSuggestions = async () => {
      setIsSearching(true);
      try {
        const { hits } = await algoliaClient.searchSingleIndex({
          indexName: ALGOLIA_INDICES.CUSTOMERS, // <-- Apuntamos a clientes
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

  // Ocultar sugerencias clicando afuera
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

  // 3. CÁLCULOS FINANCIEROS (Se calculan sobre la data que devuelve Firebase)
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

  // 4. ACCIONES
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
    setSearchTerm(customerName); // Muestra el nombre en el input para mejor UX
    setShowSuggestions(false);
    setLimitCount(30); // Reiniciamos paginación
    updateUrlParams(docNumber);
  };

  const handleClearSearch = () => {
    setSelectedCustomerDoc(null);
    setSearchTerm("");
    setLimitCount(30);
    updateUrlParams(null);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-gray-800 tracking-tight">
            <ShoppingBag className="text-blue-600" /> Registro Comercial
          </h1>
          <p className="text-gray-500 text-sm font-medium mt-1">
            Historial de operaciones, facturación y despachos.
          </p>
        </div>
        <Link
          href="/admin/sales/new"
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-blue-700 transition shadow-lg shadow-blue-200 active:scale-95"
        >
          <Plus size={18} /> Nueva Operación
        </Link>
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
        displaySales={sales} // <-- Le pasamos directamente la data de Firebase
        isLoading={isLoading}
        role={role}
        isProcessing={isProcessing}
        onPrint={setSaleToPrint}
        onDuplicate={(id) => router.push(`/admin/sales/new?duplicateId=${id}`)}
        onApprove={handleApprove}
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

      <div className="hidden">
        <div ref={printRef}>
          {saleToPrint && <PrintableTicket sale={saleToPrint} />}
        </div>
      </div>
    </div>
  );
}
