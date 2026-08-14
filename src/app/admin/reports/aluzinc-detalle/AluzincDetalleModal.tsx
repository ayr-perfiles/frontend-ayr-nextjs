"use client";

import React from "react";
import { X, ShoppingCart, Factory, AlertTriangle } from "lucide-react";
import { AluzincDetalleGroup } from "@/core/reports/aluzincDetalleLogic";

interface AluzincDetalleModalProps {
  grupo: AluzincDetalleGroup;
  onClose: () => void;
}

export function AluzincDetalleModal({ grupo, onClose }: AluzincDetalleModalProps) {
  const formatMoney = (amount: number) =>
    new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount);

  const isWarning = grupo.warnings.length > 0;

  const sumCant = grupo.ventasDetalle.reduce((sum, v) => sum + v.quantity, 0);
  const sumVenta = grupo.ventasDetalle.reduce((sum, v) => sum + v.ventaTotal, 0);
  const sumCostoVenta = grupo.ventasDetalle.reduce((sum, v) => sum + v.costoTotal, 0);
  const margenPct = sumVenta > 0 ? ((sumVenta - sumCostoVenta) / sumVenta) * 100 : 0;

  const sumMl = grupo.logsDetalle.reduce((sum, l) => sum + l.mlProduced, 0);
  const sumConsumo = grupo.logsDetalle.reduce((sum, l) => sum + l.consumoKg, 0);
  const sumCostoProd = grupo.logsDetalle.reduce((sum, l) => sum + l.costoProdPEN, 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="flex flex-col bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-6 bg-slate-800 text-white flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-black">
                {grupo.color} - {grupo.thicknessMm}mm
              </h2>
            </div>
            <p className="text-slate-300 text-sm">
              Detalle de {grupo.nVentas} ventas y {grupo.nLogs} registros de producción.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 p-2 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-8 custom-scrollbar">
          {isWarning && (
             <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex flex-col gap-1">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                  <span>Advertencias en este grupo</span>
                </div>
                <ul className="list-disc pl-8 text-sm">
                  {grupo.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                </ul>
             </div>
          )}

          <div>
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
              <ShoppingCart size={16} className="text-blue-500" />
              Desglose de Ventas
            </h3>
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-700 border-b">
                    <tr>
                      <th className="px-4 py-3">DOCUMENTO</th>
                      <th className="px-4 py-3">CLIENTE</th>
                      <th className="px-4 py-3">COTIZACIÓN</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3 text-right">CANT</th>
                      <th className="px-4 py-3 text-right">V.UNIT</th>
                      <th className="px-4 py-3 text-right">VENTA S/</th>
                      <th className="px-4 py-3 text-right">C.UNIT</th>
                      <th className="px-4 py-3 text-right">COSTO S/</th>
                      <th className="px-4 py-3 text-right">MARGEN %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {grupo.ventasDetalle.map((v, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-slate-600">{v.documentNumber}</td>
                        <td className="px-4 py-3">{v.customerName}</td>
                        <td className="px-4 py-3 text-slate-500">{v.cotizacion}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {v.sku}
                            {v.costSource !== 'PRODUCTION' && (
                              <span title={`Costo Fuente: ${v.costSource}`}>
                                <AlertTriangle size={14} className="text-amber-500" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">{v.quantity}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{formatMoney(v.unitValue)}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{formatMoney(v.ventaTotal)}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{formatMoney(v.cUnit)}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{formatMoney(v.costoTotal)}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">
                          {v.ventaTotal > 0 ? `${(((v.ventaTotal - v.costoTotal) / v.ventaTotal) * 100).toFixed(2)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                    {grupo.ventasDetalle.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-6 text-center text-slate-500 italic">No hay ventas en este grupo.</td>
                      </tr>
                    )}
                  </tbody>
                  {grupo.ventasDetalle.length > 0 && (
                    <tfoot className="bg-slate-50 border-t font-black text-slate-700">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right uppercase text-xs tracking-widest text-slate-400">Total</td>
                        <td className="px-4 py-3 text-right">{sumCant}</td>
                        <td></td>
                        <td className="px-4 py-3 text-right">{formatMoney(sumVenta)}</td>
                        <td></td>
                        <td className="px-4 py-3 text-right">{formatMoney(sumCostoVenta)}</td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan={9} className="px-4 py-2 text-right uppercase text-xs tracking-widest text-slate-400">Margen</td>
                        <td className="px-4 py-2 text-right text-green-600">
                          {margenPct.toFixed(2)}%
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
              <Factory size={16} className="text-orange-500" />
              Desglose de Producción
            </h3>
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-700 border-b">
                    <tr>
                      <th className="px-4 py-3">DOCUMENTO</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3 text-right">ML PROD</th>
                      <th className="px-4 py-3 text-right">CONSUMO KG</th>
                      <th className="px-4 py-3 text-right">COSTO PROD S/</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {grupo.logsDetalle.map((l, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-slate-600">{l.documentId}</td>
                        <td className="px-4 py-3">{l.sku}</td>
                        <td className="px-4 py-3 text-right">{l.mlProduced.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        <td className="px-4 py-3 text-right">{l.consumoKg.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{formatMoney(l.costoProdPEN)}</td>
                      </tr>
                    ))}
                    {grupo.logsDetalle.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">No hay logs de producción en este grupo.</td>
                      </tr>
                    )}
                  </tbody>
                  {grupo.logsDetalle.length > 0 && (
                    <tfoot className="bg-slate-50 border-t font-black text-slate-700">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-right uppercase text-xs tracking-widest text-slate-400">Total</td>
                        <td className="px-4 py-3 text-right">{sumMl.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        <td className="px-4 py-3 text-right">{sumConsumo.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        <td className="px-4 py-3 text-right">{formatMoney(sumCostoProd)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500 text-center max-w-3xl mx-auto">
              * VOIDED excluidos. El reporte costea lo VENDIDO (costo base de venta), no lo producido; este bloque es la procedencia del material.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
