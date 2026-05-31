"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Coil, CutOrder, ProductConfig } from "@/types";
import { X, Scissors, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { sendToCut, updateSentOrder } from "../services/cutOrderService";
import { getCatalog } from "@/modules/drywall/services/catalogService";
import toast from 'react-hot-toast';

interface SendToCutModalProps {
  coils: Coil[];
  initialOrder?: CutOrder; // Para modo edición
  userEmail: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface PlanItem {
  sku: string;
  count: number;
}

export default function SendToCutModal({ coils, initialOrder, userEmail, onClose, onSuccess }: SendToCutModalProps) {
  const isEditMode = !!initialOrder;
  
  const [catalog, setCatalog] = useState<ProductConfig[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  
  const [tercero, setTercero] = useState({ 
    nombre: initialOrder?.tercero.nombre || '', 
    ruc: initialOrder?.tercero.ruc || '' 
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Plan por bobina: Record<coilId, PlanItem[]>
  const [cutPlans, setCutPlans] = useState<Record<string, PlanItem[]>>({});

  // 1. Cargar Catálogo
  useEffect(() => {
    const fetchCatalog = async () => {
      const data = await getCatalog();
      const activeProducts = data.filter((p) => p.isActive);
      setCatalog(activeProducts);

      if (isEditMode && initialOrder) {
        // En modo edición, reconstruir los planes desde la orden
        const editPlans: Record<string, PlanItem[]> = {};
        initialOrder.coils.forEach(c => {
          editPlans[c.coilId] = c.cutPlan.map(p => {
            const mappedProd = activeProducts.find(ap => ap.stripWidth === p.widthMm);
            return {
              sku: mappedProd?.sku || 'GENERIC',
              count: p.count
            };
          });
        });
        setCutPlans(editPlans);
      } else if (activeProducts.length > 0) {
        // Modo creación: inicializar con un perfil por defecto
        const initialPlans: Record<string, PlanItem[]> = {};
        coils.forEach(c => {
          initialPlans[c.id] = [{ sku: activeProducts[0].sku, count: 8 }];
        });
        setCutPlans(initialPlans);
      }
      setIsLoadingCatalog(false);
    };
    fetchCatalog();
  }, [coils, isEditMode, initialOrder]);

  // 2. Cálculos por Bobina
  const coilCalculations = useMemo(() => {
    const calcs: Record<string, { totalUsedWidth: number; isWidthValid: boolean; scrapWidth: number }> = {};
    
    coils.forEach(coil => {
      const items = cutPlans[coil.id] || [];
      let totalUsedWidth = 0;
      items.forEach(item => {
        const product = catalog.find(p => p.sku === item.sku);
        if (product) {
          totalUsedWidth += (product.stripWidth * item.count);
        }
      });
      const isWidthValid = totalUsedWidth <= (coil.masterWidth || 1192);
      calcs[coil.id] = {
        totalUsedWidth,
        isWidthValid,
        scrapWidth: (coil.masterWidth || 1192) - totalUsedWidth
      };
    });
    
    return calcs;
  }, [cutPlans, coils, catalog]);

  const isGlobalValid = useMemo(() => {
    return Object.values(coilCalculations).every(c => c.isWidthValid);
  }, [coilCalculations]);

  // 3. Handlers
  const handleAddItem = (coilId: string) => {
    const currentItems = cutPlans[coilId] || [];
    const availableSkus = catalog
      .map((p) => p.sku)
      .filter((sku) => !currentItems.some((item) => item.sku === sku));

    if (availableSkus.length === 0) {
      toast.error("Todos los productos ya están en el plan.");
      return;
    }

    setCutPlans(prev => ({
      ...prev,
      [coilId]: [...currentItems, { sku: availableSkus[0], count: 1 }]
    }));
  };

  const handleRemoveItem = (coilId: string, index: number) => {
    setCutPlans(prev => ({
      ...prev,
      [coilId]: prev[coilId].filter((_, i) => i !== index)
    }));
  };

  const handleUpdateItem = (coilId: string, index: number, field: keyof PlanItem, value: any) => {
    setCutPlans(prev => {
      const newItems = [...(prev[coilId] || [])];
      if (field === 'sku') {
        if (newItems.some((it, i) => i !== index && it.sku === value)) {
          toast.error("Producto ya agregado.");
          return prev;
        }
        newItems[index].sku = value;
      } else {
        newItems[index].count = Number(value);
      }
      return { ...prev, [coilId]: newItems };
    });
  };

  const handleSubmit = async () => {
    if (!tercero.nombre) {
      toast.error("El nombre del tercero es obligatorio.");
      return;
    }
    if (!isGlobalValid) {
      toast.error("Hay planes de corte que exceden el ancho de la bobina.");
      return;
    }

    setIsSubmitting(true);
    try {
      const coilsPayload = coils.map(c => {
        const items = cutPlans[c.id] || [];
        const cutPlan = items.map(it => {
          const product = catalog.find(p => p.sku === it.sku);
          return {
            widthMm: product?.stripWidth || 0,
            count: it.count
          };
        });
        return { coilId: c.id, cutPlan };
      });

      if (isEditMode && initialOrder) {
        await updateSentOrder(initialOrder.id!, {
          tercero,
          coils: coilsPayload,
          userEmail
        });
        toast.success("✅ Orden actualizada con éxito.");
      } else {
        await sendToCut({
          tercero,
          coils: coilsPayload,
          userEmail
        });
        toast.success("✅ Orden de corte enviada con éxito.");
      }
      
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Error al procesar la orden.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingCatalog) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <div className="bg-white p-12 rounded-[2rem] shadow-2xl flex flex-col items-center">
          <Loader2 size={48} className="animate-spin text-blue-600 mb-4" />
          <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Cargando catálogo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <header className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Scissors size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                {isEditMode ? 'Editar Orden de Corte' : 'Enviar a Corte Externo'}
              </h2>
              <p className="text-sm text-slate-500 font-bold italic">
                {isEditMode ? `Modificando orden #${initialOrder?.id?.slice(-6)}` : `Configura el plan de corte para ${coils.length} bobinas.`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-400">
            <X size={24} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          {/* DATOS DEL TERCERO */}
          <section className="space-y-4">
            <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span> 1. Datos del Proveedor (Servicio)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nombre / Razón Social</label>
                <input 
                  type="text" 
                  value={tercero.nombre}
                  onChange={e => setTercero(t => ({ ...t, nombre: e.target.value }))}
                  placeholder="Ej: IMRED PERU SAC"
                  className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">RUC (Opcional)</label>
                <input 
                  type="text" 
                  value={tercero.ruc}
                  onChange={e => setTercero(t => ({ ...t, ruc: e.target.value }))}
                  placeholder="2060..."
                  className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
                />
              </div>
            </div>
          </section>

          {/* PLANES POR BOBINA */}
          <section className="space-y-8">
            <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span> 2. Plan de Corte (Basado en Productos)
            </h3>
            
            {coils.map(coil => {
              const calc = coilCalculations[coil.id] || { totalUsedWidth: 0, isWidthValid: true, scrapWidth: 0 };
              const items = cutPlans[coil.id] || [];

              return (
                <div key={coil.id} className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100 space-y-6">
                  <header className="flex justify-between items-center border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm font-black text-xs">
                        {coil.id.slice(-4)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Bobina: {coil.id}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase italic">Ancho Maestro: {coil.masterWidth}mm | Peso: {coil.currentWeight}kg</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleAddItem(coil.id)}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 hover:border-blue-500 hover:text-blue-600 transition flex items-center gap-2 shadow-sm uppercase tracking-tighter"
                    >
                      <Plus size={14} /> Añadir Perfil
                    </button>
                  </header>

                  <div className="grid grid-cols-1 gap-3">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex gap-3 items-end">
                        <div className="flex-1">
                          <label className="text-[8px] font-black text-slate-300 uppercase ml-2">Producto</label>
                          <select
                            className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                            value={item.sku}
                            onChange={(e) => handleUpdateItem(coil.id, idx, "sku", e.target.value)}
                          >
                            <option value="GENERIC">Selecciona un perfil...</option>
                            {catalog.map((prod) => (
                              <option key={prod.sku} value={prod.sku}>
                                {prod.sku} ({prod.stripWidth}mm) - {prod.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-32">
                          <label className="text-[8px] font-black text-slate-300 uppercase ml-2">Cant. Flejes</label>
                          <input
                            type="number"
                            min="1"
                            className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-black text-center focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                            value={item.count}
                            onChange={(e) => handleUpdateItem(coil.id, idx, "count", e.target.value)}
                          />
                        </div>
                        {items.length > 1 && (
                          <button
                            onClick={() => handleRemoveItem(coil.id, idx)}
                            className="p-3 text-red-400 hover:bg-red-50 rounded-xl transition shadow-sm bg-white"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <footer className="pt-4 border-t border-slate-200 flex justify-between items-center">
                     <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ancho Utilizado:</span>
                        <div className={`flex items-center gap-2 font-mono font-bold text-sm ${!calc.isWidthValid ? 'text-red-500' : 'text-slate-700'}`}>
                           {calc.totalUsedWidth.toFixed(1)} mm / {coil.masterWidth} mm
                           {!calc.isWidthValid && <AlertTriangle size={14} />}
                        </div>
                     </div>
                     {calc.isWidthValid && (
                       <div className="text-[10px] font-bold text-slate-400 uppercase italic">
                         Sobrante: {calc.scrapWidth.toFixed(1)} mm
                       </div>
                     )}
                  </footer>
                </div>
              );
            })}
          </section>
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
            disabled={isSubmitting || !isGlobalValid}
            className="px-10 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-xl shadow-slate-200 flex items-center gap-3 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
            {isEditMode ? 'Guardar Cambios' : 'Confirmar Envío a Corte'}
          </button>
        </footer>
      </div>
    </div>
  );
}
