import {
  TrendingUp,
  Package,
  AlertTriangle,
  DollarSign,
  FileText,
  BarChart3,
} from "lucide-react";

interface PrintableDashboardReportProps {
  data: any;
  periodLabel: string;
}

export const PrintableDashboardReport = ({
  data,
  periodLabel,
}: PrintableDashboardReportProps) => {
  if (!data) return null;

  return (
    <div
      className="bg-white p-10 max-w-[297mm] mx-auto text-gray-800 font-sans print:shadow-none print:p-0"
      style={{ minHeight: "210mm" }}
    >
      <style type="text/css" media="print">
        {`
          @page { size: landscape; margin: 10mm; } 
          body { -webkit-print-color-adjust: exact; background-color: white !important; }
          .no-print { display: none !important; }
        `}
      </style>

      {/* ENCABEZADO GERENCIAL */}
      <div className="border-b-4 border-blue-600 pb-6 mb-8 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={32} className="text-blue-600" />
            <h1 className="text-4xl font-black italic tracking-tighter">
              AYR STEEL
            </h1>
          </div>
          <h2 className="text-xl font-bold uppercase tracking-widest text-gray-500">
            Reporte de Gestión Operativa
          </h2>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-gray-400 uppercase">
            Periodo Reportado
          </p>
          <p className="text-lg font-black text-blue-900 uppercase">
            {periodLabel}
          </p>
          <p className="text-[10px] font-bold text-gray-400 mt-1">
            Generado el: {new Date().toLocaleString()}
          </p>
        </div>
      </div>

      {/* INDICADORES CLAVE (KPIs) */}
      <div className="grid grid-cols-4 gap-6 mb-10">
        {[
          {
            label: "Ventas del Día",
            value: `S/ ${data.todaySales.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
            color: "blue",
          },
          {
            label: "Ganancia Periodo",
            value: `S/ ${data.periodProfit.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
            color: "emerald",
          },
          {
            label: "Cotizaciones",
            value: `${data.pendingQuotes} Pendientes`,
            color: "orange",
          },
          {
            label: "Alertas Stock",
            value: `${data.lowStockItems.length} Críticos`,
            color: "red",
          },
        ].map((kpi, idx) => (
          <div
            key={idx}
            className={`border-2 border-${kpi.color}-100 bg-${kpi.color}-50/30 p-5 rounded-3xl text-center`}
          >
            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">
              {kpi.label}
            </p>
            <p className="text-2xl font-black text-gray-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-10">
        {/* TOP PRODUCTOS */}
        <div className="bg-gray-50/50 p-6 rounded-3xl border-2 border-gray-100">
          <h3 className="text-sm font-black text-gray-800 mb-6 flex items-center gap-2 border-b-2 pb-3 border-gray-100 uppercase">
            <Package size={18} className="text-blue-600" /> Rendimiento de
            Productos (Top 5)
          </h3>
          <div className="space-y-4">
            {data.topProductsChart.map((prod: any, index: number) => (
              <div
                key={index}
                className="flex justify-between items-center border-b border-gray-100 pb-2 last:border-0"
              >
                <span className="font-bold text-gray-700">
                  {index + 1}. {prod.sku}
                </span>
                <span className="font-black text-blue-600">
                  {prod.cantidad} Unidades
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ALERTAS CRÍTICAS */}
        <div className="bg-red-50/30 p-6 rounded-3xl border-2 border-red-100">
          <h3 className="text-sm font-black text-red-600 mb-6 flex items-center gap-2 border-b-2 pb-3 border-red-100 uppercase">
            <AlertTriangle size={18} /> Reposición de Stock Urgente
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {data.lowStockItems.slice(0, 10).map((item: any, index: number) => (
              <div
                key={index}
                className="bg-white p-3 rounded-xl border border-red-100 flex justify-between items-center"
              >
                <span className="text-xs font-black text-gray-800">
                  {item.sku}
                </span>
                <span className="text-xs font-bold text-red-600">
                  {item.quantity} und.
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-16 text-center">
        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">
          AYR STEEL - Sistema de Gestión Interna
        </p>
      </div>
    </div>
  );
};
