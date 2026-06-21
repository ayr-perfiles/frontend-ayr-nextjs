"use client";

import React from "react";
import { Eye, Pencil, PowerOff, Power } from "lucide-react";
import type { RoofingProduct } from "@/modules/roofing/types";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";
import { RowActionsMenu, RowAction } from "@/components/ui/RowActionsMenu";

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
  const dotClass = COLOR_DOT[color.toUpperCase()] ?? "bg-purple-400";
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100 text-xs font-bold text-gray-700">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} />
      {color}
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
  products: RoofingProduct[];
  loading: boolean;
  canEdit: boolean;
  onView: (product: RoofingProduct) => void;
  onEdit: (product: RoofingProduct) => void;
  onToggleActive: (product: RoofingProduct) => void;
  // Added for KIT compatibility
  currentPage?: number;
  pageSize?: number;
}

export default function ProductCatalogTable({
  products,
  loading,
  canEdit,
  onView,
  onEdit,
  onToggleActive,
  currentPage = 1,
  pageSize = 100,
}: ProductCatalogTableProps) {
  const columns: ColumnDef<RoofingProduct>[] = [
    {
      key: "sku",
      header: "SKU",
      render: (product) => (
        <span
          className={`font-black font-mono text-sm ${
            product.active ? "text-emerald-800" : "text-gray-400"
          }`}
        >
          {product.sku}
        </span>
      ),
    },
    {
      key: "name",
      header: "Nombre",
      render: (product) => (
        <span
          className={`text-sm font-medium ${
            product.active ? "text-gray-800" : "text-gray-400"
          }`}
        >
          {product.displayName}
        </span>
      ),
    },
    {
      key: "material",
      header: "Material",
      render: (product) => (
        <span className="text-sm font-bold text-gray-600">
          {product.material}
        </span>
      ),
    },
    {
      key: "color",
      header: "Color",
      render: (product) =>
        product.color ? (
          <ColorChip color={product.color} />
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        ),
    },
    {
      key: "thickness",
      header: "Espesor",
      render: (product) => (
        <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
          {product.thickness}{" "}
          <span className="text-gray-400 text-xs">mm</span>
        </span>
      ),
    },
    {
      key: "dimensions",
      header: "Ancho × Largo",
      render: (product) => (
        <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
          {product.width.toFixed(3)}{" "}
          <span className="text-gray-400 text-xs">m</span>
          <span className="text-gray-300 mx-1">×</span>
          {product.length.toFixed(2)}{" "}
          <span className="text-gray-400 text-xs">m</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      render: (product) => <StatusBadge active={product.active} />,
    },
    {
      key: "actions",
      header: "Acciones",
      align: "center",
      width: "w-28",
      render: (product) => {
        const actions: RowAction[] = [];
        if (canEdit) {
          actions.push({
            id: "edit",
            label: "Editar",
            icon: <Pencil size={16} />,
            onClick: () => onEdit(product),
          });
          actions.push({
            id: "toggle",
            label: product.active ? "Desactivar" : "Reactivar",
            icon: product.active ? <PowerOff size={16} /> : <Power size={16} />,
            variant: product.active ? "danger" : "primary",
            onClick: () => onToggleActive(product),
          });
        }

        return (
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => onView(product)}
              className="p-2 text-gray-400 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition"
              title="Ver detalle"
            >
              <Eye size={16} />
            </button>
            {actions.length > 0 && <RowActionsMenu items={actions} />}
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={products}
      getRowKey={(p) => p.sku}
      isLoading={loading}
      currentPage={currentPage}
      pageSize={pageSize}
      showRowNumber={true}
      minWidth="min-w-[1000px]"
      getRowClassName={(product) =>
        `group transition-colors ${
          product.active ? "hover:bg-emerald-50/20" : "bg-gray-50/30 opacity-70"
        }`
      }
      emptyState={{
        icon: "Search",
        title: "Sin resultados",
        description: "No se encontraron productos con los filtros actuales.",
      }}
    />
  );
}
