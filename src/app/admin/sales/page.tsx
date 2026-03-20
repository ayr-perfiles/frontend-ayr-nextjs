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
  doc,
} from "firebase/firestore";
import { Sale } from "@/types";
import { approveQuotation } from "@/services/salesService";
import { PrintableTicket } from "@/components/sales/PrintableTicket";
import {
  ShoppingBag,
  Plus,
  FileText,
  CheckCircle2,
  TrendingUp,
  FileDown,
  AlertCircle,
  Clock,
  Search,
  Filter,
  ChevronDown,
  DollarSign,
  Copy,
  Loader2,
  X,
} from "lucide-react";

export default function SalesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialSaleId = searchParams.get("saleId");

  // --- ESTADOS BASE (FIREBASE) ---
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [limitCount, setLimitCount] = useState(30);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // --- ESTADOS DE BÚSQUEDA (SELECTOR ALGOLIA -> FIREBASE) ---
  const [searchTerm, setSearchTerm] = useState(initialSaleId || "");
  const [suggestions, setSuggestions] = useState<Sale[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Guardamos el ID seleccionado y el documento en tiempo real de Firebase
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(
    initialSaleId,
  );
  const [searchedSaleData, setSearchedSaleData] = useState<Sale | null>(null);

  const searchInputRef = useRef<HTMLDivElement>(null);

  // --- LÓGICA DE IMPRESIÓN ---
  const [saleToPrint, setSaleToPrint] = useState<Sale | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `AYR_STEEL_${saleToPrint?.id?.slice(-5)}`,
  });

  useEffect(() => {
    if (saleToPrint) {
      handlePrint();
      const timer = setTimeout(() => setSaleToPrint(null), 500);
      return () => clearTimeout(timer);
    }
  }, [saleToPrint, handlePrint]);

  // --- ACTUALIZADOR DE URL ---
  const updateUrlParams = (newSaleId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newSaleId) {
      params.set("saleId", newSaleId);
    } else {
      params.delete("saleId");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // 1. CARGA INICIAL DESDE FIREBASE (Paginada - Lista General)
  useEffect(() => {
    let q = query(
      collection(db, "sales"),
      orderBy("timestamp", "desc"),
      limit(limitCount),
    );

    if (statusFilter !== "ALL") {
      q = query(
        collection(db, "sales"),
        where("status", "==", statusFilter),
        orderBy("timestamp", "desc"),
        limit(limitCount),
      );
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const salesData = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Sale[];
      setSales(salesData);
      setIsLoading(false);
    });
    return () => unsub();
  }, [limitCount, statusFilter]);

  // 2. ESCUCHADOR ESPECÍFICO (Cuando se selecciona una venta del buscador o de la URL)
  useEffect(() => {
    if (!selectedSaleId) {
      setSearchedSaleData(null);
      return;
    }

    const unsub = onSnapshot(doc(db, "sales", selectedSaleId), (docSnap) => {
      if (docSnap.exists()) {
        setSearchedSaleData({ id: docSnap.id, ...docSnap.data() } as Sale);
      } else {
        setSearchedSaleData(null);
      }
    });

    return () => unsub();
  }, [selectedSaleId]);

  // 3. BUSCADOR PREDICTIVO (Algolia solo para Sugerencias)
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (selectedSaleId && searchTerm === selectedSaleId) {
      return;
    }

    const getSuggestions = async () => {
      setIsSearching(true);
      try {
        const filters = statusFilter !== "ALL" ? `status:${statusFilter}` : "";

        const { hits } = await algoliaClient.searchSingleIndex({
          indexName: ALGOLIA_INDICES.SALES,
          searchParams: {
            query: searchTerm,
            filters: filters,
            hitsPerPage: 5,
          },
        });

        const mappedHits = hits.map((hit: any) => ({
          ...hit,
          id: hit.objectID,
        })) as Sale[];

        setSuggestions(mappedHits);
        setShowSuggestions(mappedHits.length > 0);
      } catch (error) {
        console.error("Error buscando sugerencias:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(getSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, statusFilter, selectedSaleId]);

  // Manejar clics fuera del buscador para cerrar las sugerencias
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

  // 4. DECISOR DE VISTA: Si hay un ID seleccionado mostramos solo esa venta
  const displaySales = selectedSaleId
    ? searchedSaleData
      ? [searchedSaleData]
      : []
    : sales.filter((s) => {
        const searchLower = searchTerm.toLowerCase();
        return (
          s.customerName?.toLowerCase().includes(searchLower) ||
          (s.id && s.id.toLowerCase().includes(searchLower)) ||
          (s.documentNumber && s.documentNumber.includes(searchLower))
        );
      });

  // --- KPIs FINANCIEROS ---
  const validSales = displaySales.filter((s) => s.status === "COMPLETED");
  const totalRevenue = validSales.reduce(
    (sum, s) => sum + (s.totalAmount || 0),
    0,
  );
  const totalProfit = validSales.reduce(
    (sum, s) => sum + (s.totalProfit || 0),
    0,
  );

  // --- LÓGICA DE APROBACIÓN ---
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
      alert(
        "✅ ¡Cotización aprobada! Ahora es una Venta y el stock ha sido actualizado.",
      );
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-gray-800 tracking-tight">
            <ShoppingBag className="text-blue-600" /> Registro Comercial
          </h1>
          <p className="text-gray-500 text-sm font-medium mt-1">
            Historial de operaciones y ganancias netas.
          </p>
        </div>
        <Link
          href="/admin/sales/new"
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-blue-700 transition shadow-lg shadow-blue-200 active:scale-95"
        >
          <Plus size={18} /> Nueva Operación
        </Link>
      </div>

      {/* MÉTRICAS FINANCIERAS (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 text-white p-6 rounded-3xl shadow-sm border border-gray-800 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 bg-white/5 w-24 h-24 rounded-full"></div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1 relative z-10">
            <DollarSign size={14} /> Ingresos (Ventas en vista)
          </p>
          <h3 className="text-4xl font-black tracking-tighter relative z-10">
            S/{" "}
            {totalRevenue.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
          </h3>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 bg-emerald-50 w-24 h-24 rounded-full"></div>
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1 relative z-10">
            <TrendingUp size={14} /> Ganancia Neta Pura
          </p>
          <h3 className="text-4xl font-black text-emerald-700 tracking-tighter relative z-10">
            S/{" "}
            {totalProfit.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
          </h3>
        </div>
      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA TIPO INVENTARIO */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border">
        {/* COMPONENTE DE BÚSQUEDA TIPO SELECTOR */}
        <div className="relative flex-1 flex gap-2" ref={searchInputRef}>
          <div className="relative w-full">
            {isSearching ? (
              <Loader2
                className="absolute left-3 top-2.5 text-blue-500 animate-spin"
                size={18}
              />
            ) : (
              <Search
                className="absolute left-3 top-2.5 text-gray-400"
                size={18}
              />
            )}
            <input
              type="text"
              placeholder="Buscar cliente, documento o folio..."
              className={`pl-10 w-full p-2 border rounded-lg outline-blue-500 font-medium transition ${selectedSaleId ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-white border-gray-200"}`}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value === "") {
                  setSelectedSaleId(null);
                  setSearchedSaleData(null);
                  updateUrlParams(null); // Actualizamos la URL
                }
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
            />

            {/* DROPDOWN DE SUGERENCIAS */}
            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    onClick={() => {
                      setSelectedSaleId(suggestion.id!);
                      setSearchTerm(suggestion.id!);
                      setShowSuggestions(false);
                      updateUrlParams(suggestion.id!); // Guardamos en la URL
                    }}
                    className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                  >
                    <p className="font-bold text-gray-800 text-sm truncate">
                      {suggestion.customerName}
                    </p>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-gray-500 font-medium">
                        {suggestion.id?.slice(-8)} •{" "}
                        {suggestion.documentNumber || "S/D"}
                      </p>
                      <span className="text-xs font-black text-blue-600">
                        S/{" "}
                        {suggestion.totalAmount?.toLocaleString("es-PE", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botón para limpiar búsqueda (Aparece solo si hay un ID seleccionado) */}
          {selectedSaleId && (
            <button
              onClick={() => {
                setSelectedSaleId(null);
                setSearchTerm("");
                setSearchedSaleData(null);
                updateUrlParams(null); // Limpiamos la URL
              }}
              className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition"
              title="Limpiar búsqueda"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="text-gray-400" size={18} />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setLimitCount(30);
            }}
            className="p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 font-medium text-gray-700 bg-gray-50"
          >
            <option value="ALL">Todos los Documentos</option>
            <option value="COMPLETED">Solo Ventas</option>
            <option value="QUOTATION">Solo Cotizaciones</option>
          </select>
        </div>
      </div>

      {/* TABLA DE HISTORIAL */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-237.5">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="p-4 pl-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Documento
                </th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Cliente
                </th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Estado
                </th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                  Total
                </th>
                <th className="p-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right">
                  Ganancia
                </th>
                <th className="p-4 pr-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displaySales.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-400">
                    <AlertCircle
                      className="mx-auto mb-3 text-gray-300"
                      size={48}
                    />
                    <p className="font-bold">
                      No se encontraron operaciones con estos filtros.
                    </p>
                  </td>
                </tr>
              ) : (
                displaySales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="hover:bg-blue-50/30 transition group"
                  >
                    {/* COL 1: FECHA Y ID */}
                    <td className="p-4 pl-6">
                      <p className="text-xs font-black text-gray-800 uppercase tracking-widest mb-1">
                        {sale.id?.slice(-8)}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400">
                        {sale.timestamp?.toDate
                          ? sale.timestamp.toDate().toLocaleString("es-PE", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Reciente"}
                      </p>
                    </td>

                    {/* COL 2: CLIENTE */}
                    <td className="p-4">
                      <p className="font-black text-gray-800 uppercase leading-none mb-1 text-sm">
                        {sale.customerName}
                      </p>
                      <p className="text-xs font-bold text-gray-400">
                        {sale.documentNumber || "---"}
                      </p>
                    </td>

                    {/* COL 3: ESTADO */}
                    <td className="p-4">
                      {sale.status === "COMPLETED" ? (
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-[10px] font-black border border-green-200 uppercase tracking-widest">
                          <CheckCircle2 size={12} /> Venta Cerrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg text-[10px] font-black border border-orange-200 uppercase tracking-widest">
                          <FileText size={12} /> Cotización
                        </span>
                      )}
                    </td>

                    {/* COL 4: TOTAL */}
                    <td className="p-4 text-right">
                      <p className="font-black text-gray-900 text-lg">
                        S/{" "}
                        {sale.totalAmount?.toLocaleString("es-PE", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </td>

                    {/* COL 5: GANANCIA (MARGEN) */}
                    <td className="p-4 text-right">
                      {sale.status === "COMPLETED" ? (
                        <span
                          className={`inline-flex items-center gap-1 font-mono font-bold px-3 py-1 rounded-lg border text-sm ${(sale.totalProfit || 0) < 0 ? "bg-red-50 text-red-600 border-red-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"}`}
                        >
                          <TrendingUp size={14} /> S/{" "}
                          {(sale.totalProfit || 0).toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          En espera
                        </span>
                      )}
                    </td>

                    {/* COL 6: ACCIONES */}
                    <td className="p-4 pr-6">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSaleToPrint(sale)}
                          className="p-2 bg-gray-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition active:scale-95 shadow-sm"
                          title="Imprimir PDF / Ticket"
                        >
                          <FileDown size={20} />
                        </button>

                        <button
                          onClick={() =>
                            router.push(
                              `/admin/sales/new?duplicateId=${sale.id}`,
                            )
                          }
                          className="p-2 bg-gray-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition shadow-sm active:scale-95"
                          title="Duplicar Operación"
                        >
                          <Copy size={20} />
                        </button>

                        {sale.status === "QUOTATION" ? (
                          <button
                            onClick={() => handleApprove(sale)}
                            disabled={isProcessing}
                            className="bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-black transition flex items-center gap-2 disabled:opacity-50 active:scale-95 shadow-sm"
                          >
                            <CheckCircle2 size={14} /> APROBAR
                          </button>
                        ) : (
                          <span className="px-4 py-2 text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1">
                            <Clock size={12} /> Despachado
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BOTÓN CARGAR MÁS (Aparece solo si no hay búsqueda activa) */}
      {!selectedSaleId && sales.length >= limitCount && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setLimitCount((prev) => prev + 30)}
            className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:border-blue-500 hover:text-blue-600 transition shadow-sm active:scale-95"
          >
            Cargar 30 anteriores <ChevronDown size={20} />
          </button>
        </div>
      )}

      {/* CONTENEDOR OCULTO PARA IMPRESIÓN */}
      <div className="hidden">
        <div ref={printRef}>
          {saleToPrint && <PrintableTicket sale={saleToPrint} />}
        </div>
      </div>
    </div>
  );
}
