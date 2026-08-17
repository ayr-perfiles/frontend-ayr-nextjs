"use client";

import { X, ShoppingCart, DollarSign, AlertTriangle, Package } from "lucide-react";
import type { Sale } from "@/types";
import type { QueueRow } from "@/core/production/queueLogic";
import { buildQuoteDetailView, formatQuoteDisplayId } from "@/core/production/queueLogic";
import { isImportedQuotation } from "@/core/import/salesImportLogic";

interface QuoteDetailsReadOnlyProps {
  sale: Sale;
  queueRow: QueueRow;
  onClose: () => void;
}

export function QuoteDetailsReadOnly({ sale, queueRow, onClose }: QuoteDetailsReadOnlyProps) {
  const view = buildQuoteDetailView(sale, queueRow);
  const imported = isImportedQuotation(sale);

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="flex flex-col bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden animate-in fade-in zoom-in-95">
        {/* CABECERA */}
        <div className="p-6 bg-slate-800 text-white flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-black">{formatQuoteDisplayId(sale.id || "")}</h2>
              {imported && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black tracking-widest flex items-center gap-1 bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  IMPORTADA
                </span>
              )}
            </div>
            <p className="text-slate-400 text-xs font-medium">{sale.customerName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-700 p-2 rounded-full transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* CUERPO */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2 mb-4">
              <ShoppingCart size={16} className="text-blue-500" /> Líneas de la Cotización
            </h3>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-500 uppercase">
                  <tr>
                    <th className="p-3">Producto</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3 text-center">Solicitado</th>
                    <th className="p-3 text-center">Producido</th>
                    <th className="p-3 text-center">Pendiente</th>
                    <th className="p-3 text-right">P. Unit.</th>
                    <th className="p-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {view.rows.map((row, idx) => {
                    const pending = Math.max(0, row.quantityRequested - row.producedForSku);
                    return (
                      <tr key={idx} className="hover:bg-gray-50/50 transition">
                        <td className="p-3 font-medium text-gray-700">
                          <div className="flex items-center gap-1.5">
                            {row.productName}
                            {row.isSharedSku && (
                              <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-bold text-gray-800">{row.sku}</td>
                        <td className="p-3 text-center text-gray-600">
                          {row.piecesCount && row.pieceLengthM ? (
                            <span className="whitespace-nowrap">
                              {row.piecesCount} pzs &times; {row.pieceLengthM} m = {row.quantityRequested} ML
                            </span>
                          ) : (
                            row.quantityRequested
                          )}
                        </td>
                        <td className="p-3 text-center text-gray-600">{row.producedForSku}</td>
                        <td className="p-3 text-center text-gray-600">{pending}</td>
                        <td className="p-3 text-right text-gray-600">{formatMoney(row.unitPrice)}</td>
                        <td className="p-3 text-right font-bold text-gray-800">
                          {formatMoney(row.lineSubtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {view.hasSharedSku && (
              <p className="text-xs text-amber-600 font-medium mt-3 flex items-center gap-1.5">
                <AlertTriangle size={14} className="shrink-0" />
                Producido agrupado por producto: la producción no distingue TR4/TR5 dentro del mismo SKU.
              </p>
            )}

            {view.rows.length === 0 && (
              <div className="text-center py-8 text-slate-400 flex flex-col items-center gap-2">
                <Package size={24} />
                <p className="text-sm font-medium">Esta cotización no tiene líneas.</p>
              </div>
            )}
          </div>

          {/* RESUMEN FINANCIERO (solo venta, sin costo/margen) */}
          <div>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2 mb-4">
              <DollarSign size={16} className="text-emerald-500" /> Resumen
            </h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
              <span className="text-sm font-black text-slate-800 uppercase tracking-widest">
                Total Cotización
              </span>
              <span className="font-black text-2xl text-blue-600">{formatMoney(view.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
