"use client";

import React from 'react';
import { REPORT_REGISTRY } from '../registry';
import { ReportDefinition, ReportCategory } from '../types';
import { ChevronRight, Search, Layers } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ReportHubProps {
  onSelect: (report: ReportDefinition) => void;
}

const CATEGORY_COLORS: Record<ReportCategory, string> = {
  VENTAS: 'bg-blue-50 text-blue-600',
  INVENTARIO: 'bg-emerald-50 text-emerald-600',
  MATERIA_PRIMA: 'bg-slate-50 text-slate-600',
  PRODUCCIÓN: 'bg-purple-50 text-purple-600',
  EJECUTIVO: 'bg-orange-50 text-orange-600',
};

export function ReportHub({ onSelect }: ReportHubProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = React.useState('');

  const categories = Array.from(new Set(REPORT_REGISTRY.map((r) => r.category)));

  const filteredReports = REPORT_REGISTRY.filter(
    (r) =>
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Centro de Reportes</h1>
          <p className="text-slate-500 font-medium mt-1">
            Análisis detallado de ventas, inventario y producción
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar reporte..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl outline-none focus:border-blue-500 transition-all shadow-sm font-bold text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      {categories.map((cat) => {
        const catReports = filteredReports.filter((r) => r.category === cat);
        if (catReports.length === 0) return null;

        return (
          <section key={cat} className="space-y-5">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">
              {cat.replace('_', ' ')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {catReports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => onSelect(report)}
                  className="group flex flex-col text-left bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-2xl ${CATEGORY_COLORS[report.category]}`}>
                      <report.icon size={24} />
                    </div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="font-black text-slate-900 text-lg group-hover:text-blue-600 transition-colors">
                    {report.title}
                  </h3>
                  <p className="text-sm text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                    {report.description}
                  </p>
                  
                  <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <report.icon size={100} />
                  </div>
                </button>
              ))}

              {cat === 'INVENTARIO' && (
                <button
                  onClick={() => router.push('/admin/reports/bobinas-supervisor')}
                  className="group flex flex-col text-left bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-2xl ${CATEGORY_COLORS['INVENTARIO']}`}>
                      <Layers size={24} />
                    </div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="font-black text-slate-900 text-lg group-hover:text-blue-600 transition-colors">
                    Reporte de Bobinas (Supervisor)
                  </h3>
                  <p className="text-sm text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                    Stock de bobinas aluzinc detallado por unidad (ABIERTAS / CERRADAS) con exportación a PDF.
                  </p>
                  
                  <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Layers size={100} />
                  </div>
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
