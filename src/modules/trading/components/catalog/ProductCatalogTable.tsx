"use client";

import React from "react";
import { Eye, Pencil, PowerOff, Power } from "lucide-react";
import type { TradingProduct } from "../../types";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";
import { RowActionsMenu, RowAction } from "@/components/ui/RowActionsMenu";

function CategoryBadge({ category }: { category: string }) {
  const cls: Record<string, string> = {
    POLICARBONATO: "bg-amber-100 text-amber-700",
    TUBO: "bg-blue-100 text-blue-700",
    AUTOPERFORANTE: "bg-zinc-100 text-zinc-700",
    ACCESORIO: "bg-purple-100 text-purple-700",
    OTRO: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
        cls[category] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {category}
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
  products: TradingProduct[];
  loading: boolean;
  canEdit: boolean;
  onView: (product: TradingProduct) => void;
  onEdit: (product: TradingProduct) => void;
  onToggleActive: (product: TradingProduct) => void;
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
  const columns: ColumnDef<TradingProduct>[] = [
    {
      key: "sku",
      header: "SKU",
      render: (product) => (
        <span
          className={`font-black font-mono text-sm ${
            product.active ? "text-amber-800" : "text-gray-400"
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
      key: "category",
      header: "Categoría",
      render: (product) => <CategoryBadge category={product.category} />,
    },
    {
      key: "color",
      header: "Color",
      render: (product) => (
        <span className="text-sm font-bold text-gray-600">
          {product.color || "—"}
        </span>
      ),
    },
    {
      key: "spec",
      header: "Especificación",
      render: (product) => (
        <span className="text-sm text-gray-600">{product.spec || "—"}</span>
      ),
    },
    {
      key: "unit",
      header: "Unidad",
      render: (product) => (
        <span className="text-sm font-bold text-gray-600">{product.unit}</span>
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
          product.active ? "hover:bg-amber-50/20" : "bg-gray-50/30 opacity-70"
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
