"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { StripMovement } from "@/types";
import { X, History, ArrowDownLeft, ArrowUpRight, Clock, Hash, FileText } from "lucide-react";

interface MovementsModalProps {
  widthMm: number;
  onClose: () => void;
}

export function MovementsModal({ widthMm, onClose }: MovementsModalProps) {
  const [movements, setMovements] = useState<StripMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMovements = async () => {
      try {
        const moveRef = collection(db, "strips_movements");
        const q = query(
          moveRef,
          where("widthMm", "==", widthMm),
          orderBy("timestamp", "desc"),
          limit(50)
        );
        const snap = await getDocs(q);
        setMovements(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StripMovement));
      } catch (err) {
        console.error("Error fetching movements:", err);
      } finally {
        setIsLoading(true);
        // Pequeno delay para que no sea muy brusco
        setTimeout(() => setIsLoading(false), 300);
      }
    };
    fetchMovements();
  }, [widthMm]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white w-full max-w-xl h-full md:h-[calc(100vh-2rem)] md:rounded-[2rem] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <header className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0 md:rounded-t-[2rem]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none uppercase">
                Trazabilidad: {widthMm}mm
              </h2>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
                Últimos 50 movimientos del stock
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest">Consultando registros...</p>
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-20 opacity-50 italic text-slate-500 font-medium">
              No hay movimientos registrados para este ancho.
            </div>
          ) : (
            movements.map((move) => {
              const isEntrada = move.type === "ENTRADA";
              const date = move.timestamp instanceof Timestamp ? move.timestamp.toDate() : new Date(move.timestamp);
              
              return (
                <div
                  key={move.id}
                  className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition relative overflow-hidden"
                >
                  <div className={`absolute top-0 left-0 w-1 h-full ${isEntrada ? 'bg-emerald-500' : move.type === 'SALIDA' ? 'bg-orange-500' : 'bg-blue-500'}`} />
                  
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                        isEntrada ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                        move.type === 'SALIDA' ? 'bg-orange-50 text-orange-700 border-orange-100' : 
                        'bg-blue-50 text-blue-700 border-blue-100'
                      }`}>
                        {isEntrada ? <ArrowDownLeft size={10} className="inline mr-1" /> : <ArrowUpRight size={10} className="inline mr-1" />}
                        {move.type}
                      </span>
                      <span className="text-[10px] font-black text-slate-400 flex items-center gap-1 uppercase">
                        <Clock size={10} /> {date.toLocaleDateString('es-PE')} · {date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                       <p className={`text-sm font-black ${isEntrada ? 'text-emerald-600' : 'text-slate-800'}`}>
                         {isEntrada ? '+' : '-'}{move.quantity} <span className="text-[10px]">UND</span>
                       </p>
                       <p className="text-[10px] font-bold text-slate-400">{move.weight.toLocaleString('es-PE')} kg</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl">
                       <Hash size={12} className="text-slate-300" />
                       <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">Ref: {move.referenceId}</span>
                    </div>
                    <div className="flex items-start gap-2 px-2">
                       <FileText size={12} className="text-slate-300 mt-0.5" />
                       <p className="text-[11px] font-bold text-slate-500 leading-tight">{move.description}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <footer className="p-6 bg-slate-50 border-t border-slate-100 md:rounded-b-[2rem] flex justify-end">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
             <History size={12} /> AYR Steel ERP v6.4
           </p>
        </footer>
      </div>
    </div>
  );
}
