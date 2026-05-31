"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { StripStock, ProductConfig, StripMovement } from "@/types";
import { getCatalog } from "../../services/catalogService";
import { produceFromStrip } from "../../services/productionService";
import { db } from "@/lib/firebase/clientApp";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { X, Factory, Save, Loader2, Info, CheckCircle2, AlertTriangle, TrendingUp, Calculator, Minus, Plus, History } from "lucide-react";
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';

interface OutsourcedProductionFormProps {
  strip: StripStock;
  onClose: () => void;
}

export function OutsourcedProductionForm({ strip, onClose }: OutsourcedProductionFormProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [catalog, setCatalog] = useState<ProductConfig[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [recentMovements, setRecentMovements] = useState<StripMovement[]>([]);
  
  const [formData, setFormData] = useState({
    sku: '',
    pieces: "" as number | "",
    stripsUsed: 1,
    operatorId: user?.email || 'admin'
  });

  // 1. Cargar Catálogo y Movimientos Recientes para Trazabilidad
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Cargar Catálogo
        const catData = await getCatalog();
        const filtered = catData.filter(p => p.stripWidth === strip.widthMm && p.isActive);
        setCatalog(filtered);
        if (filtered.length > 0) {
          setFormData(f => ({ ...f, sku: filtered[0].sku }));
        }

        // Cargar Trazabilidad (Últimas entradas a este stock)
        const moveRef = collection(db, "strips_movements");
        const q = query(
          moveRef, 
          where("widthMm", "==", strip.widthMm), 
          where("type", "==", "ENTRADA"),
          orderBy("timestamp", "desc"),
          limit(3)
        );
        const moveSnap = await getDocs(q);
        setRecentMovements(moveSnap.docs.map(d => d.data() as StripMovement));

      } finally {
        setIsLoadingCatalog(false);
      }
    };
    fetchData();
  }, [strip.widthMm]);

  // Cálculos de apoyo
  const avgWeightPerStrip = strip.totalWeight / strip.totalStrips;
  const selectedProduct = useMemo(() => catalog.find(p => p.sku === formData.sku), [catalog, formData.sku]);
  
  const expectedPiecesPerStrip = useMemo(() => {
    if (!selectedProduct || !selectedProduct.standardWeight) return 0;
    return avgWeightPerStrip / selectedProduct.standardWeight;
  }, [selectedProduct, avgWeightPerStrip]);

  const totalExpectedPieces = expectedPiecesPerStrip * formData.stripsUsed;
  const efficiency = typeof formData.pieces === 'number' && totalExpectedPieces > 0 
    ? (formData.pieces / totalExpectedPieces) * 100 
    : 0;

  const isExceeding = typeof formData.pieces === 'number' && formData.pieces > Math.ceil(totalExpectedPieces * 1.05);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sku || !formData.pieces || formData.stripsUsed <= 0 || isExceeding) {
      toast.error("Por favor completa todos los campos correctamente.");
      return;
    }

    setIsSubmitting(true);
    try {
      await produceFromStrip({
        ...formData,
        pieces: Number(formData.pieces),
        userEmail: user?.email || 'admin@ayrsteel.com'
      });
      toast.success("¡Producción registrada! Stock actualizado.");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar producción.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingCatalog) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl">
        <Loader2 size={40} className="animate-spin text-orange-600 mb-4" />
        <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Preparando máquina...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white max-h-[95vh]">
      {/* HEADER COMPACTO */}
      <header className="flex justify-between items-center bg-orange-50 p-5 border-b border-orange-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-md">
            <Factory size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-orange-900 tracking-tight uppercase leading-none">Paso 2: Conformadora</h2>
            <p className="text-[11px] text-orange-700 font-bold mt-1 italic">
              Procesando fleje de {strip.widthMm}mm
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-orange-200 rounded-full transition text-orange-800">
          <X size={20} />
        </button>
      </header>

      <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
           
           {/* COLUMNA IZQUIERDA: SELECCIÓN Y TRAZABILIDAD */}
           <div className="lg:col-span-7 space-y-6">
              
              {/* TRAZABILIDAD DE ORIGEN */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <History size={14} /> Trazabilidad de Origen (Últimos ingresos)
                </h3>
                <div className="flex flex-wrap gap-2">
                   {recentMovements.length > 0 ? recentMovements.map((move, i) => (
                     <div key={i} className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                        <span className="text-[9px] font-black text-blue-600 uppercase leading-none">LOTE #{move.referenceId.slice(-6)}</span>
                        <span className="text-[10px] font-bold text-slate-500 mt-1">{move.description.split('bobina')[1] || move.description}</span>
                     </div>
                   )) : (
                     <p className="text-[10px] text-slate-400 font-bold italic">Cargando datos de origen...</p>
                   )}
                </div>
              </div>

              {/* SELECCIÓN DE PRODUCTO */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  1. Perfil a fabricar
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {catalog.map(p => (
                    <label 
                      key={p.sku}
                      className={`p-4 border-2 rounded-2xl cursor-pointer flex flex-col transition-all relative overflow-hidden ${formData.sku === p.sku ? "border-orange-500 bg-orange-50" : "border-slate-100 hover:border-slate-300"}`}
                    >
                      <div className="flex items-center gap-2 z-10">
                        <input
                          type="radio"
                          checked={formData.sku === p.sku}
                          onChange={() => setFormData(f => ({ ...f, sku: p.sku }))}
                          className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                        />
                        <span className="font-black text-sm text-slate-800 uppercase tracking-tighter">
                          {p.sku}
                        </span>
                      </div>
                      <p className="text-[9px] font-bold text-slate-500 mt-0.5 z-10">{p.name}</p>
                    </label>
                  ))}
                </div>
              </div>

              {/* FLEJES USADOS (INPUT NUMÉRICO CON BOTONES) */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  2. Cantidad de flejes físicos
                </label>
                <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100 w-full max-w-sm">
                   <button
                     type="button"
                     onClick={() => setFormData(f => ({ ...f, stripsUsed: Math.max(1, f.stripsUsed - 1) }))}
                     className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 active:scale-95 transition shadow-sm"
                   >
                     <Minus size={20} />
                   </button>
                   <input 
                      type="number"
                      value={formData.stripsUsed}
                      onChange={e => setFormData(f => ({ ...f, stripsUsed: Math.min(strip.totalStrips, Math.max(1, Number(e.target.value))) }))}
                      className="flex-1 bg-transparent border-none text-center font-black text-2xl text-slate-800 outline-none focus:ring-0"
                   />
                   <button
                     type="button"
                     onClick={() => setFormData(f => ({ ...f, stripsUsed: Math.min(strip.totalStrips, f.stripsUsed + 1) }))}
                     className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 active:scale-95 transition shadow-sm"
                   >
                     <Plus size={20} />
                   </button>
                   <div className="px-4 border-l border-slate-200 text-right min-w-[80px]">
                      <p className="text-[8px] font-black text-slate-400 uppercase leading-none">Disponibles</p>
                      <p className="text-sm font-black text-slate-700">{strip.totalStrips}</p>
                   </div>
                </div>
              </div>
           </div>

           {/* COLUMNA DERECHA: RESULTADO Y COSTEO */}
           <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 flex flex-col items-center">
                 <div className="w-full flex justify-between items-end mb-3 px-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      3. Piezas Resultantes
                    </label>
                    {totalExpectedPieces > 0 && (
                      <span className="text-[9px] font-black uppercase bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full shadow-sm">
                        Esperado: ~{Math.floor(totalExpectedPieces)}
                      </span>
                    )}
                 </div>

                 <input
                    type="number"
                    required
                    placeholder="0"
                    className={`w-full p-6 border-4 rounded-2xl text-5xl font-black text-center outline-none transition-all shadow-inner ${
                      isExceeding
                        ? "border-red-400 text-red-600 bg-red-50 focus:ring-2 focus:ring-red-100"
                        : "border-green-300 text-green-700 bg-white focus:ring-2 focus:ring-green-50 placeholder-slate-100"
                    }`}
                    value={formData.pieces}
                    onChange={e => setFormData(f => ({ ...f, pieces: e.target.value ? Number(e.target.value) : "" }))}
                 />

                 {!isExceeding && efficiency > 0 && (
                    <div className="mt-4 w-full space-y-1 px-1">
                       <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase">
                          <span>Eficiencia</span>
                          <span className={efficiency < 90 ? "text-orange-500" : "text-green-500"}>{efficiency.toFixed(1)}%</span>
                       </div>
                       <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                          <div 
                            className={`h-full transition-all duration-500 ${efficiency < 90 ? "bg-orange-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(efficiency, 100)}%` }}
                          />
                       </div>
                    </div>
                 )}
              </div>

              {/* RESUMEN DE COSTEO COMPACTO */}
              <div className="bg-blue-600 rounded-[2rem] p-6 text-white shadow-lg relative overflow-hidden group">
                 <div className="absolute -right-2 -top-2 text-blue-500 opacity-20">
                    <Calculator size={80} />
                 </div>
                 
                 <h3 className="text-[9px] font-black text-blue-200 uppercase tracking-widest mb-4 flex items-center gap-2 relative z-10">
                    <TrendingUp size={12} /> Valorización Estimada
                 </h3>
                 
                 <div className="space-y-4 relative z-10">
                    <div className="flex justify-between items-center text-xs">
                       <span className="font-bold text-blue-100">Material:</span>
                       <span className="font-black">S/ {(formData.stripsUsed * avgWeightPerStrip * strip.avgCostPerKg).toFixed(2)}</span>
                    </div>
                    <div className="h-px bg-blue-500/50" />
                    <div>
                        <p className="text-[9px] font-black text-blue-200 uppercase tracking-widest mb-1">Costo Unitario</p>
                        <p className="text-2xl font-black">
                          S/ {formData.pieces ? ((formData.stripsUsed * avgWeightPerStrip * strip.avgCostPerKg) / Number(formData.pieces)).toFixed(4) : '0.0000'}
                        </p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </form>

      {/* FOOTER FIJO */}
      <footer className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
        <button 
          onClick={onClose}
          className="px-6 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition"
        >
          Cancelar
        </button>
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting || catalog.length === 0 || !formData.pieces || isExceeding}
          className="px-10 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-xl disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isSubmitting ? "REGISTRANDO..." : "FINALIZAR PRODUCCIÓN"}
        </button>
      </footer>
    </div>
  );
}
