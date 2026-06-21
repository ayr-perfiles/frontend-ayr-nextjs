"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Layers,
  AlertTriangle,
  Package,
  TrendingDown,
  History,
  SlidersHorizontal,
  Clock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { InventoryItem } from "@/modules/metallic-roofing/services/inventoryService";
import { useMetallicStock } from "@/modules/metallic-roofing/hooks/useMetallicStock";
import { KpiCard } from "@/components/ui/KpiCard";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";
import { TableFilters, FilterGroup } from "@/components/ui/TableFilters";
import { TablePagination } from "@/components/ui/TablePagination";
import { RowActionsMenu, RowAction } from "@/components/ui/RowActionsMenu";
import StockAdjustmentModal from "@/modules/metallic-roofing/components/inventory/StockAdjustmentModal";
import MovementsHistoryModal from "@/modules/metallic-roofing/components/inventory/MovementsHistoryModal";

const FAMILY_OPTIONS = ["COBERTURA", "PLANCHA", "ACCESORIO"];
const FINISH_OPTIONS = ["GALV", "ALUZINC", "NATURAL", "PREPINTADO"];

const COLOR_CHIPS: Record<string, string> = {
  ROJO: "bg-red-100 text-red-700",
  AZUL: "bg-blue-100 text-blue-700",
  VERDE: "bg-green-100 text-green-700",
  BLANCO: "bg-gray-100 text-gray-700",
  GRIS: "bg-slate-100 text-slate-700",
};

