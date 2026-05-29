"use client";

import React from "react";
import { Search, History, Settings2, AlertCircle } from "lucide-react";
import type { InventoryItem } from "../../services/inventoryService";

interface InventoryTableProps {
  items: InventoryItem[];
  loading: boolean;
  onViewMovements: (sku: string) => void;
  onAdjust: (sku: string) => void;
}

export default function InventoryTable({
  items,
  loading,
  onViewMovements,
  onAdjust,
}: InventoryTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <div className="inline-flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-sm font-medium">Cargando inventario…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="w-full overflow-x-auto min-h-[250px]">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50/80 border-b border-gray-100">
            <tr>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">SKU</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Producto</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Stock</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Costo Prom.</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Valor Total</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((item) => (
              <tr key={item.sku} className="group hover:bg-amber-50/20 transition-colors">
                <td className="p-4">
                  <span className="font-black font-mono text-sm text-amber-800">{item.sku}</span>
                </td>
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-800">{item.productName}</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                      {item.product?.category}
                    </span>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <div className="flex flex-col items-end">
                    <span className={`text-sm font-black ${item.quantity < 0 ? "text-red-600" : "text-gray-900"}`}>
                      {item.quantity.toLocaleString()}
                    </span>
                    {item.quantity < 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-500">
                        <AlertCircle size={10} /> Stock negativo
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4 text-right">
                  <span className="text-sm font-medium text-gray-600">
                    S/ {item.avgCost.toFixed(2)}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <span className="text-sm font-black text-gray-900">
                    S/ {item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onViewMovements(item.sku)}
                      className="p-2 text-gray-400 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition"
                      title="Ver movimientos (Kardex)"
                    >
                      <History size={16} />
                    </button>
                    <button
                      onClick={() => onAdjust(item.sku)}
                      className="p-2 text-gray-400 hover:bg-amber-100 hover:text-amber-700 rounded-lg transition"
                      title="Ajuste manual"
                    >
                      <Settings2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4 text-gray-400">
                    <Search size={24} />
                  </div>
                  <h3 className="text-gray-900 font-bold text-lg">Sin resultados</h3>
                  <p className="text-gray-500 mt-1 font-medium">No se encontraron productos en inventario.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
