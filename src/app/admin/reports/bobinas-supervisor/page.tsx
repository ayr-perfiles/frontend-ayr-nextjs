"use client";

import { useEffect, useState } from 'react';
import { useCoils } from '@/core/coils/hooks/useCoils';
import { useFinishes } from '@/core/coils/hooks/useFinishes';
import { getFinishMeta } from '@/core/coils/services/finishService';
import { buildSupervisorReport, SupervisorReportResult, normalizeInvoiceDate } from '@/core/reports/bobinasSupervisorLogic';
import { Loader2, ArrowLeft, Download, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function BobinasSupervisorPage() {
  const router = useRouter();
  const { coils, loading: coilsLoading } = useCoils({ searchTerm: '', statusFilter: 'ALL', startDate: '', endDate: '', pageSize: 9999 });
  const { finishes, loading: finishesLoading } = useFinishes(false);
  
  const [report, setReport] = useState<SupervisorReportResult | null>(null);
  const [metrajeZeroCount, setMetrajeZeroCount] = useState(0);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [monthFilter, setMonthFilter] = useState('ALL');

  useEffect(() => {
    if (coilsLoading || finishesLoading) return;

    const months = new Set<string>();
    coils.forEach(c => {
      const d = normalizeInvoiceDate(c.metadata?.invoiceDate);
      if (d) {
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        months.add(`${yyyy}-${mm}`);
      }
    });
    setAvailableMonths(Array.from(months).sort().reverse());

    const finishesMap: Record<string, any> = {};
    for (const f of finishes) {
      const meta = getFinishMeta(f.id, finishes);
      finishesMap[f.id] = { ...meta, densityFactor: f.densityFactor };
    }

    const res = buildSupervisorReport(coils, finishesMap, monthFilter);
    setReport(res);

    const zeros = [...res.abiertas, ...res.cerradas].filter(r => r.metrajeML === 0).length;
    setMetrajeZeroCount(zeros);
  }, [coils, finishes, coilsLoading, finishesLoading, monthFilter]);

  const handleExport = async () => {
    if (!report) return;
    const { generateBobinasSupervisorPdf } = await import('./pdfExport');
    
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const corteLabel = `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    
    generateBobinasSupervisorPdf(report, { corteLabel });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '—';
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy}`;
  };

  if (coilsLoading || finishesLoading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 pb-20">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/reports')} className="text-gray-500 hover:bg-gray-100 p-2 rounded-xl">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Reporte de Bobinas (Supervisor)</h1>
        </div>
        <button
          onClick={handleExport}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-colors"
        >
          <Download size={18} />
          Exportar PDF
        </button>
      </div>

      <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <label className="block text-sm font-semibold text-slate-700 mb-2">Mes (fecha de factura)</label>
        <select 
          className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-64 p-2.5 outline-none"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
        >
          <option value="ALL">Todos</option>
          {availableMonths.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {metrajeZeroCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl mb-6 flex gap-3 items-center">
          <AlertTriangle className="text-amber-500 shrink-0" size={20} />
          <p className="text-sm font-medium">
            Advertencia: Hay {metrajeZeroCount} fila(s) con metraje 0 debido a falta de factor de densidad, espesor o ancho.
          </p>
        </div>
      )}

      {report && (
        <div className="space-y-8">
          <Section title="BOBINAS ABIERTAS" rows={report.abiertas} sub={report.subAbiertas} formatDate={formatDate} colorClass="bg-blue-600" />
          <Section title="BOBINAS CERRADAS" rows={report.cerradas} sub={report.subCerradas} formatDate={formatDate} colorClass="bg-slate-600" />
        </div>
      )}
    </div>
  );
}

function Section({ title, rows, sub, formatDate, colorClass }: any) {
  if (rows.length === 0) return (
    <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
      <div className={`${colorClass} text-white font-bold px-4 py-3`}>{title}</div>
      <div className="p-4 text-gray-500 text-center italic">No hay registros</div>
    </div>
  );

  return (
    <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
      <div className={`${colorClass} text-white font-bold px-4 py-3`}>{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-700 border-b">
            <tr>
              <th className="px-4 py-3">UND</th>
              <th className="px-4 py-3 text-right">ESPESOR (mm)</th>
              <th className="px-4 py-3 text-right">ANCHO (m)</th>
              <th className="px-4 py-3">ACABADO</th>
              <th className="px-4 py-3">PROVEEDOR</th>
              <th className="px-4 py-3">EMPRESA</th>
              <th className="px-4 py-3 text-right">PESO (kg)</th>
              <th className="px-4 py-3 text-right">METRAJE (m)</th>
              <th className="px-4 py-3">FECHA</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r: any) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{r.und}</td>
                <td className="px-4 py-3 text-right">{r.espesorMm}</td>
                <td className="px-4 py-3 text-right">{r.anchoM.toFixed(3)}</td>
                <td className="px-4 py-3 font-medium text-xs text-slate-600">{r.acabado}</td>
                <td className="px-4 py-3 truncate max-w-[200px]" title={r.proveedor}>{r.proveedor}</td>
                <td className="px-4 py-3">{r.empresa}</td>
                <td className="px-4 py-3 text-right font-medium">{r.pesoKg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right font-medium">{r.metrajeML.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(r.fechaFactura)}</td>
              </tr>
            ))}
            <tr className="bg-gray-100 font-bold">
              <td className="px-4 py-3">{sub.count}</td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3">SUBTOTAL</td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 text-right">{sub.pesoKg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="px-4 py-3 text-right">{sub.metrajeML.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="px-4 py-3"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
