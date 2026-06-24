import { DollarSign, TrendingUp, Scale } from "lucide-react";

interface SalesMetricsProps {
  totalRevenue: number;
  totalProfit: number;
  totalWeight: number;
  count?: number;
  isAlgolia?: boolean;
}

export function SalesMetrics({
  totalRevenue,
  totalProfit,
  totalWeight,
  count = 0,
  isAlgolia = false,
}: SalesMetricsProps) {
  if (isAlgolia) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-600 text-white p-6 rounded-3xl shadow-sm border border-blue-800 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 bg-white/10 w-24 h-24 rounded-full"></div>
          <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-2 flex items-center gap-1 relative z-10">
            Cantidad
          </p>
          <h3 className="text-3xl font-black tracking-tighter relative z-10">
            {count} <span className="text-lg font-bold">Ventas</span>
          </h3>
        </div>
        <div className="md:col-span-3 bg-slate-50 border border-slate-200 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center text-center">
          <p className="text-slate-500 font-bold">Totales no disponibles en búsqueda por texto</p>
          <p className="text-xs text-slate-400 mt-1">Borre el buscador para ver los montos y pesos totales.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-blue-600 text-white p-6 rounded-3xl shadow-sm border border-blue-800 relative overflow-hidden">
        <div className="absolute -right-4 -top-4 bg-white/10 w-24 h-24 rounded-full"></div>
        <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-2 flex items-center gap-1 relative z-10">
          Cantidad
        </p>
        <h3 className="text-3xl font-black tracking-tighter relative z-10">
          {count} <span className="text-lg font-bold">Ventas</span>
        </h3>
      </div>
      <div className="bg-gray-900 text-white p-6 rounded-3xl shadow-sm border border-gray-800 relative overflow-hidden">
        <div className="absolute -right-4 -top-4 bg-white/5 w-24 h-24 rounded-full"></div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1 relative z-10">
          <DollarSign size={14} /> Total Facturado
        </p>
        <h3 className="text-3xl font-black tracking-tighter relative z-10">
          S/{" "}
          {totalRevenue.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
        </h3>
      </div>
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100 relative overflow-hidden">
        <div className="absolute -right-4 -top-4 bg-emerald-50 w-24 h-24 rounded-full"></div>
        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1 relative z-10">
          <TrendingUp size={14} /> Utilidad Total
        </p>
        <h3 className="text-3xl font-black text-emerald-700 tracking-tighter relative z-10">
          S/ {totalProfit.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
        </h3>
      </div>
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-orange-100 relative overflow-hidden">
        <div className="absolute -right-4 -top-4 bg-orange-50 w-24 h-24 rounded-full"></div>
        <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2 flex items-center gap-1 relative z-10">
          <Scale size={14} /> Volumen Despachado
        </p>
        <h3 className="text-3xl font-black text-orange-700 tracking-tighter relative z-10">
          {totalWeight.toLocaleString("es-PE")}{" "}
          <span className="text-lg">kg</span>
        </h3>
      </div>
    </div>
  );
}
