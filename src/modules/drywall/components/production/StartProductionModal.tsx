"use client";

import { useState, useEffect } from "react";
import { listAvailableCoils } from "@/core/coils/services/coilService";
import { Coil } from "@/types";
import { X, Search, Loader2, Factory, Scale, Ruler } from "lucide-react";

interface StartProductionModalProps {
  onClose: () => void;
  onSelect: (coil: Coil) => void;
}

export function StartProductionModal({ onClose, onSelect }: StartProductionModalProps) {
  const [coils, setCoils] = useState<Coil[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchCoils = async () => {
      try {
        const data = await listAvailableCoils('drywall');
        setCoils(data);
      } catch (err) {
        console.error("Error al cargar bobinas disponibles:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCoils();
  }, []);

  const filteredCoils = coils.filter(c => 
    c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.metadata?.provider?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black">Iniciar Producción Drywall</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Selecciona una bobina galvanizada disponible</p>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-full transition">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por serie o proveedor..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="animate-spin mb-3" size={40} />
              <p className="font-bold uppercase tracking-widest text-xs">Cargando bobinas...</p>
            </div>
          ) : filteredCoils.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 text-slate-300 mb-4">
                <Factory size={32} />
              </div>
              <h3 className="text-slate-900 font-bold text-lg">No hay bobinas disponibles</h3>
              <p className="text-slate-500 mt-1 max-w-xs mx-auto">
                No se encontraron bobinas galvanizadas para drywall. Registra ingresos en Materia Prima.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredCoils.map(coil => (
                <button
                  key={coil.id}
                  onClick={() => onSelect(coil)}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 transition group text-left shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-slate-100 text-slate-500 p-3 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-600 transition">
                      <Factory size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-lg leading-tight">{coil.id}</h4>
                      <p className="text-xs text-slate-500 font-bold uppercase truncate max-w-[200px]">
                        {coil.metadata?.provider || 'Proveedor no registrado'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 mt-4 md:mt-0 px-4">
                    <div className="text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso Actual</p>
                      <p className="font-black text-slate-700 flex items-center gap-1 justify-center">
                        <Scale size={14} className="text-blue-500" />
                        {coil.currentWeight || coil.initialWeight} <span className="text-[10px]">kg</span>
                      </p>
                    </div>
                    <div className="w-px h-8 bg-slate-100 hidden md:block" />
                    <div className="text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Medidas</p>
                      <p className="font-black text-slate-700 flex items-center gap-1 justify-center">
                        <Ruler size={14} className="text-orange-500" />
                        {coil.masterWidth}x{coil.thickness} <span className="text-[10px]">mm</span>
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-black text-slate-500 hover:bg-slate-200 rounded-xl transition uppercase tracking-wider"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
