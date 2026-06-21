"use client";

import React, { useState } from 'react';
import { CutOrder } from "@/types";
import { X, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { voidCutOrder } from "../services/cutOrderService";
import toast from 'react-hot-toast';

interface VoidOrderModalProps {
  order: CutOrder;
  userEmail: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function VoidOrderModal({ order, userEmail, onClose, onSuccess }: VoidOrderModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("El motivo de anulación es obligatorio.");
      return;
    }

    setIsSubmitting(true);
    try {
      await voidCutOrder(order.id!, reason, userEmail);
      toast.success("Orden anulada correctamente.");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Error al anular la orden.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReceived = order.status === 'RECIBIDO';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
        <header className="p-6 border-b border-slate-50 flex justify-between items-center bg-red-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shadow-sm">
              <AlertTriangle size={20} />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Anular Orden</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-400">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
            <p className="text-sm font-bold text-red-800 leading-relaxed">
              ¿Estás seguro de anular la orden <span className="font-black">#{order.id?.slice(-6)}</span> de <span className="font-black">{order.tercero.nombre}</span>?
            </p>
            {isReceived && (
              <p className="text-xs font-medium text-red-600 mt-2 italic">
                * Se revertirá el stock de flejes y las bobinas volverán a estar disponibles.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Motivo de Anulación</label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Error en pesos, duplicado, etc..."
              className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-red-500 transition-all min-h-[100px] resize-none shadow-inner"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="flex-[2] py-4 bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition shadow-xl shadow-red-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Confirmar Anulación
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
