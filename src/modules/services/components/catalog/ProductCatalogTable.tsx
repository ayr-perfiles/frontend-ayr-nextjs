"use client";

import React from "react";
import { Search, Eye, Pencil, PowerOff, Power } from "lucide-react";
import type { ServiceProduct } from "../../types";

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-[10px] font-black border tracking-widest ${
        active
          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
          : "bg-gray-100 text-gray-500 border-gray-200"
      }`}
    >
      {active ? "ACTIVO" : "INACTIVO"}
    </span>
  );
}

interface ProductCatalogTableProps {
  products: ServiceProduct[];
  loading: boolean;
  canEdit: boolean;
  onView: (product: ServiceProduct) => void;
  onEdit: (product: ServiceProduct) => void;
  onToggleActive: (product: ServiceProduct) => void;
}

export default function ProductCatalogTable({
  products,
  loading,
  canEdit,
  onView,
  onEdit,
  onToggleActive,
}: ProductCatalogTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <div className="inline-flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
          <span className="text-sm font-medium">Cargando catálogo…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="w-full overflow-x-auto min-h-[250px]">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50/80 border-b border-gray-100">
            <tr>
              <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-12 text-center">#</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">SKU</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Descripción</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Precio / Und</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.map((product, index) => (
              <tr
                key={product.sku}
                className={`group transition-colors ${
                  product.active ? "hover:bg-violet-50/20" : "bg-gray-50/30 opacity-70"
                }`}
              >
                <td className="p-4 text-center">
                  <span className="text-xs font-bold text-gray-400">{index + 1}</span>
                </td>
                <td className="p-4">
                  <span className={`font-black font-mono text-sm ${product.active ? "text-violet-800" : "text-gray-400"}`}>
                    {product.sku}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`text-sm font-medium ${product.active ? "text-gray-800" : "text-gray-400"}`}>
                    {product.displayName}
                  </span>
                </td>
                <td className="p-4">
                  <span className="text-sm text-gray-600">{product.description || "—"}</span>
                </td>
                <td className="p-4">
                  <span className="text-sm font-bold text-gray-600">
                    {product.pricePerUnit ? `S/ ${product.pricePerUnit.toFixed(2)}` : "—"}
                  </span>
                </td>
                <td className="p-4">
                  <StatusBadge active={product.active} />
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onView(product)}
                      className="p-2 text-gray-400 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition"
                      title="Ver detalle"
                    >
                      <Eye size={16} />
                    </button>
                    {canEdit && (
                      <>
                        <button
                          onClick={() => onEdit(product)}
                          className="p-2 text-gray-400 hover:bg-violet-100 hover:text-violet-700 rounded-lg transition"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => onToggleActive(product)}
                          className={`p-2 rounded-lg transition ${
                            product.active
                              ? "text-gray-400 hover:bg-red-100 hover:text-red-600"
                              : "text-gray-400 hover:bg-green-100 hover:text-green-600"
                          }`}
                          title={product.active ? "Desactivar" : "Reactivar"}
                        >
                          {product.active ? <PowerOff size={16} /> : <Power size={16} />}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4 text-gray-400">
                    <Search size={24} />
                  </div>
                  <h3 className="text-gray-900 font-bold text-lg">Sin resultados</h3>
                  <p className="text-gray-500 mt-1 font-medium">
                    No se encontraron servicios con los filtros actuales.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
