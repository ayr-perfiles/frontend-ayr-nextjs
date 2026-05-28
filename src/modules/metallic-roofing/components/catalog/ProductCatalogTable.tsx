"use client";

import React from "react";
import { Search, Eye, Pencil, PowerOff, Power } from "lucide-react";
import type { MetallicProduct } from "@/modules/metallic-roofing/types";

const COLOR_DOT: Record<string, string> = {
  ROJO: "bg-red-500",
  AZUL: "bg-blue-500",
  VERDE: "bg-green-500",
  BLANCO: "bg-white border border-gray-400",
  GRIS: "bg-gray-400",
  AMARILLO: "bg-yellow-400",
  NARANJA: "bg-orange-400",
};

function ColorChip({ color }: { color: string }) {
  const dotClass = COLOR_DOT[color.toUpperCase()] ?? "bg-zinc-400";
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100 text-xs font-bold text-gray-700">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} />
      {color}
    </span>
  );
}

function FamilyBadge({ family }: { family: string }) {
  const cls: Record<string, string> = {
    COBERTURA: "bg-zinc-100 text-zinc-700",
    PLANCHA: "bg-slate-100 text-slate-700",
    BOBINA: "bg-amber-100 text-amber-700",
    ACCESORIO: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${cls[family] ?? "bg-gray-100 text-gray-600"}`}>
      {family}
    </span>
  );
}

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
  products: MetallicProduct[];
  loading: boolean;
  canEdit: boolean;
  onView: (product: MetallicProduct) => void;
  onEdit: (product: MetallicProduct) => void;
  onToggleActive: (product: MetallicProduct) => void;
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
          <div className="w-8 h-8 border-2 border-gray-200 border-t-zinc-500 rounded-full animate-spin" />
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
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Familia</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Acabado</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Color</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Espesor</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Ancho × Largo</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.map((product, index) => (
              <tr
                key={product.sku}
                className={`group transition-colors ${
                  product.active ? "hover:bg-zinc-50/20" : "bg-gray-50/30 opacity-70"
                }`}
              >
                <td className="p-4 text-center">
                  <span className="text-xs font-bold text-gray-400">{index + 1}</span>
                </td>
                <td className="p-4">
                  <span className={`font-black font-mono text-sm ${product.active ? "text-zinc-800" : "text-gray-400"}`}>
                    {product.sku}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`text-sm font-medium ${product.active ? "text-gray-800" : "text-gray-400"}`}>
                    {product.displayName}
                  </span>
                </td>
                <td className="p-4">
                  <FamilyBadge family={product.family} />
                </td>
                <td className="p-4">
                  <span className="text-sm font-bold text-gray-600">{product.finish}</span>
                </td>
                <td className="p-4">
                  {product.color ? (
                    <ColorChip color={product.color} />
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="p-4 text-sm font-medium text-gray-600 whitespace-nowrap">
                  {product.thickness} <span className="text-gray-400 text-xs">mm</span>
                </td>
                <td className="p-4 text-sm font-medium text-gray-600 whitespace-nowrap">
                  {product.width != null ? (
                    <>
                      {product.width.toFixed(3)} <span className="text-gray-400 text-xs">m</span>
                      {product.length != null && (
                        <>
                          <span className="text-gray-300 mx-1">×</span>
                          {product.length.toFixed(2)} <span className="text-gray-400 text-xs">m</span>
                        </>
                      )}
                    </>
                  ) : product.length != null ? (
                    <>
                      {product.length.toFixed(2)} <span className="text-gray-400 text-xs">m</span>
                    </>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
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
                          className="p-2 text-gray-400 hover:bg-zinc-100 hover:text-zinc-700 rounded-lg transition"
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
                <td colSpan={10} className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4 text-gray-400">
                    <Search size={24} />
                  </div>
                  <h3 className="text-gray-900 font-bold text-lg">Sin resultados</h3>
                  <p className="text-gray-500 mt-1 font-medium">
                    No se encontraron productos con los filtros actuales.
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
