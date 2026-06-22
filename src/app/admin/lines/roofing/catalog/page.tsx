"use client";

import { useState } from "react";
import { Plus, Package, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { useRoofingCatalog } from "@/modules/roofing/hooks/useRoofingCatalog";
import ProductCatalogTable from "@/modules/roofing/components/catalog/ProductCatalogTable";
import ProductModal from "@/modules/roofing/components/catalog/ProductModal";
import {
  deactivateProduct,
  reactivateProduct,
} from "@/modules/roofing/services/catalogService";
import type {
  RoofingProduct,
  RoofingFilters,
  RoofingMaterial,
} from "@/modules/roofing/types";
import { TableFilters, FilterGroup } from "@/components/ui/TableFilters";
import { TablePagination } from "@/components/ui/TablePagination";
import { useTableData } from "@/hooks/useTableData";

const MATERIAL_OPTIONS: RoofingMaterial[] = [
  "UPVC",
  "ACERO_GALV",
  "POLICARBONATO",
];
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export default function RoofingCatalogPage() {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";

  const { products, loading, error, refresh } = useRoofingCatalog();

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
      material: (row, val) => row.material === val,
      color: (row, val) => {
        if (!val) return true;
        return !!row.color?.toUpperCase().includes(val.toUpperCase());
      },
      status: (row, val) => {
        if (val === "ACTIVE") return row.active === true;
        if (val === "INACTIVE") return row.active === false;
        return true;
      },
    },
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<RoofingProduct | null>(
    null,
  );
  const [viewingProduct, setViewingProduct] = useState<RoofingProduct | null>(
    null,
  );

  // Deactivate flow
  const [deactivating, setDeactivating] = useState<RoofingProduct | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [deactivateSaving, setDeactivateSaving] = useState(false);

  function handleToggleActive(product: RoofingProduct) {
    if (product.active) {
      setDeactivating(product);
      setDeactivateReason("");
    } else {
      void handleReactivate(product);
    }
  }

  async function handleReactivate(product: RoofingProduct) {
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
      id: "material",
      label: "Material",
      value: filterValues.material || "ALL",
      onChange: (v) => setFilterValue("material", v),
      options: [
        { value: "ALL", label: "Todo material" },
        ...MATERIAL_OPTIONS.map((m) => ({ value: m, label: m })),
      ],
      layout: "list",
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
    setFilterValue("material", "ALL");
    setFilterValue("status", "ALL");
    setFilterValue("color", "");
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-700">
            <Package size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Catálogo UPVC
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              {loading
                ? "Cargando…"
                : `${products.length} producto${products.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition active:scale-95 shadow-sm shadow-emerald-200 whitespace-nowrap"
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
        extraContent={
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
              Color (Filtro manual)
            </label>
            <input
              type="text"
              value={filterValues.color || ""}
              onChange={(e) => setFilterValue("color", e.target.value.toUpperCase())}
              placeholder="Ej: ROJO, AZUL..."
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-400"
            />
          </div>
        }
        onClearAll={handleClearAll}
      />

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 font-medium text-sm">
          {error}
        </div>
      )}

      {/* Table & Pagination */}
      <div className="space-y-4">
        <ProductCatalogTable
          products={pageItems}
          loading={loading}
          canEdit={isAdmin}
          onView={(p) => setViewingProduct(p)}
          onEdit={(p) => setEditingProduct(p)}
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

      {/* Add modal */}
      {showAddModal && (
        <ProductModal
          mode="create"
          onClose={() => setShowAddModal(false)}
          onSuccess={refresh}
        />
      )}

      {/* Edit modal */}
      {editingProduct && (
        <ProductModal
          mode="edit"
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => {
            setEditingProduct(null);
            refresh();
          }}
        />
      )}

      {/* Detail modal */}
      {viewingProduct && (
        <ProductDetailModal
          product={viewingProduct}
          onClose={() => setViewingProduct(null)}
        />
      )}

      {/* Deactivate confirm */}
      {deactivating && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-red-600 text-white flex justify-between items-center">
              <h2 className="text-lg font-black">Desactivar Producto</h2>
              <button
                onClick={() => setDeactivating(null)}
                className="hover:bg-white/20 p-2 rounded-full transition"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm font-medium text-gray-700">
                ¿Desactivar{" "}
                <span className="font-black text-gray-900">{deactivating.sku}</span>? El
                producto dejará de aparecer en ventas e inventario activo.
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

// ─── Product detail modal ─────────────────────────────────────────────────────

function ProductDetailModal({
  product,
  onClose,
}: {
  product: RoofingProduct;
  onClose: () => void;
}) {
  const rows: [string, string][] = [
    ["SKU", product.sku],
    ["Nombre", product.displayName],
    ["Familia", product.family ?? "TC5"],
    ["Material", product.material],
    ["Color", product.color || "—"],
    ["Espesor", `${product.thickness} mm`],
    ["Ancho", `${product.width.toFixed(3)} m`],
    ["Largo", `${product.length.toFixed(2)} m`],
    ...(product.weight ? ([["Peso", `${product.weight} kg`]] as [string, string][]) : []),
    ["Unidad", product.unit],
    [
      "Costo promedio",
      product.avgCost > 0 ? `S/ ${product.avgCost.toFixed(2)}` : "Sin costo",
    ],
    ["Estado", product.active ? "Activo" : "Inactivo"],
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-6 bg-emerald-700 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black">Ficha del Producto</h2>
            <p className="text-emerald-200 text-xs font-bold uppercase tracking-widest">
              Coberturas UPVC
            </p>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white/20 p-2 rounded-full transition"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <dl className="divide-y divide-gray-100">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between py-3">
                <dt className="text-xs font-black text-gray-400 uppercase tracking-wider">
                  {label}
                </dt>
                <dd className="text-sm font-bold text-gray-800 text-right max-w-[60%]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
