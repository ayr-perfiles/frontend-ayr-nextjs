"use client";

import React, { useState, useEffect } from 'react';
import { CutOrder } from "@/types";
import { X, Scissors, Save, Loader2, Receipt } from "lucide-react";
import { receiveStrips } from "../services/cutOrderService";
import { getCatalog } from "@/modules/drywall/services/catalogService";
import toast from 'react-hot-toast';

interface ReceiveStripsModalProps {
  order: CutOrder;
  userEmail: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReceiveStripsModal({ order, userEmail, onClose, onSuccess }: ReceiveStripsModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);

  useEffect(() => {
    const fetchCatalog = async () => {
      const data = await getCatalog();
      setCatalog(data.filter(p => p.isActive));
    };
    fetchCatalog();
  }, []);
  
  const [invoice, setInvoice] = useState({
    number: '',
    date: new Date().toISOString().split('T')[0],
    currency: 'USD' as 'USD' | 'PEN',
    exchangeRate: 3.80,
    gravada: 0,
    igv: 0,
    total: 0
  });

  // Pre-poblar strips recibidos basados en el plan enviado
  const [receivedStrips, setReceivedStrips] = useState<{ coilId: string; widthMm: number; count: number; weight: number }[]>(
    order.coils.flatMap(c => c.cutPlan.map(p => ({
      coilId: c.coilId,
      widthMm: p.widthMm,
      count: p.count,
      weight: 0 // El peso se ingresa al recibir
    })))
  );

