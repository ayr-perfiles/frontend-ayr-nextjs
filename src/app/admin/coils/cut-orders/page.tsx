"use client";

import React, { useState, useEffect } from 'react';
import { db } from "@/lib/firebase/clientApp";
import { collection, query, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import { CutOrder, Coil } from "@/types";
import { Loader2, Scissors, Plus, Calendar, User, ExternalLink, Layers, Receipt, Trash2, Edit2, AlertCircle } from "lucide-react";
import Link from "next/link";

import ReceiveStripsModal from "@/core/coils/components/ReceiveStripsModal";
import UpdateInvoiceModal from "@/core/coils/components/UpdateInvoiceModal";
import VoidOrderModal from "@/core/coils/components/VoidOrderModal";
import SendToCutModal from "@/core/coils/components/SendToCutModal";
import { useAuth } from "@/context/AuthContext";
import toast from 'react-hot-toast';

export default function CutOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CutOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals state
  const [selectedOrder, setSelectedOrder] = useState<CutOrder | null>(null);
  const [updatingInvoiceOrder, setUpdatingInvoiceOrder] = useState<CutOrder | null>(null);
  const [voidingOrder, setVoidingOrder] = useState<CutOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<{ order: CutOrder; coils: Coil[] } | null>(null);
  const [isFetchingCoils, setIsFetchingCoils] = useState(false);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "cut_orders"), orderBy("sentAt", "desc"));
      const snap = await getDocs(q);
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as CutOrder)));
    } catch (err) {
      console.error("Error fetching cut orders:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleOpenEdit = async (order: CutOrder) => {
    setIsFetchingCoils(true);
    try {
      const coilRefs = order.coils.map(c => doc(db, "coils", c.coilId));
      const snaps = await Promise.all(coilRefs.map(ref => getDoc(ref)));
      const fullCoils = snaps.map(s => ({ id: s.id, ...s.data() } as Coil));
      setEditingOrder({ order, coils: fullCoils });
    } catch (err) {
      toast.error("Error al cargar datos de las bobinas.");
    } finally {
      setIsFetchingCoils(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Scissors className="text-blue-600" /> Órdenes de Corte (Tercerizado)
          </h1>
          <p className="text-sm text-slate-500 font-medium italic">Gestión de bobinas enviadas a slitter externo para Drywall.</p>
        </div>
        <div className="flex gap-3">
          {isFetchingCoils && (
             <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
               <Loader2 size={14} className="animate-spin" /> Cargando Datos...
             </div>
          )}
          <Link 
            href="/admin/coils"
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-black flex items-center gap-2 hover:bg-blue-700 transition shadow-lg shadow-blue-200 uppercase tracking-tighter"
          >
            <Plus size={18} /> Nueva Orden
          </Link>
        </div>
      </header>
      
      {/* MODAL RECEPCIÓN */}
      {selectedOrder && (
        <ReceiveStripsModal 
          order={selectedOrder}
          userEmail={user?.email || 'admin@ayrsteel.com'}
          onClose={() => setSelectedOrder(null)}
          onSuccess={() => {
            setSelectedOrder(null);
            fetchOrders();
          }}
        />
      )}

      {/* MODAL AJUSTE FACTURA */}
      {updatingInvoiceOrder && (
        <UpdateInvoiceModal 
          order={updatingInvoiceOrder}
          userEmail={user?.email || 'admin@ayrsteel.com'}
          onClose={() => setUpdatingInvoiceOrder(null)}
          onSuccess={() => {
            setUpdatingInvoiceOrder(null);
            fetchOrders();
          }}
        />
      )}

      {/* MODAL ANULACIÓN */}
      {voidingOrder && (
        <VoidOrderModal 
          order={voidingOrder}
          userEmail={user?.email || 'admin@ayrsteel.com'}
          onClose={() => setVoidingOrder(null)}
          onSuccess={() => {
            setVoidingOrder(null);
            fetchOrders();
          }}
        />
      )}

      {/* MODAL EDICIÓN */}
      {editingOrder && (
        <SendToCutModal 
          initialOrder={editingOrder.order}
          coils={editingOrder.coils}
          userEmail={user?.email || 'admin@ayrsteel.com'}
          onClose={() => setEditingOrder(null)}
          onSuccess={() => {
            setEditingOrder(null);
            fetchOrders();
          }}
        />
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando órdenes...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] py-20 text-center">
          <Scissors size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-400 font-bold italic text-lg">No hay órdenes de corte registradas.</p>
          <p className="text-slate-400 text-sm mt-2">Envía bobinas a corte desde el inventario de bobinas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map(order => (
            <div key={order.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition group relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    order.status === 'RECIBIDO' ? 'bg-green-100 text-green-700' : 
                    order.status === 'ANULADA' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {order.status}
                  </span>
                  <h3 className="text-lg font-black text-slate-800 mt-2 truncate w-48">{order.tercero.nombre}</h3>
                </div>
                <div className="flex gap-2">
                  {order.status === 'ENVIADO' && (
                    <button 
                      onClick={() => handleOpenEdit(order)}
                      className="p-2 bg-slate-50 rounded-xl hover:bg-blue-50 text-slate-400 hover:text-blue-500 transition"
                      title="Editar Orden"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                  {order.status !== 'ANULADA' && (
                    <button 
                      onClick={() => setVoidingOrder(order)}
                      className="p-2 bg-slate-50 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition"
                      title="Anular Orden"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-slate-500 text-sm font-bold">
                  <Calendar size={14} />
                  <span>{order.sentAt?.toDate().toLocaleDateString('es-PE')}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                  <User size={14} />
                  <span>{order.sentBy.split('@')[0]}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 text-sm font-black">
                  <Layers size={14} className="text-blue-400" />
                  <span>{order.coils.length} Bobinas ({order.sentWeightTotal.toLocaleString()}kg)</span>
                </div>
              </div>

              {order.status === 'ENVIADO' && (
                <button 
                  onClick={() => setSelectedOrder(order)}
                  className="w-full py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-lg shadow-slate-100"
                >
                  Registrar Recepción
                </button>
              )}

              {order.status === 'RECIBIDO' && (
                <div className="space-y-2">
                  <button 
                    onClick={() => setUpdatingInvoiceOrder(order)}
                    className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-2"
                  >
                    <Receipt size={14} />
                    {order.invoice?.number ? 'Ajustar Factura' : 'Cargar Factura'}
                  </button>
                  {order.receivedWeightTotal && (
                    <div className="px-4 py-2 bg-slate-50 rounded-xl flex justify-between items-center">
                       <span className="text-[10px] font-black text-slate-400 uppercase">Recibido:</span>
                       <span className="text-xs font-black text-green-600">{order.receivedWeightTotal.toLocaleString()} kg</span>
                    </div>
                  )}
                </div>
              )}

              {order.status === 'ANULADA' && (
                <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                   <div className="flex items-center gap-2 text-red-600 mb-1">
                      <AlertCircle size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Motivo de Anulación</span>
                   </div>
                   <p className="text-xs text-red-800 font-medium italic truncate">{order.voidReason || 'Sin motivo especificado'}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
