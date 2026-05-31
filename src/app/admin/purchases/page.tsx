"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  where,
} from "firebase/firestore";
import { Truck, Plus, Search, Eye, AlertCircle, FileText, Ban } from "lucide-react";
import type { Purchase } from "@/core/purchases/types";
import { voidPurchase } from "@/core/purchases/service";
import toast from "react-hot-toast";

export default function PurchasesPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "purchases"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      setPurchases(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Purchase));
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const handleVoid = async (id: string, invoiceNum: string) => {
    const reason = prompt(`¿Motivo de anulación para la factura ${invoiceNum}?`);
    if (!reason) return;

    try {
      await voidPurchase(id, reason);
      toast.success("Compra anulada correctamente.");
    } catch (error: any) {
      toast.error(error.message || "Error al anular compra.");
    }
  };

  const filtered = purchases.filter(p => 
    p.supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.invoice.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.supplier.ruc.includes(searchTerm)
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-slate-800">
            <Truck className="text-blue-600" /> Registro de Compras
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            Entrada de mercadería y fijación de costos (PPP)
          </p>
        </div>
        <button
          onClick={() => router.push("/admin/purchases/new")}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition active:scale-95"
        >
          <Plus size={20} /> Nueva Compra
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por proveedor o factura..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha / Nº</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Proveedor</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Línea</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total PEN</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Estado</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
               <tr><td colSpan={6} className="p-12 text-center text-slate-400">Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 text-slate-400 mb-2">
                    <FileText size={24} />
                  </div>
                  <p className="text-slate-500 font-medium">No se encontraron compras registradas.</p>
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition group">
                  <td className="p-4">
                    <p className="font-bold text-slate-700 text-sm">{p.invoice.number}</p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {p.invoice.date.toDate().toLocaleDateString()}
                    </p>
                  </td>
                  <td className="p-4">
                    <p className="font-bold text-slate-800 text-sm">{p.supplier.name}</p>
                    <p className="text-xs text-slate-500 font-medium">RUC {p.supplier.ruc}</p>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      p.businessLine === 'roofing' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {p.businessLine}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <p className="font-black text-slate-700 text-sm">S/ {p.totalCostPEN.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    {p.invoice.currency === 'USD' && (
                      <p className="text-[10px] text-slate-400 font-bold">
                        $ {(p.totalCostPEN / p.invoice.exchangeRate).toFixed(2)} @ {p.invoice.exchangeRate}
                      </p>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                      p.status === 'REGISTRADA' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      {p.status === 'REGISTRADA' && (
                        <button
                          onClick={() => handleVoid(p.id!, p.invoice.number)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Anular Compra"
                        >
                          <Ban size={18} />
                        </button>
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
  );
}
