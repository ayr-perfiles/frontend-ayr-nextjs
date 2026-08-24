"use client";

import { 
  PackageSearch, 
  Boxes, 
  DollarSign, 
  AlertCircle, 
  TrendingUp,
  Scale
} from "lucide-react";

interface InventoryMetricsProps {
  metrics: {
    byFinish: Record<string, number>;
    byFinishML?: Record<string, number>;
    enTercero: number;
    totalValuePEN: number;
    totalAvailableKg: number;
    alerts: {
      noFinish: number;
      lowWeight: number;
    };
  };
}

export function InventoryMetrics({ metrics }: InventoryMetricsProps) {
  const formatTn = (kg: number) => (kg / 1000).toFixed(1);

  return (
    <div className="space-y-4 mb-6">
      {/* 1. KPIs PRINCIPALES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* VALOR POOL */}
        <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm flex items-center gap-5 group hover:shadow-md transition-all">
          <div className="bg-emerald-50 w-14 h-14 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
            <DollarSign size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Valorización Total
            </p>
            <p className="text-2xl font-black text-slate-900 leading-none">
              S/ {metrics.totalValuePEN.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
              <TrendingUp size={10} /> EN INVENTARIO
            </p>
          </div>
        </div>

        {/* PESO TOTAL DISPONIBLE */}
        <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm flex items-center gap-5 group hover:shadow-md transition-all">
          <div className="bg-blue-50 w-14 h-14 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
            <Scale size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Stock Físico (Planta)
            </p>
            <p className="text-2xl font-black text-slate-900 leading-none">
              {formatTn(metrics.totalAvailableKg)} <span className="text-xs font-bold text-slate-400 uppercase">TN</span>
            </p>
            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tight">
              Peso neto actual
            </p>
          </div>
        </div>

        {/* KG EN TERCERO */}
        <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm flex items-center gap-5 group hover:shadow-md transition-all">
          <div className="bg-amber-50 w-14 h-14 rounded-2xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
            <PackageSearch size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              En Corte Externo
            </p>
            <p className="text-2xl font-black text-slate-900 leading-none">
              {formatTn(metrics.enTercero)} <span className="text-xs font-bold text-slate-400 uppercase">TN</span>
            </p>
            <p className="text-[10px] text-amber-600 font-bold mt-1 uppercase tracking-tight">
              Material fuera de planta
            </p>
          </div>
        </div>

        {/* ALERTAS */}
        <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm flex items-center gap-5 group hover:shadow-md transition-all">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${metrics.alerts.noFinish > 0 || metrics.alerts.lowWeight > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
            <AlertCircle size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Alertas de Almacén
            </p>
            <div className="flex flex-col gap-0.5">
               {metrics.alerts.noFinish > 0 && (
                 <p className="text-[11px] font-bold text-red-600 uppercase leading-none">
                   {metrics.alerts.noFinish} Sin acabado
                 </p>
               )}
               {metrics.alerts.lowWeight > 0 && (
                 <p className="text-[11px] font-bold text-orange-600 uppercase leading-none">
                   {metrics.alerts.lowWeight} Stock bajo
                 </p>
               )}
               {metrics.alerts.noFinish === 0 && metrics.alerts.lowWeight === 0 && (
                 <p className="text-[11px] font-bold text-slate-400 uppercase leading-none">
                   Todo en orden
                 </p>
               )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. DESGLOSE POR ACABADO */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
         {Object.entries(metrics.byFinish).map(([finish, weight]) => {
           const ml = metrics.byFinishML?.[finish];
           return (
             <div key={finish} className="bg-slate-50/50 border border-slate-100 px-4 py-3 rounded-2xl flex flex-col justify-center">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider truncate mb-1">
                  {finish}
                </span>
                <span className="text-sm font-black text-slate-700">
                  {formatTn(weight)} <span className="text-[10px] text-slate-400">TN</span>
                  {ml !== undefined && (
                    <span className="ml-1 text-blue-600">
                      · {ml.toLocaleString('es-PE', { maximumFractionDigits: 0 })} <span className="text-[10px]">ML</span>
                    </span>
                  )}
                </span>
             </div>
           );
         })}
      </div>
    </div>
  );
}
