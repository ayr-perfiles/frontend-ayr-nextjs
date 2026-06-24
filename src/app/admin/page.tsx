"use client";

import { useEffect, useState, useMemo } from "react";
import { getDashboardData, TimeFilter, DashboardData } from "@/services/dashboardService";
import { useAuth } from "@/context/AuthContext";
import {
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  Package,
  Loader2,
  BarChart3,
  Layers,
  Factory,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Users,
  History,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const LINE_COLORS: Record<string, string> = {
  drywall: "#3b82f6", // Blue
  roofing: "#10b981", // Emerald
  "metallic-roofing": "#64748b", // Slate
  trading: "#f59e0b", // Amber
  services: "#8b5cf6", // Violet
};

const LINE_LABELS: Record<string, string> = {
  drywall: "Drywall",
  roofing: "Coberturas UPVC",
  "metallic-roofing": "Aluzinc",
  trading: "Compra-Venta",
  services: "Servicios",
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("MONTH");

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const res = await getDashboardData(timeFilter);
        setData(res);
      } catch (_err) {
        toast.error("Error al cargar datos del dashboard");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [timeFilter]);


  const stats = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: "Ventas Totales",
        value: `S/ ${data.kpis.totalSales.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
        change: data.kpis.salesChange,
        icon: TrendingUp,
        color: "blue",
        link: "/admin/sales",
      },
      {
        label: "Utilidad Bruta",
        value: `S/ ${data.kpis.totalProfit.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
        subValue: `${data.kpis.profitMargin.toFixed(1)}% margen`,
        icon: DollarSign,
        color: "emerald",
        link: "/admin/reports",
      },
      {
        label: "Transacciones",
        value: data.kpis.salesCount.toString(),
        subValue: `S/ ${data.kpis.avgTicket.toFixed(2)} promedio`,
        icon: History,
        color: "amber",
        link: "/admin/sales",
      },
      {
        label: "Valor Inventario",
        value: `S/ ${data.kpis.inventoryValue.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
        subValue: "Stock + Materia Prima",
        icon: Package,
        color: "slate",
        link: "/admin/coils",
      },
    ];
  }, [data]);

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-blue-600">
        <Loader2 size={48} className="animate-spin mb-4" />
        <p className="font-bold text-gray-500">Preparando Panel Ejecutivo...</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            Hola, {user?.displayName?.split(" ")[0] || "Administrador"} 👋
          </h1>
          <p className="text-gray-500 font-medium">Resumen general de AYR Steel</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm">
          {[
            { id: "TODAY", label: "Hoy" },
            { id: "7D", label: "7 Días" },
            { id: "MONTH", label: "Este Mes" },
            { id: "LAST_MONTH", label: "Mes Ant." },
            { id: "YEAR", label: "Año" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setTimeFilter(f.id as TimeFilter)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                timeFilter === f.id
                  ? "bg-slate-900 text-white shadow-lg"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {f.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* KPI ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Link
            key={i}
            href={stat.link}
            className="group bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600 group-hover:scale-110 transition-transform`}>
                  <stat.icon size={24} />
                </div>
                {stat.change !== undefined && (
                  <div className={`flex items-center gap-0.5 text-[10px] font-black px-2 py-1 rounded-full ${
                    stat.change >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                  }`}>
                    {stat.change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(stat.change).toFixed(1)}%
                  </div>
                )}
              </div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-2xl font-black text-gray-900 mt-1">{stat.value}</h3>
              {stat.subValue && <p className="text-[10px] font-bold text-gray-500 mt-1">{stat.subValue}</p>}
            </div>
            <div className={`absolute -right-6 -bottom-6 w-24 h-24 bg-${stat.color}-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-0`} />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* SALES BY LINE */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-xl font-black text-gray-900">Ventas por Línea</h2>
              <p className="text-sm text-gray-500 font-medium">Distribución del ingreso en el período</p>
            </div>
            <BarChart3 className="text-gray-300" size={32} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.lines.filter(l => l.sales > 0)}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="sales"
                    nameKey="line"
                  >
                    {data.lines.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={LINE_COLORS[entry.line] || "#ccc"} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => `S/ ${Number(val || 0).toLocaleString("es-PE")}`}
                    contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              {data.lines.sort((a,b) => b.sales - a.sales).map((l) => (
                <div key={l.line} className="flex items-center justify-between group cursor-default">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LINE_COLORS[l.line] }} />
                    <span className="text-sm font-bold text-gray-700">{LINE_LABELS[l.line]}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900">S/ {l.sales.toLocaleString("es-PE")}</p>
                    <p className="text-[10px] font-bold text-gray-400">
                      {((l.sales / (data.kpis.totalSales || 1)) * 100).toFixed(1)}% · {l.units} und.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ALERTS CENTER */}
        <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            <h2 className="text-xl font-black flex items-center gap-2">
              <AlertCircle className="text-orange-400" /> Centro de Acción
            </h2>
            
            <div className="space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
              {data.alerts.length === 0 ? (
                <div className="py-10 text-center opacity-50">
                  <p className="font-bold italic">Todo bajo control.</p>
                </div>
              ) : (
                data.alerts.map((alert, i) => (
                  <Link
                    key={i}
                    href={alert.link}
                    className="block bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/10 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        alert.type === 'LOW_STOCK' ? 'bg-red-500/20 text-red-400' :
                        alert.type === 'EXPIRING_QUOTE' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {alert.type.replace('_', ' ')}
                      </span>
                      <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-sm font-bold">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{alert.target}</p>
                  </Link>
                ))
              )}
            </div>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <AlertCircle size={120} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* RAW MATERIAL (COILS) */}
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-black text-gray-900">Materia Prima</h2>
              <p className="text-sm text-gray-500 font-medium">Pool compartido de Bobinas</p>
            </div>
            <Layers className="text-blue-500" size={24} />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-50 p-5 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso Total</p>
              <h4 className="text-2xl font-black text-slate-800">{data.coils.totalKg.toLocaleString("es-PE")} <span className="text-sm">kg</span></h4>
            </div>
            <div className="bg-slate-50 p-5 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valorización</p>
              <h4 className="text-2xl font-black text-slate-800">S/ {data.coils.poolValue.toLocaleString("es-PE")}</h4>
            </div>
          </div>

          <div className="space-y-3">
             {Object.entries(data.coils.byFinish).map(([finish, kg]) => (
               <div key={finish} className="space-y-1.5">
                 <div className="flex justify-between text-xs font-bold uppercase tracking-tighter">
                   <span>{finish}</span>
                   <span>{kg.toLocaleString("es-PE")} kg</span>
                 </div>
                 <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                   <div 
                    className="bg-blue-500 h-full rounded-full" 
                    style={{ width: `${(kg / (data.coils.totalKg || 1)) * 100}%` }} 
                   />
                 </div>
               </div>
             ))}
          </div>
          
          <Link href="/admin/coils" className="mt-8 flex items-center justify-center gap-2 w-full py-4 bg-gray-50 hover:bg-gray-100 text-gray-600 font-black text-sm rounded-2xl transition-all">
            GESTIONAR BOBINAS <ArrowUpRight size={18} />
          </Link>
        </div>

        {/* PRODUCTION SUMMARY */}
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
           <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-black text-gray-900">Producción</h2>
              <p className="text-sm text-gray-500 font-medium">Transformación en el período</p>
            </div>
            <Factory className="text-purple-500" size={24} />
          </div>

          <div className="space-y-6">
            {/* Drywall Production */}
            <div className="p-5 rounded-3xl bg-blue-50 border border-blue-100">
               <div className="flex justify-between items-start mb-4">
                 <h4 className="text-sm font-black text-blue-900 uppercase">Perfilería (Drywall)</h4>
                 <div className="text-right">
                   <p className="text-xl font-black text-blue-900">{data.production.byLine['drywall']?.pieces || 0} pzas</p>
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-4 text-[11px] font-bold">
                 <div className="flex items-center gap-2 text-blue-700">
                    <Layers size={14} /> Consumo: {data.production.byLine['drywall']?.kg.toLocaleString("es-PE") || 0} kg
                 </div>
                 <div className="flex items-center gap-2 text-red-600">
                    <TrendingUp size={14} className="rotate-180" /> Merma: {data.production.byLine['drywall']?.scrap || 0} mm
                 </div>
               </div>
            </div>

            {/* Metallic Production (Future) */}
            <div className="p-5 rounded-3xl bg-slate-50 border border-dashed border-slate-200 opacity-60">
               <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-black text-slate-500 uppercase">Coberturas (Aluzinc)</h4>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 italic">Producción Metallic próximamente (Sprint 6B)</p>
                  </div>
                  <Factory size={24} className="text-slate-300" />
               </div>
            </div>
          </div>

          <Link href="/admin/lines/drywall/production" className="mt-8 flex items-center justify-center gap-2 w-full py-4 bg-gray-50 hover:bg-gray-100 text-gray-600 font-black text-sm rounded-2xl transition-all uppercase tracking-widest">
            Ir a Taller <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* TOP PRODUCTS */}
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
          <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
            <Package className="text-emerald-500" /> Top Productos
          </h2>
          <div className="space-y-4">
            {data.topProducts.length === 0 ? <p className="text-gray-400 italic text-sm py-4">Sin datos en este período</p> : 
             data.topProducts.map((p, i) => (
               <div key={p.sku} className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100">
                 <div className="flex items-center gap-4">
                   <span className="text-lg font-black text-gray-200">0{i+1}</span>
                   <div>
                     <p className="font-black text-gray-800">{p.sku}</p>
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{p.quantity} unidades vendidas</p>
                   </div>
                 </div>
                 <p className="font-black text-gray-900">S/ {p.sales.toLocaleString("es-PE")}</p>
               </div>
             ))
            }
          </div>
        </div>

        {/* TOP CUSTOMERS */}
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
          <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
            <Users className="text-blue-500" /> Top Clientes
          </h2>
          <div className="space-y-4">
            {data.topCustomers.length === 0 ? <p className="text-gray-400 italic text-sm py-4">Sin datos en este período</p> : 
             data.topCustomers.map((c, i) => (
               <div key={c.name} className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100">
                 <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xs">
                     {c.name.charAt(0)}
                   </div>
                   <p className="font-black text-gray-800 truncate max-w-[200px]">{c.name}</p>
                 </div>
                 <p className="font-black text-gray-900">S/ {c.sales.toLocaleString("es-PE")}</p>
               </div>
             ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
