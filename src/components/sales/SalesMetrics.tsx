import { DollarSign, TrendingUp, Scale } from "lucide-react";

interface SalesMetricsProps {
  totalRevenue: number;
  totalProfit: number;
  totalWeight: number;
}

export function SalesMetrics({
  totalRevenue,
  totalProfit,
  totalWeight,
}: SalesMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-gray-900 text-white p-6 rounded-3xl shadow-sm border border-gray-800 relative overflow-hidden">
        <div className="absolute -right-4 -top-4 bg-white/5 w-24 h-24 rounded-full"></div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1 relative z-10">
          <DollarSign size={14} /> Ingresos (Ventas mostradas)
        </p>
        <h3 className="text-3xl font-black tracking-tighter relative z-10">
          S/{" "}
          {totalRevenue.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
        </h3>
      </div>
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100 relative overflow-hidden">
        <div className="absolute -right-4 -top-4 bg-emerald-50 w-24 h-24 rounded-full"></div>
        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1 relative z-10">
          <TrendingUp size={14} /> Ganancia Neta Pura
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
