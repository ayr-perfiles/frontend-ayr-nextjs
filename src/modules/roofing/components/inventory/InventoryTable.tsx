"use client";

import { AlertTriangle, Clock, History, SlidersHorizontal } from "lucide-react";
import type { InventoryItem } from "../../services/inventoryService";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";

interface Props {
  items: InventoryItem[];
  loading: boolean;
  canEdit: boolean;
  onAdjust: (item: InventoryItem) => void;
  onViewMovements: (item: InventoryItem) => void;
}

const COLOR_CHIPS: Record<string, string> = {
  ROJO: "bg-red-100 text-red-700",
  AZUL: "bg-blue-100 text-blue-700",
  VERDE: "bg-green-100 text-green-700",
  BLANCO: "bg-gray-100 text-gray-700",
  GRIS: "bg-slate-100 text-slate-700",
};

function ColorChip({ color }: { color: string }) {
  const cls = COLOR_CHIPS[color] ?? "bg-purple-100 text-purple-700";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${cls}`}>
      {color || "—"}
    </span>
  );
}

function formatDate(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts) return "—";
  const date = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts as unknown as string);
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export default function InventoryTable({ items, loading, canEdit, onAdjust, onViewMovements }: Props) {
  if (loading) return <TableSkeleton rows={6} columns={7} />;

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <EmptyState
          icon="Package"
          title="Sin productos"
          description="No hay productos que coincidan con los filtros."
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70">
              <th className="text-left px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">SKU</th>
              <th className="text-left px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Producto</th>
              <th className="text-right px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Stock</th>
              <th className="text-right px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Costo prom.</th>
              <th className="text-right px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor total</th>
              <th className="text-center px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <Clock size={12} className="inline mr-1" />Actualización
              </th>
              <th className="text-center px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((item) => {
              const isNegative = item.quantity < 0;
              return (
                <tr
                  key={item.sku}
                  className={`hover:bg-gray-50/50 transition-colors ${isNegative ? "bg-red-50/30" : ""}`}
                >
                  {/* SKU */}
                  <td className="px-5 py-3.5">
                    <span className="font-black text-gray-800 tracking-tight">{item.sku}</span>
                  </td>

                  {/* Producto */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-700 leading-snug">
                        {item.product?.displayName ?? item.productName}
                      </span>
                      {item.product?.color && <ColorChip color={item.product.color} />}
                    </div>
                    {item.product && (
                      <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                        {item.product.material} · {item.product.length.toFixed(2)}m · {item.product.thickness}mm
                      </p>
                    )}
                  </td>

                  {/* Stock */}
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {isNegative && (
                        <AlertTriangle size={13} className="text-red-500 shrink-0" />
                      )}
                      <span className={`font-black text-base tabular-nums ${isNegative ? "text-red-600" : "text-gray-900"}`}>
                        {item.quantity.toLocaleString("es-PE")}
                      </span>
                      <span className="text-xs text-gray-400 font-medium">pzs</span>
                    </div>
                    {isNegative && (
                      <p className="text-[10px] text-red-500 font-bold text-right mt-0.5">Stock negativo</p>
                    )}
                  </td>

                  {/* Avg cost */}
                  <td className="px-5 py-3.5 text-right">
                    <span className="font-bold text-gray-700 tabular-nums">
                      {item.avgCost > 0 ? `S/ ${item.avgCost.toFixed(2)}` : "—"}
                    </span>
                  </td>

                  {/* Total value */}
                  <td className="px-5 py-3.5 text-right">
                    <span className={`font-bold tabular-nums ${isNegative ? "text-red-600" : "text-gray-700"}`}>
                      {item.avgCost > 0 ? `S/ ${item.totalValue.toFixed(2)}` : "—"}
                    </span>
                  </td>

                  {/* Last update */}
                  <td className="px-5 py-3.5 text-center">
                    <span className="text-xs text-gray-400 font-medium">{formatDate(item.lastUpdate)}</span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onViewMovements(item)}
                        title="Ver movimientos"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                      >
                        <History size={13} /> Historial
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => onAdjust(item)}
                          title="Ajustar stock"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                        >
                          <SlidersHorizontal size={13} /> Ajustar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
