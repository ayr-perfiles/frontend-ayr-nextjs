"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Factory,
  Package,
  History,
  Download,
  TrendingUp,
  Layers,
} from "lucide-react";
import { useProduction } from "@/modules/drywall/hooks/useProduction";
import { useTableData } from "@/hooks/useTableData";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";
import { TableFilters } from "@/components/ui/TableFilters";
import { TablePagination } from "@/components/ui/TablePagination";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { KpiCard } from "@/components/ui/KpiCard";
import type { StockSummary } from "@/types";

export default function DrywallInventoryPage() {
  const router = useRouter();
  const { stock, loading } = useProduction();

  // 1. Logic for filtering and pagination
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
  } = useTableData<StockSummary>({
    data: stock,
    searchFields: ["sku"],
    filters: {
      availability: (row, val) => {
        if (val === "AVAILABLE") return row.totalQuantity > 0;
        if (val === "EMPTY") return row.totalQuantity === 0;
        return true;
      },
    },
  });

  // 2. KPIs
  const kpis = useMemo(() => {
    const totalProducts = stock.length;
    const totalUnits = stock.reduce((acc, s) => acc + s.totalQuantity, 0);
    const totalValuation = stock.reduce(
      (acc, s) => acc + s.totalQuantity * (s.lastCostPerPiece || 0),
      0,
    );
    return { totalProducts, totalUnits, totalValuation };
  }, [stock]);

  // 3. Columns definition
  const columns: ColumnDef<StockSummary>[] = [
    {
      key: "sku",
      header: "Producto (SKU)",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-blue-600 font-black text-sm shadow-inner">
            {row.sku.charAt(0)}
          </div>
          <span className="font-black text-slate-900 uppercase tracking-tight">
            {row.sku}
          </span>
        </div>
      ),
    },
    {
      key: "totalQuantity",
      header: "Unidades Físicas",
      align: "center",
      render: (row) => (
        <div className="flex flex-col items-center">
          <span className={`text-sm font-black ${row.totalQuantity > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
            {row.totalQuantity.toLocaleString("es-PE")} <span className="text-[10px] opacity-60">UND</span>
          </span>
          {row.totalQuantity === 0 && (
            <span className="text-[9px] font-black text-red-400 uppercase tracking-widest mt-0.5">
              Agotado
            </span>
          )}
        </div>
      ),
    },
    {
      key: "lastCostPerPiece",
      header: "Costo Unitario",
      render: (row) => (
        <span className="text-sm font-black text-emerald-600">
          S/ {(row.lastCostPerPiece || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: "totalValue",
      header: "Valor Total",
      align: "right",
      render: (row) => (
        <div className="flex flex-col items-end pr-2">
          <span className="text-sm font-black text-slate-800">
            S/{" "}
            {(row.totalQuantity * (row.lastCostPerPiece || 0)).toLocaleString(
              "es-PE",
              { minimumFractionDigits: 2, maximumFractionDigits: 2 },
            )}
          </span>
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
            Stock PEN
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "center",
      render: (row) => (
        <RowActionsMenu
          items={[
            {
              id: "history",
              label: "Ver producciones",
              icon: <History size={16} />,
              onClick: () =>
                router.push(`/admin/lines/drywall/production?sku=${row.sku}`),
            },
          ]}
        />
      ),
    },
  ];

  // 4. Export logic
  const handleExport = () => {
    const headers = [
      "Producto (SKU)",
      "Unidades Físicas",
      "Costo Unitario (S/)",
      "Valor Total (S/)",
    ];
    const rows = stock.map((item) => {
      const costPerPiece = item.lastCostPerPiece || 0;
      return [
        item.sku,
        item.totalQuantity,
        costPerPiece.toFixed(4),
        (item.totalQuantity * costPerPiece).toFixed(2),
      ];
    });
    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute(
      "download",
      `Inventario_Drywall_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Factory className="text-blue-600" size={32} /> Inventario Drywall
          </h1>
          <p className="text-sm text-slate-500 font-medium italic mt-1">
            Stock valorizado de piezas terminadas de perfilería drywall.
          </p>
        </div>
        <button
          onClick={handleExport}
          className="bg-emerald-600 text-white px-6 py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition shadow-xl shadow-emerald-100 font-black uppercase tracking-widest text-xs"
        >
          <Download size={18} /> Exportar Stock
        </button>
      </header>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard
          label="Total productos"
          value={kpis.totalProducts.toString()}
          icon={<Layers size={18} className="text-blue-600" />}
          bg="bg-blue-50"
        />
        <KpiCard
          label="Total unidades"
          value={kpis.totalUnits.toLocaleString("es-PE")}
          icon={<Package size={18} className="text-slate-600" />}
          bg="bg-slate-50"
        />
        <KpiCard
          label="Valorización Total"
          value={`S/ ${kpis.totalValuation.toLocaleString("es-PE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          icon={<TrendingUp size={18} className="text-emerald-600" />}
          bg="bg-emerald-50"
          valueColor="text-emerald-700"
        />
      </div>

      {/* FILTERS & TABLE */}
      <div className="space-y-4">
        <TableFilters
          search={{
            value: searchValue,
            onChange: setSearchValue,
            placeholder: "Buscar por SKU...",
          }}
          filterGroups={[
            {
              id: "availability",
              label: "Disponibilidad",
              layout: "grid",
              value: filterValues.availability || "TODOS",
              onChange: (v) => setFilterValue("availability", v),
              options: [
                { value: "TODOS", label: "Todos" },
                { value: "AVAILABLE", label: "Con stock" },
                { value: "EMPTY", label: "Agotados" },
              ],
            },
          ]}
          onClearAll={() => {
            setSearchValue("");
            setFilterValue("availability", "TODOS");
          }}
        />

        <DataTable
          columns={columns}
          data={pageItems}
          getRowKey={(s) => s.sku}
          isLoading={loading}
          currentPage={currentPage}
          pageSize={pageSize}
          emptyState={{
            icon: "Package",
            title: "Sin stock registrado",
            description: "Aún no hay productos procesados en planta.",
          }}
        />

        <TablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalFiltered}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
