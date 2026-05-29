"use client";

import { useState } from "react";
import { Plus, Wrench, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { useServicesCatalog } from "@/modules/services/hooks/useServicesCatalog";
import ProductCatalogTable from "@/modules/services/components/catalog/ProductCatalogTable";
import ProductModal from "@/modules/services/components/catalog/ProductModal";
import {
  deactivateProduct,
  reactivateProduct,
} from "@/modules/services/services/catalogService";
import type { ServiceProduct } from "@/modules/services/types";

export default function ServicesCatalogPage() {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const filters = {
    searchTerm: search || undefined,
    active: statusFilter === "ALL" ? undefined : statusFilter === "ACTIVE",
  };

  const { products, loading, refresh } = useServicesCatalog(filters);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ServiceProduct | null>(null);
  const [viewingProduct, setViewingProduct] = useState<ServiceProduct | null>(null);

  // Deactivate flow
  const [deactivating, setDeactivating] = useState<ServiceProduct | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [deactivateSaving, setDeactivateSaving] = useState(false);

  function handleToggleActive(product: ServiceProduct) {
    if (product.active) {
      setDeactivating(product);
      setDeactivateReason("");
    } else {
      void handleReactivate(product);
    }
  }

  async function handleReactivate(product: ServiceProduct) {
    try {
      await reactivateProduct(product.sku);
      toast.success(`Servicio ${product.sku} reactivado`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al reactivar");
    }
  }

  async function handleDeactivateConfirm() {
    if (!deactivating) return;
    if (!deactivateReason.trim()) {
      toast.error("Ingresa una razón para desactivar el servicio");
      return;
    }
    setDeactivateSaving(true);
    try {
      await deactivateProduct(deactivating.sku, deactivateReason);
      toast.success(`Servicio ${deactivating.sku} desactivado`);
      setDeactivating(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al desactivar");
    } finally {
      setDeactivateSaving(false);
    }
  }

  const hasFilters = search || statusFilter !== "ALL";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-violet-100 p-2.5 rounded-xl text-violet-700">
            <Wrench size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Catálogo de Servicios</h1>
            <p className="text-sm text-gray-500 font-medium">
              {loading ? "Cargando…" : `${products.length} servicio${products.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-violet-700 transition active:scale-95 shadow-sm shadow-violet-200"
          >
            <Plus size={18} /> Nuevo Servicio
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por SKU o nombre…"
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm outline-none focus:border-violet-400 focus:bg-white transition"
            />
          </div>

          <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm font-bold bg-gray-50">
            {(["ALL", "ACTIVE", "INACTIVE"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2.5 transition ${
                  statusFilter === s ? "bg-violet-600 text-white" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {s === "ALL" ? "Todos" : s === "ACTIVE" ? "Activos" : "Inactivos"}
              </button>
            ))}
          </div>

          {hasFilters && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
              }}
              className="flex items-center gap-1 px-3 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition"
            >
              <X size={14} /> Limpiar
            </button>
          )}
        </div>
      </div>

      <ProductCatalogTable
        products={products}
        loading={loading}
        canEdit={isAdmin}
        onView={setViewingProduct}
        onEdit={setEditingProduct}
        onToggleActive={handleToggleActive}
      />

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
              <h2 className="text-lg font-black">Desactivar Servicio</h2>
              <button onClick={() => setDeactivating(null)} className="hover:bg-white/20 p-2 rounded-full transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm font-medium text-gray-700">
                ¿Desactivar <span className="font-black text-gray-900">{deactivating.sku}</span>?
                El servicio dejará de aparecer como opción en nuevas ventas.
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
                  placeholder="Ej: Servicio no disponible"
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

function ProductDetailModal({ product, onClose }: { product: ServiceProduct; onClose: () => void }) {
  const rows: [string, string][] = [
    ["SKU", product.sku],
    ["Nombre", product.displayName],
    ["Descripción", product.description || "—"],
    ["Unidad", product.unit],
    ["Precio sugerido", product.pricePerUnit ? `S/ ${product.pricePerUnit.toFixed(2)}` : "—"],
    ["Estado", product.active ? "Activo" : "Inactivo"],
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-6 bg-violet-600 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black">Ficha del Servicio</h2>
            <p className="text-violet-200 text-xs font-bold uppercase tracking-widest">Servicios</p>
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
