"use client";

import React, { useState, useEffect } from 'react';
import { listStripsStock } from "@/core/coils/services/stripsStockService";
import { StripStock } from "@/types";
import { Loader2, Boxes, ArrowRightLeft, Scale, Calculator } from "lucide-react";

export default function StripsInventoryPage() {
  const [strips, setStrips] = useState<StripStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStrips = async () => {
      try {
        const data = await listStripsStock();
        setStrips(data);
      } catch (err) {
        console.error("Error fetching strips stock:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStrips();
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Boxes className="text-blue-600" /> Inventario de Flejes
          </h1>
          <p className="text-sm text-slate-500 font-medium italic">Stock de flejes (material listo para conformar) por ancho y costo promedio.</p>
        </div>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando inventario...</p>
        </div>
      ) : strips.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] py-20 text-center">
          <Boxes size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-400 font-bold italic text-lg">No hay flejes en stock.</p>
          <p className="text-slate-400 text-sm mt-2">Recibe flejes desde las órdenes de corte para poblar este inventario.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {strips.map(strip => (
            <div key={strip.widthMm} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-center mb-6">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-lg shadow-inner">
                  {strip.widthMm}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ancho (mm)</p>
                  <p className="text-xs font-bold text-slate-600">Drywall Standard</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-tight">
                    <ArrowRightLeft size={14} className="text-slate-300" /> Flejes
                  </div>
                  <span className="text-xl font-black text-slate-800">{strip.totalStrips}</span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-tight">
                    <Scale size={14} className="text-slate-300" /> Peso Total
                  </div>
                  <span className="text-sm font-black text-slate-700">{strip.totalWeight.toLocaleString('es-PE')} kg</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-tight">
                    <Calculator size={14} className="text-slate-300" /> Costo/Kg
                  </div>
                  <span className="text-sm font-black text-blue-600">S/ {strip.avgCostPerKg.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-50">
                 <p className="text-[10px] font-bold text-slate-300 uppercase italic">
                   Última actualización: {strip.lastUpdate?.toDate().toLocaleDateString('es-PE')}
                 </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