  const handleUpdateStrip = (index: number, field: 'count' | 'weight', value: number) => {
    setReceivedStrips(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const handleUpdateInvoice = (field: string, value: any) => {
    setInvoice(prev => {
      const newInvoice = { ...prev, [field]: value };
      if (field === 'gravada' || field === 'igv') {
        newInvoice.total = Number(newInvoice.gravada) + Number(newInvoice.igv);
      }
      return newInvoice;
    });
  };

  const handleSubmit = async () => {
    if (!invoice.number) {
      toast.error("El número de factura es obligatorio.");
      return;
    }

    const receivedWeightTotal = receivedStrips.reduce((sum, s) => sum + s.weight, 0);
    if (receivedWeightTotal === 0) {
      toast.error("Debes ingresar el peso recibido.");
      return;
    }

    setIsSubmitting(true);
    try {
      await receiveStrips({
        cutOrderId: order.id!,
        invoice: {
          ...invoice,
          gravada: Number(invoice.gravada),
          igv: Number(invoice.igv),
          total: Number(invoice.total),
          exchangeRate: Number(invoice.exchangeRate)
        },
        receivedStrips,
        receivedWeightTotal,
        userEmail
      });
      toast.success("Flejes recibidos y stock actualizado.");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Error al recibir flejes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <header className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-200">
              <Save size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Registrar Recepción de Flejes</h2>
              <p className="text-sm text-slate-500 font-bold italic">Orden #{order.id?.slice(-6)} - {order.tercero.nombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-400">
            <X size={24} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* COLUMNA FACTURA */}
            <div className="lg:col-span-1 space-y-6">
               <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                 <Receipt size={16} /> 1. Datos de Facturación
               </h3>
               
               <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">N° Factura</label>
                    <input 
                      type="text" 
                      value={invoice.number}
                      onChange={e => handleUpdateInvoice('number', e.target.value)}
                      placeholder="F001-..."
                      className="w-full bg-white border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Moneda</label>
                      <select 
                        value={invoice.currency}
                        onChange={e => handleUpdateInvoice('currency', e.target.value)}
                        className="w-full bg-white border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                      >
                        <option value="USD">USD</option>
                        <option value="PEN">PEN</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">T. Cambio</label>
                      <input 
                        type="number" 
                        value={invoice.exchangeRate}
                        onChange={e => handleUpdateInvoice('exchangeRate', e.target.value)}
                        className="w-full bg-white border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="h-px bg-slate-200 my-2" />

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Gravada ({invoice.currency})</label>
                    <input 
                      type="number" 
                      value={invoice.gravada}
                      onChange={e => handleUpdateInvoice('gravada', e.target.value)}
                      className="w-full bg-white border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">IGV ({invoice.currency})</label>
                    <input 
                      type="number" 
                      value={invoice.igv}
                      onChange={e => handleUpdateInvoice('igv', e.target.value)}
                      className="w-full bg-white border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div className="pt-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase ml-2">Total {invoice.currency}</p>
                    <p className="text-2xl font-black text-slate-900 ml-2">{invoice.total.toFixed(2)}</p>
                    <p className="text-[10px] font-bold text-blue-600 uppercase italic ml-2">
                      Costo Servicio: S/ {(invoice.gravada * invoice.exchangeRate).toFixed(2)} PEN (sin IGV)
                    </p>
                  </div>
               </div>
            </div>

            {/* COLUMNA FLEJES */}
            <div className="lg:col-span-2 space-y-6">
               <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                 <Scissors size={16} /> 2. Flejes Recibidos (Detalle por Bobina)
               </h3>

               <div className="space-y-4">
                  {order.coils.map(coilInfo => (
                    <div key={coilInfo.coilId} className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                       <header className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200/50">
                          <div className="flex items-center gap-3">
                             <div className="px-3 py-1 bg-white rounded-lg border border-slate-200 text-[10px] font-black text-slate-400 uppercase">
                               {coilInfo.coilId.slice(-6)}
                             </div>
                             <p className="text-sm font-black text-slate-700">Enviado: {coilInfo.sentWeight} kg</p>
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso Recibido</p>
                             <p className="text-sm font-black text-green-600">
                               {receivedStrips.filter(s => s.coilId === coilInfo.coilId).reduce((sum, s) => sum + s.weight, 0).toFixed(2)} kg
                             </p>
                          </div>
                       </header>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {receivedStrips.filter(s => s.coilId === coilInfo.coilId).map((strip, idx) => {
                             const originalIndex = receivedStrips.findIndex(s => s === strip);
                             const mappedProduct = catalog.find(p => p.stripWidth === strip.widthMm);
                             return (
                               <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 font-black text-xs">
                                      {strip.widthMm}
                                    </div>
                                    <div className="flex-1">
                                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mapeo SKU</p>
                                       <p className="text-xs font-bold text-slate-700">
                                         {mappedProduct ? `${mappedProduct.sku} - ${mappedProduct.name}` : 'SIN ASIGNAR'}
                                       </p>
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-3">
                                     <div className="space-y-1">
                                        <label className="text-[8px] font-black text-slate-300 uppercase block">Cant.</label>
                                        <input 
                                          type="number" 
                                          value={strip.count}
                                          onChange={e => handleUpdateStrip(originalIndex, 'count', Number(e.target.value))}
                                          className="w-full border-none p-0 text-sm font-black text-slate-700 focus:ring-0"
                                        />
                                     </div>
                                     <div className="space-y-1">
                                        <label className="text-[8px] font-black text-slate-300 uppercase block">Peso (kg)</label>
                                        <input 
                                          type="number" 
                                          value={strip.weight}
                                          onChange={e => handleUpdateStrip(originalIndex, 'weight', Number(e.target.value))}
                                          className="w-full border-none p-0 text-sm font-black text-slate-700 focus:ring-0"
                                        />
                                     </div>
                                  </div>
                               </div>
                             );
                          })}
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>

        <footer className="p-8 border-t border-slate-50 bg-slate-50/50 flex justify-between items-center">
          <div className="flex gap-8">
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso Total Enviado</p>
                <p className="text-lg font-black text-slate-600">{order.sentWeightTotal.toFixed(2)} kg</p>
             </div>
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso Total Recibido</p>
                <p className="text-lg font-black text-green-600">{receivedStrips.reduce((sum, s) => sum + s.weight, 0).toFixed(2)} kg</p>
             </div>
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Merma Refilado</p>
                <p className="text-lg font-black text-red-500">{(order.sentWeightTotal - receivedStrips.reduce((sum, s) => sum + s.weight, 0)).toFixed(2)} kg</p>
             </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-8 py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-10 py-4 bg-green-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-green-700 transition shadow-xl shadow-green-200 flex items-center gap-3 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Registrar Recepción
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
