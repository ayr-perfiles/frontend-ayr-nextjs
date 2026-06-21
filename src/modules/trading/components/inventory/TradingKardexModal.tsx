"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ExternalLink, TrendingUp, TrendingDown, SlidersHorizontal, ChevronDown } from "lucide-react";
import { getStockMovements, type StockMovement } from "../../services/inventoryService";
import type { InventoryItem } from "../../services/inventoryService";

interface Props {
  item: InventoryItem;
  onClose: () => void;
}

type MovementTypeFilter = "" | "ENTRADA" | "SALIDA" | "AJUSTE";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  ENTRADA: <TrendingUp size={13} className="text-emerald-600" />,
  SALIDA: <TrendingDown size={13} className="text-red-500" />,
  AJUSTE: <SlidersHorizontal size={13} className="text-blue-500" />,
};

const TYPE_LABEL: Record<string, string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE: "Ajuste",
};

const TYPE_BADGE: Record<string, string> = {
  ENTRADA: "bg-emerald-100 text-emerald-700",
  SALIDA: "bg-red-100 text-red-700",
  AJUSTE: "bg-blue-100 text-blue-700",
};

function formatTs(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts) return "—";
  const date = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts as unknown as string);
  return date.toLocaleString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function extractSaleRef(reason: string): string | null {
  const match = reason.match(/saleId:\s*([^\s,]+)/i) ?? reason.match(/#([A-Z0-9-]+)/);
  return match ? match[1] : null;
}

export default function TradingKardexModal({ item, onClose }: Props) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<MovementTypeFilter>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await getStockMovements(item.sku, {
        type: typeFilter || undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });
      setMovements(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar movimientos.");
      console.error("[TradingKardexModal]", err);
    } finally {
      setLoading(false);
    }
  }, [item.sku, typeFilter, startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const hasFilters = typeFilter || startDate || endDate;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-amber-600 text-white flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-lg font-black">Historial de Movimientos (Reventa)</h2>
            <p className="text-amber-100 text-xs font-bold mt-0.5">
              {item.sku} · {item.product?.displayName ?? item.productName}
            </p>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition">
            <X size={18} />
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-gray-100 shrink-0">
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as MovementTypeFilter)}
                className="appearance-none pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-xs outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="">Todos los tipos</option>
                <option value="ENTRADA">Entrada</option>
                <option value="SALIDA">Salida</option>
                <option value="AJUSTE">Ajuste</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <input
              type="date" value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium text-xs outline-none focus:border-amber-400"
            />
            <span className="self-center text-xs text-gray-400">—</span>
            <input
              type="date" value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium text-xs outline-none focus:border-amber-400"
            />

            {hasFilters && (
              <button
                onClick={() => { setTypeFilter(""); setStartDate(""); setEndDate(""); }}
                className="px-3 py-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {loading && (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse flex gap-3">
                  <div className="h-4 bg-gray-100 rounded w-20" />
                  <div className="h-4 bg-gray-100 rounded w-16" />
                  <div className="h-4 bg-gray-100 rounded flex-1" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="p-6">
              <p className="text-sm font-medium text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && movements.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-gray-400 font-medium text-sm">No hay movimientos para los filtros seleccionados.</p>
            </div>
          )}

          {!loading && !error && movements.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50/90 backdrop-blur-sm border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo</th>
                  <th className="text-right px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cantidad</th>
                  <th className="text-right px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Costo unit.</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Motivo</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Usuario</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {movements.map((mv) => {
                  const isSale = mv.reason?.toLowerCase().includes("venta") || mv.reason?.toLowerCase().includes("sale");
                  const saleRef = isSale ? extractSaleRef(mv.reason) : null;

                  return (
                    <tr key={mv.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-gray-500 font-medium whitespace-nowrap">
                        {formatTs(mv.createdAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${TYPE_BADGE[mv.type] ?? "bg-gray-100 text-gray-600"}`}>
                          {TYPE_ICONS[mv.type]}
                          {TYPE_LABEL[mv.type] ?? mv.type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`font-black tabular-nums ${mv.type === "ENTRADA" ? "text-emerald-700" : mv.type === "SALIDA" ? "text-red-600" : "text-blue-700"}`}>
                          {mv.type === "ENTRADA" ? "+" : mv.type === "SALIDA" ? "−" : "±"}{mv.quantity.toLocaleString("es-PE")}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-gray-500 font-medium tabular-nums">
                        {mv.costPerUnit > 0 ? `S/ ${mv.costPerUnit.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-600 font-medium max-w-[200px] truncate" title={mv.reason}>
                        {mv.reason || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400 font-medium">
                        {mv.createdBy}
                      </td>
                      <td className="px-5 py-3.5">
                        {saleRef && (
                          <a
                            href={`/admin/sales/${saleRef}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-700 text-xs font-bold transition"
                            title="Ver venta original"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {!loading && movements.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 shrink-0">
            <p className="text-xs text-gray-400 font-medium">
              {movements.length} movimiento{movements.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
