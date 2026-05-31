"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { ReportDefinition, ReportResult } from '../types';
import { ReportFilters } from './ReportFilters';
import { 
  Loader2, 
  ArrowLeft, 
  Download, 
  Table as TableIcon, 
  BarChart3 as ChartIcon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';

interface ReportRunnerProps {
  report: ReportDefinition;
  onBack: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export function ReportRunner({ report, onBack }: ReportRunnerProps) {
  const { role } = useAuth();
  
  const visibleColumns = useMemo(() => {
    return report.columns.filter(col => {
      if (!col.roles) return true;
      return role && col.roles.includes(role);
    });
  }, [report.columns, role]);

  const [filters, setFilters] = useState<any>(() => {
    const initial: any = {};
    report.filters.forEach(f => {
      initial[f.id] = f.defaultValue;
    });
    return initial;
  });

  const [data, setData] = useState<ReportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  
  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const runReport = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await report.run(filters);
      setData(result);
      setPage(1);
    } catch (err) {
      toast.error("Error al ejecutar el reporte");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [report, filters]);

  useEffect(() => {
    runReport();
  }, [runReport]);

  const handleExport = (format: 'xlsx' | 'csv') => {
    if (!data || data.rows.length === 0) return;
    
    const worksheet = XLSX.utils.json_to_sheet(data.rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');
    
    const fileName = `${report.id}_${new Date().toISOString().split('T')[0]}.${format}`;
    XLSX.writeFile(workbook, fileName);
    toast.success(`Exportado como ${format.toUpperCase()}`);
  };

  const paginatedRows = useMemo(() => {
    if (!data) return [];
    return data.rows.slice((page - 1) * pageSize, page * pageSize);
  }, [data, page]);

  const totalPages = data ? Math.ceil(data.rows.length / pageSize) : 0;

  const formatValue = (val: any, format: string) => {
    if (val === undefined || val === null) return '-';
    if (format === 'currency') return `S/ ${Number(val).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
    if (format === 'percent') return `${Number(val).toFixed(1)}%`;
    if (format === 'number') return Number(val).toLocaleString('es-PE');
    return String(val);
  };

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-98">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{report.title}</h1>
            <p className="text-sm text-slate-500 font-medium">{report.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {report.exports.map(ext => (
            <button
              key={ext}
              onClick={() => ext !== 'pdf' && handleExport(ext as any)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:border-blue-500 hover:text-blue-600 transition-all flex items-center gap-2 shadow-sm"
            >
              <Download size={14} /> {ext.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <ReportFilters 
        specs={report.filters} 
        values={filters} 
        onChange={(id, val) => setFilters((prev: any) => ({ ...prev, [id]: val }))} 
        onClear={() => setFilters({})}
      />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 text-blue-600">
          <Loader2 size={40} className="animate-spin mb-4" />
          <p className="font-bold text-slate-500 text-sm uppercase tracking-widest">Ejecutando Consulta...</p>
        </div>
      ) : data ? (
        <div className="space-y-8">
          {/* TOTALS BAR */}
          {data.totals && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(data.totals).map(([key, val]) => {
                 const col = visibleColumns.find(c => c.key === key);
                 if (!col && (key === 'profit' || key === 'margin')) return null; // Safety for sensitive totals
                 return (
                   <div key={key} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total {key}</p>
                     <p className="text-xl font-black text-slate-900">{formatValue(val, col?.format || 'number')}</p>
                   </div>
                 );
              })}
            </div>
          )}

          {/* VIEWER SECTION */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
             <div className="flex justify-between items-center p-6 border-b border-slate-50">
                <div className="flex bg-slate-50 p-1 rounded-xl">
                   <button 
                    onClick={() => setViewMode('chart')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 transition-all ${viewMode === 'chart' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                     <ChartIcon size={14} /> GRÁFICO
                   </button>
                   <button 
                    onClick={() => setViewMode('table')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 transition-all ${viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                     <TableIcon size={14} /> TABLA
                   </button>
                </div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{data.rows.length} REGISTROS ENCONTRADOS</span>
             </div>

             <div className="p-6">
                {viewMode === 'chart' && report.chart && report.chart.type !== 'none' ? (
                  <div className="h-96 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        {report.chart.type === 'line' ? (
                          <LineChart data={data.rows}>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                             <XAxis dataKey={report.chart.xKey} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                             <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                             <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                             <Legend wrapperStyle={{ paddingTop: '20px' }} />
                             {report.chart.yKeys
                              .filter(key => visibleColumns.some(c => c.key === key))
                              .map((key, i) => (
                               <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={3} dot={{ r: 4 }} />
                             ))}
                          </LineChart>
                        ) : report.chart.type === 'bar' ? (
                          <BarChart data={data.rows}>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                             <XAxis dataKey={report.chart.xKey} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                             <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                             <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                             <Legend wrapperStyle={{ paddingTop: '20px' }} />
                             {report.chart.yKeys
                              .filter(key => visibleColumns.some(c => c.key === key))
                              .map((key, i) => (
                               <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                             ))}
                          </BarChart>
                        ) : (
                          <PieChart>
                             <Pie
                                data={data.rows}
                                innerRadius={80}
                                outerRadius={120}
                                paddingAngle={5}
                                dataKey={report.chart.yKeys[0]}
                                nameKey={report.chart.xKey}
                             >
                                {data.rows.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                             </Pie>
                             <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                             <Legend />
                          </PieChart>
                        )}
                     </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead>
                          <tr className="border-b border-slate-50">
                             {visibleColumns.map(col => (
                               <th key={col.key} className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">{col.label}</th>
                             ))}
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {paginatedRows.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                               {visibleColumns.map(col => (
                                 <td key={col.key} className="py-4 px-4">
                                    {col.format === 'badge' ? (
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${col.badgeStyle?.(row[col.key])}`}>
                                        {row[col.key]}
                                      </span>
                                    ) : (
                                      <span className="text-sm font-bold text-slate-700">{formatValue(row[col.key], col.format)}</span>
                                    )}
                                 </td>
                               ))}
                            </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>
                )}
             </div>

             {/* TABLE FOOTER / PAGINATION */}
             <div className="flex justify-between items-center p-6 bg-slate-50 border-t border-slate-50">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Página {page} de {totalPages || 1}</p>
                <div className="flex gap-2">
                   <button 
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 disabled:opacity-30 hover:text-blue-600 hover:border-blue-500 transition-all shadow-sm"
                   >
                     <ChevronLeft size={18} />
                   </button>
                   <button 
                    disabled={page === totalPages || totalPages === 0}
                    onClick={() => setPage(p => p + 1)}
                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 disabled:opacity-30 hover:text-blue-600 hover:border-blue-500 transition-all shadow-sm"
                   >
                     <ChevronRight size={18} />
                   </button>
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="py-32 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
           <p className="text-slate-400 font-bold italic">No hay resultados para los filtros seleccionados.</p>
        </div>
      )}
    </div>
  );
}
