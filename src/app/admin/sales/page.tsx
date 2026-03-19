"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useReactToPrint } from "react-to-print";
import { db } from "@/lib/firebase/clientApp";
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
} from "lucide-react";

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- FILTROS Y PAGINACIÓN ---
  const [limitCount, setLimitCount] = useState(30);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL"); // ALL, COMPLETED, QUOTATION

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

  // --- OBTENCIÓN DE DATOS (FIREBASE) ---
  useEffect(() => {
    let q = query(
      collection(db, "sales"),
      orderBy("timestamp", "desc"),
      limit(limitCount),
    );

    // Filtro de servidor para ahorrar lecturas
    if (statusFilter !== "ALL") {
      q = query(
        collection(db, "sales"),
        where("status", "==", statusFilter),
        orderBy("timestamp", "desc"),
        limit(limitCount),
      );
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const salesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Sale[];
      setSales(salesData);
      setIsLoading(false);
    });
    return () => unsub();
  }, [limitCount, statusFilter]);

  // --- FILTRO LOCAL POR CLIENTE O ID ---
  const filteredSales = sales.filter((s) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      s.customerName.toLowerCase().includes(searchLower) ||
      (s.id && s.id.toLowerCase().includes(searchLower)) ||
      (s.documentNumber && s.documentNumber.includes(searchLower))
    );
  });

  // --- KPIs FINANCIEROS (Solo cuenta Ventas Completadas, ignora Cotizaciones) ---
  const validSales = filteredSales.filter((s) => s.status === "COMPLETED");
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

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Buscar por cliente, DNI, RUC o código..."
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="text-gray-400" size={18} />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setLimitCount(30); // Resetear paginación al cambiar filtro
            }}
            className="py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">Todos los Documentos</option>
            <option value="COMPLETED">Solo Ventas (Completadas)</option>
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
              {filteredSales.length === 0 && !isLoading ? (
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
                filteredSales.map((sale) => (
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
                        {sale.totalAmount.toLocaleString("es-PE", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </td>

                    {/* COL 5: GANANCIA (MARGEN) */}
                    <td className="p-4 text-right">
                      {sale.status === "COMPLETED" ? (
                        <span
                          className={`inline-flex items-center gap-1 font-mono font-bold px-3 py-1 rounded-lg border text-sm ${sale.totalProfit < 0 ? "bg-red-50 text-red-600 border-red-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"}`}
                        >
                          <TrendingUp size={14} /> S/{" "}
                          {sale.totalProfit.toLocaleString("es-PE", {
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
                        {/* PDF */}
                        <button
                          onClick={() => setSaleToPrint(sale)}
                          className="p-2 bg-gray-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition active:scale-95 shadow-sm"
                          title="Imprimir PDF / Ticket"
                        >
                          <FileDown size={20} />
                        </button>

                        {/* APROBAR (Cotizaciones) */}
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

      {/* BOTÓN CARGAR MÁS (PAGINACIÓN) */}
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

      {/* CONTENEDOR OCULTO PARA IMPRESIÓN (ReactToPrint) */}
      <div className="hidden">
        <div ref={printRef}>
          {saleToPrint && <PrintableTicket sale={saleToPrint} />}
        </div>
      </div>
    </div>
  );
}
