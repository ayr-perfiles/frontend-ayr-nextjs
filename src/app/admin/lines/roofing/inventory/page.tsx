"use client";

import { useState } from "react";
import {
  Package,
  Search,
  X,
  AlertTriangle,
  Layers,
  TrendingDown,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { InventoryItem } from "@/modules/roofing/services/inventoryService";
import type { RoofingMaterial } from "@/modules/roofing/types";
import { useRoofingStock } from "@/modules/roofing/hooks/useRoofingStock";
import InventoryTable from "@/modules/roofing/components/inventory/InventoryTable";
import StockAdjustmentModal from "@/modules/roofing/components/inventory/StockAdjustmentModal";
import MovementsHistoryModal from "@/modules/roofing/components/inventory/MovementsHistoryModal";

const MATERIAL_OPTIONS: RoofingMaterial[] = ["UPVC", "ACERO_GALV", "POLICARBONATO"];

export default function RoofingInventoryPage() {
  const { role, user } = useAuth();
  const canEdit = role === "ADMIN" || role === "SUPERVISOR";

  const [search, setSearch] = useState("");
  const [materialFilter, setMaterialFilter] = useState<RoofingMaterial | "">("");
  const [colorFilter, setColorFilter] = useState("");
  const [showOnlyWithStock, setShowOnlyWithStock] = useState(false);
  const [showOnlyNegative, setShowOnlyNegative] = useState(false);

  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [viewingMovements, setViewingMovements] = useState<InventoryItem | null>(null);

  const { items, kpis, loading, error, refresh } = useRoofingStock({
    searchTerm: search,
    material: materialFilter,
    color: colorFilter,
    showOnlyWithStock,
    showOnlyNegative,
  });

  function clearFilters() {
    setSearch("");
    setMaterialFilter("");
    setColorFilter("");
    setShowOnlyWithStock(false);
    setShowOnlyNegative(false);
  }

  const hasFilters = search || materialFilter || colorFilter || showOnlyWithStock || showOnlyNegative;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-2.5 rounded-xl">
            <Package className="text-emerald-700" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Inventario PVC</h1>
            <p className="text-sm text-gray-500 font-medium">
              {loading ? "Cargando…" : `${items.length} producto${items.length !== 1 ? "s" : ""} mostrados`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Total productos"
          value={kpis.totalProducts.toString()}
          icon={<Layers size={18} className="text-emerald-600" />}
          bg="bg-emerald-50"
        />
        <KpiCard
          label="Total piezas en stock"
          value={kpis.totalPieces.toLocaleString("es-PE")}
          icon={<Package size={18} className="text-blue-600" />}
          bg="bg-blue-50"
        />
        <KpiCard
          label="Productos en negativo"
          value={kpis.negativeCount.toString()}
          icon={<TrendingDown size={18} className="text-red-500" />}
          bg={kpis.negativeCount > 0 ? "bg-red-50" : "bg-gray-50"}
          valueColor={kpis.negativeCount > 0 ? "text-red-600" : "text-gray-700"}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por SKU o nombre…"
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm outline-none focus:border-emerald-400 focus:bg-white transition"
            />
          </div>

          <div className="relative">
            <select
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value as RoofingMaterial | "")}
              className="appearance-none pl-3 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-400 min-w-[150px] cursor-pointer"
            >
              <option value="">Todo material</option>
              {MATERIAL_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <input
            type="text"
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value.toUpperCase())}
            placeholder="Color…"
            className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-400 w-28"
          />

          <button
            onClick={() => setShowOnlyWithStock((v) => !v)}
            className={`px-3 py-2.5 rounded-xl border font-bold text-xs transition whitespace-nowrap ${
              showOnlyWithStock
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300"
            }`}
          >
            Con stock
          </button>

          <button
            onClick={() => setShowOnlyNegative((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border font-bold text-xs transition whitespace-nowrap ${
              showOnlyNegative
                ? "bg-red-600 text-white border-red-600"
                : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300"
            }`}
          >
            <AlertTriangle size={12} /> Solo negativos
          </button>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition whitespace-nowrap"
            >
              <X size={14} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 font-medium text-sm">
          {error}
        </div>
      )}

      <InventoryTable
        items={items}
        loading={loading}
        canEdit={canEdit}
        onAdjust={setAdjustingItem}
        onViewMovements={setViewingMovements}
      />

      {adjustingItem && (
        <StockAdjustmentModal
          item={adjustingItem}
          performedBy={user?.email ?? "sistema"}
          onClose={() => setAdjustingItem(null)}
          onSuccess={() => { setAdjustingItem(null); void refresh(); }}
        />
      )}

      {viewingMovements && (
        <MovementsHistoryModal item={viewingMovements} onClose={() => setViewingMovements(null)} />
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  bg,
  valueColor = "text-gray-900",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  bg: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`${bg} p-3 rounded-xl shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{label}</p>
        <p className={`text-2xl font-black tabular-nums mt-0.5 ${valueColor}`}>{value}</p>
      </div>
    </div>
  );
}
