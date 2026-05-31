"use client";

import { useState } from "react";
import {
  Layers,
  Search,
  X,
  AlertTriangle,
  Package,
  TrendingDown,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { InventoryItem } from "@/modules/metallic-roofing/services/inventoryService";
import { useMetallicStock } from "@/modules/metallic-roofing/hooks/useMetallicStock";
import InventoryTable from "@/modules/metallic-roofing/components/inventory/InventoryTable";
import StockAdjustmentModal from "@/modules/metallic-roofing/components/inventory/StockAdjustmentModal";
import MovementsHistoryModal from "@/modules/metallic-roofing/components/inventory/MovementsHistoryModal";

const FAMILY_OPTIONS = ["COBERTURA", "PLANCHA", "BOBINA", "ACCESORIO"];
const FINISH_OPTIONS = ["GALV", "ALUZINC", "NATURAL", "PREPINTADO"];

export default function MetallicRoofingInventoryPage() {
  const { role, user } = useAuth();
  const canEdit = role === "ADMIN" || role === "SUPERVISOR";

  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("");
  const [finishFilter, setFinishFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [showOnlyWithStock, setShowOnlyWithStock] = useState(false);
  const [showOnlyNegative, setShowOnlyNegative] = useState(false);

  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [viewingMovements, setViewingMovements] = useState<InventoryItem | null>(null);

  const { items, kpis, loading, error, refresh } = useMetallicStock({
    searchTerm: search,
    family: familyFilter,
    finish: finishFilter,
    color: colorFilter,
    showOnlyWithStock,
    showOnlyNegative,
  });

  function clearFilters() {
    setSearch("");
    setFamilyFilter("");
    setFinishFilter("");
    setColorFilter("");
    setShowOnlyWithStock(false);
    setShowOnlyNegative(false);
  }

  const hasFilters = search || familyFilter || finishFilter || colorFilter || showOnlyWithStock || showOnlyNegative;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-zinc-100 p-2.5 rounded-xl">
            <Layers className="text-zinc-700" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Inventario Aluzinc</h1>
            <p className="text-sm text-gray-500 font-medium">
              {loading ? "Cargando…" : `${items.length} producto${items.length !== 1 ? "s" : ""} mostrados`}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Total productos"
          value={kpis.totalProducts.toString()}
          icon={<Layers size={18} className="text-zinc-600" />}
          bg="bg-zinc-50"
        />
        <KpiCard
          label="Total unidades en stock"
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

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por SKU o nombre…"
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm outline-none focus:border-zinc-400 focus:bg-white transition"
            />
          </div>

          {/* Family */}
          <div className="relative">
            <select
              value={familyFilter}
              onChange={(e) => setFamilyFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-zinc-400 min-w-[140px] cursor-pointer"
            >
              <option value="">Toda familia</option>
              {FAMILY_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Finish */}
          <div className="relative">
            <select
              value={finishFilter}
              onChange={(e) => setFinishFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-zinc-400 min-w-[140px] cursor-pointer"
            >
              <option value="">Todo acabado</option>
              {FINISH_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Color */}
          <input
            type="text"
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value.toUpperCase())}
            placeholder="Color…"
            className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-zinc-400 w-28"
          />

          <button
            onClick={() => setShowOnlyWithStock((v) => !v)}
            className={`px-3 py-2.5 rounded-xl border font-bold text-xs transition whitespace-nowrap ${
              showOnlyWithStock
                ? "bg-zinc-700 text-white border-zinc-700"
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

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 font-medium text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <InventoryTable
        items={items}
        loading={loading}
        canEdit={canEdit}
        onAdjust={setAdjustingItem}
        onViewMovements={setViewingMovements}
      />

      {/* Modals */}
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
