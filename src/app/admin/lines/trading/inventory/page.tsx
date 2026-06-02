"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  PackageSearch, 
  History, 
  Settings2, 
  AlertCircle, 
  AlertTriangle,
  Search,
  Package
} from "lucide-react";
import { useTradingStock, useTradingKpis } from "@/modules/trading/hooks/useTradingStock";
import TradingKardexModal from "@/modules/trading/components/inventory/TradingKardexModal";
import TradingAdjustModal from "@/modules/trading/components/inventory/TradingAdjustModal";
import type { TradingCategory } from "@/modules/trading/types";
import type { InventoryFilters, InventoryItem } from "@/modules/trading/services/inventoryService";

import { KpiCard } from "@/components/ui/KpiCard";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";
import { TableFilters, FilterGroup } from "@/components/ui/TableFilters";
import { TablePagination } from "@/components/ui/TablePagination";
import { RowActionsMenu, RowAction } from "@/components/ui/RowActionsMenu";

const CATEGORY_OPTIONS: TradingCategory[] = ['POLICARBONATO', 'TUBO', 'AUTOPERFORANTE', 'ACCESORIO', 'OTRO'];

export default function TradingInventoryPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<TradingCategory | "">("");
  const [showOnlyWithStock, setShowOnlyWithStock] = useState(false);
  const [showOnlyNegative, setShowOnlyNegative] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, showOnlyWithStock, showOnlyNegative]);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  const selectedAdjustItem = items.find((i) => i.sku === adjustingSku);
  const selectedKardexItem = items.find((i) => i.sku === kardexSku);

  const handleRefresh = () => {
    refresh();
    refreshKpis();
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("");
    setShowOnlyWithStock(false);
    setShowOnlyNegative(false);
  };

  const columns: ColumnDef<InventoryItem>[] = [
    {
      key: "sku",
      header: "SKU",
      render: (item) => (
        <span className="font-black font-mono text-sm text-amber-800">
          {item.sku}
        </span>
      ),
    },
    {
      key: "product",
      header: "Producto",
      render: (item) => (
        <div className="flex flex-col">
          <span className="text-sm font-bold text-gray-800">{item.productName}</span>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
            {item.product?.category}
          </span>
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
            <span className={`text-sm font-black ${isNegative ? "text-red-600" : "text-gray-900"}`}>
              {item.quantity.toLocaleString()}
            </span>
            {isNegative && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-500">
                <AlertCircle size={10} /> Stock negativo
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "avgCost",
      header: "Costo Prom.",
      align: "right",
      render: (item) => (
        <span className="text-sm font-medium text-gray-600 tabular-nums">
          S/ {item.avgCost.toFixed(2)}
        </span>
      ),
    },
    {
      key: "totalValue",
      header: "Valor Total",
      align: "right",
      render: (item) => (
        <span className={`text-sm font-black tabular-nums ${item.quantity < 0 ? "text-red-600" : "text-gray-900"}`}>
          S/ {item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "center",
      render: (item) => {
        const actions: RowAction[] = [
          {
            id: "kardex",
            label: "Ver movimientos (Kardex)",
            icon: <History size={16} />,
            onClick: () => setKardexSku(item.sku),
          },
          {
            id: "adjust",
            label: "Ajuste manual",
            icon: <Settings2 size={16} />,
            onClick: () => setAdjustingSku(item.sku),
          }
        ];
        return <RowActionsMenu items={actions} />;
      },
    },
  ];

  const filterGroups: FilterGroup[] = [
    {
      id: "category",
      label: "Categoría",
      layout: "grid",
      value: categoryFilter,
      onChange: (val) => setCategoryFilter(val as TradingCategory | ""),
      options: [
        { value: "", label: "Todas las categorías" },
        ...CATEGORY_OPTIONS.map((c) => ({ value: c, label: c })),
      ],
    },
  ];

  const extraContent = (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => setShowOnlyWithStock((v) => !v)}
        className={`flex items-center justify-between px-4 py-3 rounded-xl border font-bold text-sm transition ${
          showOnlyWithStock
            ? "bg-amber-50 border-amber-200 text-amber-700 shadow-sm"
            : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
        }`}
      >
        <span>Solo con stock</span>
        <div className={`w-10 h-6 rounded-full transition-colors relative ${showOnlyWithStock ? "bg-amber-500" : "bg-slate-200"}`}>
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
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 p-2.5 rounded-xl text-amber-700 shadow-sm shadow-amber-100">
            <PackageSearch size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Inventario de Reventa</h1>
            <p className="text-sm text-gray-500 font-medium">
              {loading ? "Cargando…" : `${items.length} producto${items.length !== 1 ? "s" : ""} encontrados`}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          label="Productos Activos"
          value={kpisLoading ? "..." : (kpis?.totalProducts.toString() ?? "0")}
          icon={<PackageSearch size={18} className="text-gray-600" />}
          bg="bg-gray-50"
        />
        <KpiCard
          label="Stock Total (Pzas/Mts)"
          value={kpisLoading ? "..." : (kpis?.totalPieces.toLocaleString() ?? "0")}
          icon={<Package size={18} className="text-amber-600" />}
          bg="bg-amber-50"
          valueColor="text-amber-600"
        />
        <KpiCard
          label="Alertas Negativas"
          value={kpisLoading ? "..." : (kpis?.negativeCount.toString() ?? "0")}
          icon={<AlertTriangle size={18} className="text-red-500" />}
          bg={kpis?.negativeCount ? "bg-red-50" : "bg-gray-50"}
          valueColor={kpis?.negativeCount ? "text-red-600" : "text-gray-900"}
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

      <DataTable
        columns={columns}
        data={pagedItems}
        getRowKey={(i) => i.sku}
        isLoading={loading}
        currentPage={currentPage}
        pageSize={pageSize}
        emptyState={{
          icon: "Search",
          title: "Sin resultados",
          description: "No se encontraron productos en inventario.",
        }}
        onRowClick={(item) => setKardexSku(item.sku)}
      />

      <TablePagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={items.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
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
