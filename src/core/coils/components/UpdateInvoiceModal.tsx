"use client";

import React, { useState } from 'react';
import { CutOrder } from "@/types";
import { X, Receipt, Save, Loader2 } from "lucide-react";
import { updateCutOrderInvoice } from "../services/cutOrderService";
import toast from 'react-hot-toast';

interface UpdateInvoiceModalProps {
  order: CutOrder;
  userEmail: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UpdateInvoiceModal({ order, userEmail, onClose, onSuccess }: UpdateInvoiceModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [invoice, setInvoice] = useState({
    number: order.invoice?.number || '',
    date: order.invoice?.date?.toDate ? order.invoice.date.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    currency: order.invoice?.currency || 'USD' as 'USD' | 'PEN',
    exchangeRate: order.invoice?.exchangeRate || 3.80,
    gravada: order.invoice?.gravada || 0,
    igv: order.invoice?.igv || 0,
    total: order.invoice?.total || 0
  });

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

    setIsSubmitting(true);
    try {
      await updateCutOrderInvoice({
        cutOrderId: order.id!,
        invoice: {
          ...invoice,
          gravada: Number(invoice.gravada),
          igv: Number(invoice.igv),
          total: Number(invoice.total),
          exchangeRate: Number(invoice.exchangeRate)
        },
        userEmail
      });
      toast.success("Factura actualizada y costos ajustados.");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar factura.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <header className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Receipt size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Ajustar Factura de Servicio</h2>
              <p className="text-sm text-slate-500 font-bold italic">Orden #{order.id?.slice(-6)} - {order.tercero.nombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-400">
            <X size={24} />
          </button>
        </header>

        <div className="p-8 space-y-6">
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

                <div className="grid grid-cols-2 gap-3">
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
                </div>

                <div className="pt-2">
                <p className="text-[10px] font-black text-slate-400 uppercase ml-2">Nuevo Total PEN (Costo Servicio)</p>
                <p className="text-2xl font-black text-blue-600 ml-2">S/ {(invoice.gravada * invoice.exchangeRate).toFixed(2)}</p>
                </div>
            </div>
            
            <p className="text-[10px] text-slate-400 font-bold italic leading-tight px-2">
                * El cambio recalculará el costo de los flejes que aún permanezcan en el inventario. 
                Los productos ya fabricados mantendrán su costo histórico.
            </p>
        </div>

        <footer className="p-8 border-t border-slate-50 bg-slate-50/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-8 py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-10 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-xl shadow-slate-200 flex items-center gap-3 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Guardar Cambios
          </button>
        </footer>
      </div>
    </div>
  );
}
