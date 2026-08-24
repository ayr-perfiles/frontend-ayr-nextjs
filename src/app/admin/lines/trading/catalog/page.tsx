"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, ShoppingCart, X, UploadCloud } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { useTradingCatalog } from "@/modules/trading/hooks/useTradingCatalog";
import ProductCatalogTable from "@/modules/trading/components/catalog/ProductCatalogTable";
import ProductModal from "@/modules/trading/components/catalog/ProductModal";
import {
  deactivateProduct,
  reactivateProduct,
} from "@/modules/trading/services/catalogService";
import type { TradingProduct, TradingCategory } from "@/modules/trading/types";
import { TableFilters, FilterGroup } from "@/components/ui/TableFilters";
import { TablePagination } from "@/components/ui/TablePagination";
import { useTableData } from "@/hooks/useTableData";

const CATEGORY_OPTIONS: TradingCategory[] = [
  "POLICARBONATO",
  "TUBO",
  "AUTOPERFORANTE",
  "ACCESORIO",
  "OTRO",
];

export default function TradingCatalogPage() {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";

  const { products, loading, refresh } = useTradingCatalog();

  const {
    pageItems,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    searchValue,
    setSearchValue,
    filterValues,
    setFilterValue,
    totalFiltered,
  } = useTableData({
    data: products,
    searchFields: ["sku", "displayName"],
    filters: {
      category: (row, val) => row.category === val,
      status: (row, val) => {
        if (val === "ACTIVE") return row.active === true;
        if (val === "INACTIVE") return row.active === false;
        return true;
      },
    },
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<TradingProduct | null>(
    null,
  );
  const [viewingProduct, setViewingProduct] = useState<TradingProduct | null>(
    null,
  );

  // Deactivate flow
  const [deactivating, setDeactivating] = useState<TradingProduct | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [deactivateSaving, setDeactivateSaving] = useState(false);

  function handleToggleActive(product: TradingProduct) {
    if (product.active) {
      setDeactivating(product);
      setDeactivateReason("");
    } else {
      void handleReactivate(product);
    }
  }

  async function handleReactivate(product: TradingProduct) {
    try {
      await reactivateProduct(product.sku);
      toast.success(`Producto ${product.sku} reactivado`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al reactivar");
    }
  }

  async function handleDeactivateConfirm() {
    if (!deactivating) return;
    if (!deactivateReason.trim()) {
      toast.error("Ingresa una razón para desactivar el producto");
      return;
    }
    setDeactivateSaving(true);
    try {
      await deactivateProduct(deactivating.sku, deactivateReason);
      toast.success(`Producto ${deactivating.sku} desactivado`);
      setDeactivating(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al desactivar");
    } finally {
      setDeactivateSaving(false);
    }
  }

  const filterGroups: FilterGroup[] = [
    {
      id: "category",
      label: "Categoría",
      value: filterValues.category || "ALL",
      onChange: (v) => setFilterValue("category", v),
      options: [
        { value: "ALL", label: "Todas las categorías" },
        ...CATEGORY_OPTIONS.map((c) => ({ value: c, label: c })),
      ],
      layout: "grid-2",
    },
    {
      id: "status",
      label: "Estado",
      value: filterValues.status || "ALL",
      onChange: (v) => setFilterValue("status", v),
      options: [
        { value: "ALL", label: "Todos" },
        { value: "ACTIVE", label: "Activos" },
        { value: "INACTIVE", label: "Inactivos" },
      ],
      layout: "list",
    },
  ];

  const handleClearAll = () => {
    setSearchValue("");
    setFilterValue("category", "ALL");
    setFilterValue("status", "ALL");
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 p-2.5 rounded-xl text-amber-700">
            <ShoppingCart size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Catálogo de Reventa
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              {loading
                ? "Cargando…"
                : `${products.length} producto${products.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

          {/*
          {isAdmin && (
            <div className="flex gap-3">
              <Link
                href="/admin/catalog/import"
                className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-200 transition"
              >
                <UploadCloud size={18} /> Importar Masivo
              </Link>
            </div>
          )}
          */}
          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-amber-700 transition active:scale-95 shadow-sm shadow-amber-200"
            >
              <Plus size={18} /> Nuevo Producto
            </button>
          )}
      </div>

      <TableFilters
        search={{
          value: searchValue,
          onChange: setSearchValue,
          placeholder: "Buscar por SKU o nombre…",
          isSearching: loading && !!searchValue,
        }}
        filterGroups={filterGroups}
        onClearAll={handleClearAll}
      />

      <div className="space-y-4">
        <ProductCatalogTable
          products={pageItems}
          loading={loading}
          canEdit={isAdmin}
          onView={setViewingProduct}
          onEdit={setEditingProduct}
          onToggleActive={handleToggleActive}
          currentPage={currentPage}
          pageSize={pageSize}
        />

        <TablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalFiltered}
          onPageChange={setCurrentPage}
          pageSizeOptions={[15, 30, 50, 100]}
          onPageSizeChange={setPageSize}
          totalLabel="Productos"
        />
      </div>

      {/* Modals */}
      {showAddModal && (
        <ProductModal mode="create" onClose={() => setShowAddModal(false)} onSuccess={refresh} />
      )}

      {editingProduct && (
        <ProductModal
          mode="edit"
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => { setEditingProduct(null); refresh(); }}
        />
      )}

      {viewingProduct && (
        <ProductDetailModal product={viewingProduct} onClose={() => setViewingProduct(null)} />
      )}

      {/* Deactivate confirm */}
      {deactivating && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-red-600 text-white flex justify-between items-center">
              <h2 className="text-lg font-black">Desactivar Producto</h2>
              <button onClick={() => setDeactivating(null)} className="hover:bg-white/20 p-2 rounded-full transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm font-medium text-gray-700">
                ¿Desactivar <span className="font-black text-gray-900">{deactivating.sku}</span>?
                El producto dejará de aparecer en ventas e inventario activo.
              </p>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                  Razón (obligatorio)
                </label>
                <input
                  type="text"
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleDeactivateConfirm()}
                  placeholder="Ej: Descontinuado por proveedor"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm outline-none focus:border-red-400"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeactivating(null)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleDeactivateConfirm()}
                  disabled={deactivateSaving}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black hover:bg-red-700 transition disabled:opacity-60"
                >
                  {deactivateSaving ? "Desactivando…" : "Desactivar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductDetailModal({ product, onClose }: { product: TradingProduct; onClose: () => void }) {
  const rows: [string, string][] = [
    ["SKU", product.sku],
    ["Nombre", product.displayName],
    ["Categoría", product.category],
    ["Color", product.color || "—"],
    ["Especificación", product.spec || "—"],
    ["Unidad", product.unit],
    ["Costo promedio", product.avgCost > 0 ? `S/ ${product.avgCost.toFixed(2)}` : "Sin costo"],
    ["Estado", product.active ? "Activo" : "Inactivo"],
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-6 bg-amber-600 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black">Ficha del Producto</h2>
            <p className="text-amber-200 text-xs font-bold uppercase tracking-widest">Reventa / Compra-venta</p>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <dl className="divide-y divide-gray-100">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between py-3">
                <dt className="text-xs font-black text-gray-400 uppercase tracking-wider">{label}</dt>
                <dd className="text-sm font-bold text-gray-800 text-right max-w-[60%]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
