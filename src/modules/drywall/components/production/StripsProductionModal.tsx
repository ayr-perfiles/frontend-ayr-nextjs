"use client";

import { useState, useEffect } from "react";
import { listStripsStock } from "@/core/coils/services/stripsStockService";
import { StripStock } from "@/types";
import { X, Search, Loader2, Boxes, Scale, Calculator } from "lucide-react";

interface StripsProductionModalProps {
  onClose: () => void;
  onSelect: (strip: StripStock) => void;
}

export function StripsProductionModal({ onClose, onSelect }: StripsProductionModalProps) {
  const [strips, setStrips] = useState<StripStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchStrips = async () => {
      try {
        const data = await listStripsStock();
        setStrips(data);
      } catch (err) {
        console.error("Error al cargar flejes disponibles:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStrips();
  }, []);

  const filteredStrips = strips.filter(s => 
    s.widthMm.toString().includes(searchTerm)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black tracking-tight uppercase">Iniciar Producción Drywall</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Selecciona un fleje del inventario tercerizado</p>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-3 rounded-2xl transition text-slate-300">
            <X size={28} />
          </button>
        </div>

        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por ancho (mm)..."
              className="w-full pl-12 pr-6 py-4 bg-white border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="animate-spin mb-4 text-blue-600" size={48} />
              <p className="font-black uppercase tracking-widest text-[10px]">Cargando inventario de flejes...</p>
            </div>
          ) : filteredStrips.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white shadow-sm text-slate-300 mb-6">
                <Boxes size={40} />
              </div>
              <h3 className="text-slate-900 font-black text-xl">No hay flejes disponibles</h3>
              <p className="text-slate-400 mt-2 max-w-xs mx-auto font-medium">
                Debes registrar la recepción de flejes desde las órdenes de corte externo.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredStrips.map(strip => (
                <button
                  key={strip.widthMm}
                  onClick={() => onSelect(strip)}
                  className="flex items-center justify-between p-6 bg-white border border-slate-100 rounded-3xl hover:border-blue-300 hover:shadow-xl hover:shadow-blue-50 transition-all group text-left shadow-sm relative overflow-hidden"
                >
                  <div className="flex items-center gap-6 z-10">
                    <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center font-black text-2xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                      {strip.widthMm}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-lg leading-tight">Fleje {strip.widthMm}mm</h4>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
                        Drywall Standard
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-8 z-10">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disponibles</p>
                      <p className="text-xl font-black text-slate-800">
                        {strip.totalStrips} <span className="text-[10px] text-slate-400">UND</span>
                      </p>
                    </div>
                    <div className="w-px h-10 bg-slate-100" />
                    <div className="text-right min-w-[80px]">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo Prom.</p>
                      <p className="font-black text-blue-600">
                        S/ {strip.avgCostPerKg.toFixed(2)} <span className="text-[10px]">/kg</span>
                      </p>
                    </div>
                  </div>
                  
                  {/* Decorative background number */}
                  <span className="absolute -right-4 -bottom-4 text-slate-50 font-black text-8xl pointer-events-none select-none group-hover:text-blue-50 transition-colors">
                    {strip.widthMm}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-10 py-4 text-xs font-black text-slate-400 hover:text-slate-600 transition uppercase tracking-widest"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
