"use client";

import { useState, useEffect } from "react";
import { Plus, Layers, X, UploadCloud } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { HeaderOptionsMenu } from "@/components/ui/HeaderOptionsMenu";
import { useMetallicCatalog } from "@/modules/metallic-roofing/hooks/useMetallicCatalog";
import ProductCatalogTable from "@/modules/metallic-roofing/components/catalog/ProductCatalogTable";
import ProductModal from "@/modules/metallic-roofing/components/catalog/ProductModal";
import {
  deactivateProduct,
  reactivateProduct,
} from "@/modules/metallic-roofing/services/catalogService";
import type { MetallicProduct } from "@/modules/metallic-roofing/types";
import { TableFilters, FilterGroup } from "@/components/ui/TableFilters";
import { TablePagination } from "@/components/ui/TablePagination";
import { useTableData } from "@/hooks/useTableData";
import { listFinishes, CoilFinish } from "@/core/coils/services/finishService";

const FAMILY_OPTIONS = ["COBERTURA", "PLANCHA"];
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export default function MetallicRoofingCatalogPage() {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";

  const { products, loading, error, refresh } = useMetallicCatalog();

  const [finishes, setFinishes] = useState<CoilFinish[]>([]);
  useEffect(() => {
    listFinishes(true).then(list => {
      setFinishes(list.filter(f => f.lines.includes('metallic-roofing')));
    }).catch(console.error);
  }, []);

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
      family: (row, val) => row.family === val,
      finish: (row, val) => {
        if (!val || val.length === 0) return true;
        return val.includes(row.finish);
      },
      thickness: (row, val) => String(row.thickness) === val,
      status: (row, val) => {
        if (val === "ACTIVE") return row.active === true;
        if (val === "INACTIVE") return row.active === false;
        return true;
      },
    },
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MetallicProduct | null>(
    null,
  );
  const [viewingProduct, setViewingProduct] = useState<MetallicProduct | null>(
    null,
  );

  const [deactivating, setDeactivating] = useState<MetallicProduct | null>(
    null,
  );
  const [deactivateReason, setDeactivateReason] = useState("");
  const [deactivateSaving, setDeactivateSaving] = useState(false);

  function handleToggleActive(product: MetallicProduct) {
    if (product.active) {
      setDeactivating(product);
      setDeactivateReason("");
    } else {
      void handleReactivate(product);
    }
  }

  async function handleReactivate(product: MetallicProduct) {
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

  const uniqueThicknesses = Array.from(new Set(products.map(p => p.thickness))).filter(t => t != null).sort();

  const filterGroups: FilterGroup[] = [
    {
      id: "family",
      label: "Familia",
      value: filterValues.family || "ALL",
      onChange: (v) => setFilterValue("family", v),
      options: [
        { value: "ALL", label: "Toda familia" },
        ...FAMILY_OPTIONS.map((f) => ({ value: f, label: f })),
      ],
      layout: "grid-2",
    },
    {
      id: "finish",
      label: "Acabado",
      value: filterValues.finish || [],
      onChange: (v) => setFilterValue("finish", v),
      multiple: true,
      options: finishes.map((f) => ({ value: f.id, label: f.label })),
      layout: "grid-2",
    },
    {
      id: "thickness",
      label: "Espesor",
      value: filterValues.thickness || "ALL",
      onChange: (v) => setFilterValue("thickness", v),
      options: [
        { value: "ALL", label: "Todos" },
        ...uniqueThicknesses.map((t) => ({ value: String(t), label: `${t} mm` })),
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
    setFilterValue("family", "ALL");
    setFilterValue("finish", []);
    setFilterValue("thickness", "ALL");
    setFilterValue("status", "ALL");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-zinc-100 p-2.5 rounded-xl text-zinc-700">
            <Layers size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Catálogo Aluzinc
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              {loading
                ? "Cargando…"
                : `${products.length} producto${products.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-3 items-center">
            <HeaderOptionsMenu
              items={[
                {
                  id: "import",
                  label: "Importar Masivo",
                  icon: <UploadCloud size={18} className="text-emerald-500" />,
                  href: "/admin/catalog/import",
                },
              ]}
            />
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-zinc-700 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-zinc-800 transition active:scale-95 shadow-sm shadow-zinc-200 whitespace-nowrap"
            >
              <Plus size={18} /> Nuevo Producto
            </button>
          </div>
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

      {/* Error */}
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

// ─── Product detail modal ─────────────────────────────────────────────────────

function ProductDetailModal({ product, onClose }: { product: MetallicProduct; onClose: () => void }) {
  const rows: [string, string][] = [
    ["SKU", product.sku],
    ["Nombre", product.displayName],
    ["Familia", product.family],
    ["Acabado", product.finish],

    ["Espesor", `${product.thickness} mm`],
    ...(product.width != null ? ([["Ancho", `${product.width.toFixed(3)} m`]] as [string, string][]) : []),
    ...(product.length != null ? ([["Largo", `${product.length.toFixed(2)} m`]] as [string, string][]) : []),
    ["Unidad", product.unit],
    ["Costo promedio", product.avgCost > 0 ? `S/ ${product.avgCost.toFixed(2)}` : "Sin costo"],
    ["Estado", product.active ? "Activo" : "Inactivo"],
    ...(product.widthMm != null
      ? ([["Ancho bobina", `${product.widthMm} mm ${product.metaSource ? `(${product.metaSource})` : ""}`]] as [string, string][])
      : []),
    ...(product.densityFactor != null
      ? ([["Factor densidad", product.densityFactor.toString()]] as [string, string][])
      : []),
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-6 bg-zinc-700 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black">Ficha del Producto</h2>
            <p className="text-zinc-300 text-xs font-bold uppercase tracking-widest">
              Coberturas Aluzinc
            </p>
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