function ColorChip({ color }: { color: string }) {
  const cls = COLOR_CHIPS[color] ?? "bg-zinc-100 text-zinc-700";
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

export default function MetallicRoofingInventoryPage() {
  const { role, user } = useAuth();
  const canEdit = role === "ADMIN" || role === "SUPERVISOR";

  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("");
  const [finishFilter, setFinishFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [showOnlyWithStock, setShowOnlyWithStock] = useState(false);
  const [showOnlyNegative, setShowOnlyNegative] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [search, familyFilter, finishFilter, colorFilter, showOnlyWithStock, showOnlyNegative]);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  function clearFilters() {
    setSearch("");
    setFamilyFilter("");
    setFinishFilter("");
    setColorFilter("");
    setShowOnlyWithStock(false);
    setShowOnlyNegative(false);
  }

  const columns: ColumnDef<InventoryItem>[] = [
    {
      key: "sku",
      header: "SKU",
      render: (item) => <span className="font-black text-gray-800 tracking-tight">{item.sku}</span>,
    },
    {
      key: "product",
      header: "Producto",
      render: (item) => (
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-700 leading-snug">
              {item.product?.displayName ?? item.productName}
            </span>
            {item.product?.color && <ColorChip color={item.product.color} />}
          </div>
          {item.product && (
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">
              {item.product.family} · {item.product.finish} · {item.product.thickness}mm
              {item.product.length != null && ` · ${item.product.length.toFixed(2)}m`}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      render: (item) => {
        const isNegative = item.quantity < 0;
        return (
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5">
              {isNegative && <AlertTriangle size={13} className="text-red-500 shrink-0" />}
              <span className={`font-black text-base tabular-nums ${isNegative ? "text-red-600" : "text-gray-900"}`}>
                {item.quantity.toLocaleString("es-PE")}
              </span>
              <span className="text-xs text-gray-400 font-medium">{item.product?.unit ?? "u"}</span>
            </div>
            {isNegative && <p className="text-[10px] text-red-500 font-bold mt-0.5">Stock negativo</p>}
          </div>
        );
      },
    },
    {
      key: "avgCost",
      header: "Costo prom.",
      align: "right",
      render: (item) => (
        <span className="font-bold text-gray-700 tabular-nums">
          {item.avgCost > 0 ? `S/ ${item.avgCost.toFixed(2)}` : "—"}
        </span>
      ),
    },
    {
      key: "totalValue",
      header: "Valor total",
      align: "right",
      render: (item) => (
        <span className={`font-bold tabular-nums ${item.quantity < 0 ? "text-red-600" : "text-gray-700"}`}>
          {item.avgCost > 0 ? `S/ ${item.totalValue.toFixed(2)}` : "—"}
        </span>
      ),
    },
    {
      key: "lastUpdate",
      header: (
        <div className="flex items-center justify-center gap-1">
          <Clock size={12} /> Actualización
        </div>
      ),
      align: "center",
      render: (item) => <span className="text-xs text-gray-400 font-medium">{formatDate(item.lastUpdate)}</span>,
    },
    {
      key: "actions",
      header: "Acciones",
      align: "center",
      render: (item) => {
        const actions: RowAction[] = [
          {
            id: "history",
            label: "Historial",
            icon: <History size={16} />,
            onClick: () => setViewingMovements(item),
          },
          {
            id: "adjust",
            label: "Ajustar",
            icon: <SlidersHorizontal size={16} />,
            onClick: () => setAdjustingItem(item),
            hidden: !canEdit,
          },
        ];
        return <RowActionsMenu items={actions} />;
      },
    },
  ];

  const filterGroups: FilterGroup[] = [
    {
      id: "family",
      label: "Familia",
      layout: "grid",
      value: familyFilter,
      onChange: setFamilyFilter,
      options: [
        { value: "", label: "Toda familia" },
        ...FAMILY_OPTIONS.map((f) => ({ value: f, label: f })),
      ],
    },
    {
      id: "finish",
      label: "Acabado",
      layout: "grid",
      value: finishFilter,
      onChange: setFinishFilter,
      options: [
        { value: "", label: "Todo acabado" },
        ...FINISH_OPTIONS.map((f) => ({ value: f, label: f })),
      ],
    },
  ];

  const extraContent = (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Color</label>
        <input
          type="text"
          value={colorFilter}
          onChange={(e) => setColorFilter(e.target.value.toUpperCase())}
          placeholder="Color…"
          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 text-slate-700 text-sm font-bold rounded-xl outline-none focus:border-zinc-500 focus:ring-4 focus:ring-zinc-50 transition shadow-sm"
        />
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => setShowOnlyWithStock((v) => !v)}
          className={`flex items-center justify-between px-4 py-3 rounded-xl border font-bold text-sm transition ${
            showOnlyWithStock
              ? "bg-zinc-50 border-zinc-200 text-zinc-700 shadow-sm"
              : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
          }`}
        >
          <span>Con stock</span>
          <div className={`w-10 h-6 rounded-full transition-colors relative ${showOnlyWithStock ? "bg-zinc-500" : "bg-slate-200"}`}>
             <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showOnlyWithStock ? "left-5" : "left-1"}`} />
          </div>
        </button>

        <button
          onClick={() => setShowOnlyNegative((v) => !v)}
          className={`flex items-center justify-between px-4 py-3 rounded-xl border font-bold text-sm transition ${
            showOnlyNegative
              ? "bg-red-50 border-red-200 text-red-700 shadow-sm"
              : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className={showOnlyNegative ? "text-red-500" : "text-slate-400"} />
            <span>Solo negativos</span>
          </div>
          <div className={`w-10 h-6 rounded-full transition-colors relative ${showOnlyNegative ? "bg-red-500" : "bg-slate-200"}`}>
             <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showOnlyNegative ? "left-5" : "left-1"}`} />
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-zinc-100 p-2.5 rounded-xl shadow-sm shadow-zinc-100">
            <Layers className="text-zinc-700" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Inventario Aluzinc</h1>
            <p className="text-sm text-gray-500 font-medium">
              {loading ? "Cargando…" : `${items.length} producto${items.length !== 1 ? "s" : ""} encontrados`}
            </p>
          </div>
        </div>
      </div>

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
          icon={<AlertTriangle size={18} className="text-red-500" />}
          bg={kpis.negativeCount > 0 ? "bg-red-50" : "bg-gray-50"}
          valueColor={kpis.negativeCount > 0 ? "text-red-600" : "text-gray-700"}
        />
      </div>

      <TableFilters
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Buscar por SKU o nombre…",
          isSearching: loading && search !== "",
          onClear: () => setSearch(""),
        }}
        filterGroups={filterGroups}
        extraContent={extraContent}
        onClearAll={clearFilters}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 font-medium text-sm flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={pagedItems}
        getRowKey={(i) => i.sku}
        isLoading={loading}
        currentPage={currentPage}
        pageSize={pageSize}
        emptyState={{
          icon: "Package",
          title: "Sin productos",
          description: "No hay productos que coincidan con los filtros.",
        }}
        onRowClick={canEdit ? (item) => setAdjustingItem(item) : undefined}
      />

      <TablePagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={items.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
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
