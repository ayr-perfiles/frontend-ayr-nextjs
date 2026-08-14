"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2, ArrowLeft, Download, AlertTriangle, TrendingUp } from 'lucide-react';
import { useAluzincDetalleFetch } from '@/core/reports/hooks/useAluzincDetalleFetch';
import { buildAluzincDetalle, deriveObservations, AluzincDetalleGroup } from '@/core/reports/aluzincDetalleLogic';
import { AluzincDetalleModal } from './AluzincDetalleModal';
import { bucketLogsBySourceId } from '@/core/production/fulfillmentLogic';

export default function AluzincDetallePage() {
  const { role } = useAuth();
  const router = useRouter();
  
  // Gate inline
  useEffect(() => {
    if (role && role !== 'ADMIN' && role !== 'SUPERVISOR') {
      router.replace('/admin');
    }
  }, [role, router]);

  const [period, setPeriod] = useState('HISTORICO');
  const [groupBy, setGroupBy] = useState<'COLOR_ESPESOR' | 'COLOR'>('COLOR_ESPESOR');
  
  const { sales, quotes, products, logs, loading, error } = useAluzincDetalleFetch(period);

  const [selectedGrupo, setSelectedGrupo] = useState<AluzincDetalleGroup | null>(null);

  const result = useMemo(() => {
    if (loading || !sales) return null;
    const logsMap = bucketLogsBySourceId(logs);
    return buildAluzincDetalle(sales, quotes, logsMap, products, period, groupBy);
  }, [sales, quotes, logs, products, period, loading, groupBy]);

  const observations = useMemo(() => {
    if (!result) return null;
    return deriveObservations(result.grupos);
  }, [result]);

  if (!role || (role !== 'ADMIN' && role !== 'SUPERVISOR')) return null;

  const formatMoney = (amount: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 pb-20">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/reports')} className="text-gray-500 hover:bg-gray-100 p-2 rounded-xl">
            <ArrowLeft size={20} />
          </button>
          <div className="bg-orange-100 p-2 rounded-xl text-orange-600">
             <TrendingUp size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Aluzinc - Ventas con Producción Cumplida</h1>
        </div>
        <button
            onClick={() => {
               if (result) {
                 import('./pdfExport').then(({ generateAluzincDetallePdf }) => {
                   const allWarnings = Array.from(new Set(result.grupos.flatMap((g) => g.warnings)));
                   generateAluzincDetallePdf(result, { periodLabel: period, warnings: allWarnings });
                 });
               }
            }}
            className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!result || loading}
          >
            <Download size={18} />
            Exportar PDF
          </button>
      </div>

      <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Período</label>
          <select 
            className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-64 p-2.5 outline-none"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="HOY">Hoy</option>
            <option value="SEMANA">Esta Semana</option>
            <option value="MES">Este Mes</option>
            <option value="MES_ANTERIOR">Mes Pasado</option>
            <option value="TRIMESTRE">Trimestre</option>
            <option value="ANIO">Este Año</option>
            <option value="HISTORICO">Histórico</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Agrupación</label>
          <select 
            className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-64 p-2.5 outline-none"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as 'COLOR_ESPESOR' | 'COLOR')}
          >
            <option value="COLOR_ESPESOR">Por color y espesor</option>
            <option value="COLOR">Solo por color</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6 flex gap-3 items-center">
          <AlertTriangle className="text-red-500 shrink-0" size={20} />
          <p className="text-sm font-medium">{error.message}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-10">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : result && observations ? (
        <div className="space-y-6">
          {(() => {
            const allWarnings = Array.from(new Set(result.grupos.flatMap((g) => g.warnings)));
            if (allWarnings.length === 0) return null;
            return (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex flex-col gap-1">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                  <span>Advertencias</span>
                </div>
                <ul className="list-disc pl-8 text-sm">
                  {allWarnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Mayor Desvío</div>
                {observations.mayorDesvioGrupo ? (
                  <div>
                    <div className="text-lg font-black text-slate-800 truncate" title={observations.mayorDesvioGrupo.name}>
                      {observations.mayorDesvioGrupo.name}
                    </div>
                    <div className={`text-xs font-bold mt-1 ${observations.mayorDesvioGrupo.pct > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {observations.mayorDesvioGrupo.kg > 0 ? '+' : ''}{observations.mayorDesvioGrupo.kg.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} kg
                      {' '}
                      ({observations.mayorDesvioGrupo.pct > 0 ? '+' : ''}{(observations.mayorDesvioGrupo.pct * 100).toFixed(2)}%)
                    </div>
                  </div>
                ) : (
                  <div className="text-xl font-black text-slate-800">—</div>
                )}
             </div>
             <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Rendimiento de Material</div>
                <div className={`text-xl font-black ${observations.rendimientoGlobalPct > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {observations.rendimientoGlobalPct > 0 ? '+' : ''}{(observations.rendimientoGlobalPct * 100).toFixed(2)}%
                </div>
             </div>
             <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Fuera de Calibre</div>
                <div className="text-xl font-black text-slate-800">
                  {observations.gruposFueraDeCalibre.length} {observations.gruposFueraDeCalibre.length === 1 ? 'grupo' : 'grupos'}
                </div>
                {observations.gruposFueraDeCalibre.length > 0 && (
                  <div className="text-xs text-red-500 font-medium mt-1">{observations.gruposFueraDeCalibre.join(', ')}</div>
                )}
             </div>
             <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Ventas Sin Costo Prod.</div>
                <div className="text-xl font-black text-slate-800">{observations.ventasSinCostoProduccion} {observations.ventasSinCostoProduccion === 1 ? 'venta' : 'ventas'}</div>
             </div>
          </div>

          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-700 border-b">
                  <tr>
                    <th className="px-4 py-3 font-black text-xs uppercase tracking-widest bg-slate-100" colSpan={3}>Grupo</th>
                    <th className="px-4 py-3 font-black text-xs uppercase tracking-widest bg-blue-50 text-blue-800 border-l border-white" colSpan={5}>Ventas</th>
                    <th className="px-4 py-3 font-black text-xs uppercase tracking-widest bg-orange-50 text-orange-800 border-l border-white" colSpan={2}>Producción</th>
                    <th className="px-4 py-3 font-black text-xs uppercase tracking-widest bg-emerald-50 text-emerald-800 border-l border-white" colSpan={4}>Rendimiento</th>
                    <th className="px-4 py-3 font-black text-xs uppercase tracking-widest bg-slate-50 border-l border-white"></th>
                  </tr>
                  <tr className="text-xs">
                    <th className="px-4 py-2">Color</th>
                    <th className="px-4 py-2 text-right">Espesor (mm)</th>
                    <th className="px-4 py-2 text-right">Clientes</th>

                    <th className="px-4 py-2 text-right border-l">Cant.</th>
                    <th className="px-4 py-2 text-right">Monto</th>
                    <th className="px-4 py-2 text-right">Ganancia</th>
                    <th className="px-4 py-2 text-right">Costo</th>
                    <th className="px-4 py-2 text-right">Margen %</th>

                    <th className="px-4 py-2 text-right border-l">Prod. (m)</th>
                    <th className="px-4 py-2 text-right">Piezas</th>

                    <th className="px-4 py-2 text-right border-l">Teórico (kg)</th>
                    <th className="px-4 py-2 text-right">Consumido (kg)</th>
                    <th className="px-4 py-2 text-right">Desvío (kg)</th>
                    <th className="px-4 py-2 text-right">Desvío %</th>
                    <th className="px-4 py-2 border-l"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.grupos.map((g: AluzincDetalleGroup) => {
                     const isWarning = g.warnings.length > 0;
                     return (
                       <tr key={g.key} className="hover:bg-gray-50 transition-colors">
                         <td className="px-4 py-3 font-bold">{g.color}</td>
                         <td className="px-4 py-3 text-right">{g.thicknessMm}</td>
                         <td className="px-4 py-3 text-right text-slate-500">{g.clientes.size}</td>

                         <td className="px-4 py-3 text-right border-l">{g.nVentas}</td>
                         <td className="px-4 py-3 text-right font-medium text-slate-700">{formatMoney(g.montoVentas)}</td>
                         <td className="px-4 py-3 text-right font-medium text-slate-700">{formatMoney(g.profitVentas)}</td>
                         <td className="px-4 py-3 text-right font-medium text-slate-700">{formatMoney(g.montoVentas - g.profitVentas)}</td>
                         <td className="px-4 py-3 text-right font-medium text-slate-700">
                           {g.montoVentas > 0 ? `${((g.profitVentas / g.montoVentas) * 100).toFixed(2)}%` : '—'}
                         </td>

                         <td className="px-4 py-3 text-right border-l">{g.mlProduced.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                         <td className="px-4 py-3 text-right">{g.piezas}</td>

                         <td className="px-4 py-3 text-right border-l text-slate-500">
                            {isWarning ? '—' : g.teoricoKg.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                         </td>
                         <td className="px-4 py-3 text-right text-slate-500">
                            {g.consumidoKg.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                         </td>
                         <td className="px-4 py-3 text-right font-medium">
                            {isWarning ? '—' : (
                              <span className={g.desvioKg > 0 ? 'text-red-600' : 'text-green-600'}>
                                {g.desvioKg > 0 ? '+' : ''}{g.desvioKg.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </span>
                            )}
                         </td>
                         <td className="px-4 py-3 text-right font-bold">
                            {isWarning ? '—' : (
                              <span className={g.desvioPct > 0 ? 'text-red-600' : 'text-green-600'}>
                                {g.desvioPct > 0 ? '+' : ''}{(g.desvioPct * 100).toFixed(2)}%
                              </span>
                            )}
                         </td>
                         
                         <td className="px-4 py-3 text-right border-l flex items-center justify-end gap-2">
                            <button
                               onClick={() => setSelectedGrupo(g)}
                               className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                            >
                               Ver detalle
                            </button>
                            <button
                               onClick={() => {
                                 import('./pdfExport').then(({ generateAluzincDetallePdf }) => {
                                   generateAluzincDetallePdf(
                                     { grupos: [g] }, 
                                     { 
                                       periodLabel: period,
                                       title: `REPORTE VENTAS vs PRODUCCIÓN — ALUZINC (${g.color} ${g.thicknessMm}mm)`,
                                       filename: `aluzinc_grupo_${g.color}_${g.thicknessMm}mm.pdf`,
                                       scope: 'single'
                                     }
                                   );
                                 });
                               }}
                               className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors"
                               title="Exportar PDF del grupo"
                            >
                               <Download size={16} />
                            </button>
                         </td>
                       </tr>
                     );
                  })}
                  {result.grupos.length === 0 && (
                     <tr>
                        <td colSpan={14} className="px-4 py-8 text-center text-slate-500 italic">No hay resultados para el período seleccionado.</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {selectedGrupo && (
        <AluzincDetalleModal
          grupo={selectedGrupo}
          onClose={() => setSelectedGrupo(null)}
        />
      )}
    </div>
  );
}
