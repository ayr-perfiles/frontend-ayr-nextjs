"use client";

import { useState } from "react";
import { PackageSearch, Search, X, AlertCircle } from "lucide-react";
import { useTradingStock, useTradingKpis } from "@/modules/trading/hooks/useTradingStock";
import InventoryTable from "@/modules/trading/components/inventory/InventoryTable";
import TradingKardexModal from "@/modules/trading/components/inventory/TradingKardexModal";
import TradingAdjustModal from "@/modules/trading/components/inventory/TradingAdjustModal";
import type { TradingCategory } from "@/modules/trading/types";
import type { InventoryFilters } from "@/modules/trading/services/inventoryService";

const CATEGORY_OPTIONS: TradingCategory[] = ['POLICARBONATO', 'TUBO', 'AUTOPERFORANTE', 'ACCESORIO', 'OTRO'];

export default function TradingInventoryPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<TradingCategory | "">("");
  const [showOnlyWithStock, setShowOnlyWithStock] = useState(false);
  const [showOnlyNegative, setShowOnlyNegative] = useState(false);

  const filters: InventoryFilters = {
    searchTerm: search || undefined,
    category: categoryFilter || undefined,
    showOnlyWithStock,
    showOnlyNegative,
  };

  const { items, loading, refresh } = useTradingStock(filters);
  const { kpis, loading: kpisLoading, refresh: refreshKpis } = useTradingKpis();

  const [adjustingSku, setAdjustingSku] = useState<string | null>(null);
  const [kardexSku, setKardexSku] = useState<string | null>(null);

  const selectedAdjustItem = items.find((i) => i.sku === adjustingSku);
  const selectedKardexItem = items.find((i) => i.sku === kardexSku);

  const handleRefresh = () => {
    refresh();
    refreshKpis();
  };

  const hasFilters = search || categoryFilter || showOnlyWithStock || showOnlyNegative;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 p-2.5 rounded-xl text-amber-700">
            <PackageSearch size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Inventario de Reventa</h1>
            <p className="text-sm text-gray-500 font-medium">Control de stock de productos de terceros</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Productos Activos</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-gray-900">{kpisLoading ? "..." : kpis?.totalProducts ?? 0}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Stock Total (Pzas/Mts)</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-amber-600">{kpisLoading ? "..." : kpis?.totalPieces.toLocaleString() ?? 0}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Alertas Negativas</p>
          <div className="flex items-baseline gap-2">
            <h3 className={`text-2xl font-black ${kpis?.negativeCount ? "text-red-600" : "text-gray-900"}`}>
              {kpisLoading ? "..." : kpis?.negativeCount ?? 0}
            </h3>
            {!!kpis?.negativeCount && <AlertCircle size={16} className="text-red-500" />}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por SKU o nombre…"
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm outline-none focus:border-amber-400 focus:bg-white transition"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as TradingCategory | "")}
            className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-amber-400 min-w-[150px]"
          >
            <option value="">Todas las categorías</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div className="flex items-center gap-4 ml-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox" checked={showOnlyWithStock}
                onChange={(e) => setShowOnlyWithStock(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-xs font-bold text-gray-600 group-hover:text-gray-900 transition">Solo con stock</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox" checked={showOnlyNegative}
                onChange={(e) => setShowOnlyNegative(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-xs font-bold text-red-600 group-hover:text-red-700 transition">Solo negativos</span>
            </label>
          </div>

          {hasFilters && (
            <button
              onClick={() => {
                setSearch("");
                setCategoryFilter("");
                setShowOnlyWithStock(false);
                setShowOnlyNegative(false);
              }}
              className="flex items-center gap-1 px-3 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition"
            >
              <X size={14} /> Limpiar
            </button>
          )}
        </div>
      </div>

      <InventoryTable
        items={items}
        loading={loading}
        onViewMovements={setKardexSku}
        onAdjust={setAdjustingSku}
      />

      {/* Modals */}
      {selectedKardexItem && (
        <TradingKardexModal
          item={selectedKardexItem}
          onClose={() => setKardexSku(null)}
        />
      )}

      {selectedAdjustItem && (
        <TradingAdjustModal
          item={selectedAdjustItem}
          onClose={() => setAdjustingSku(null)}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}
