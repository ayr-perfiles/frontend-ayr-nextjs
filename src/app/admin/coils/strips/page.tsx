"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { listStripsStock } from "@/core/coils/services/stripsStockService";
import { StripStock } from "@/types";
import { 
  Boxes, 
  Factory, 
  History, 
  Scale, 
  Calculator, 
  LayoutDashboard,
  TrendingUp,
  Package
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";
import { TableFilters } from "@/components/ui/TableFilters";
import { TablePagination } from "@/components/ui/TablePagination";
import { useTableData } from "@/hooks/useTableData";
import { ProductionModal } from "./ProductionModal";
import { MovementsModal } from "./MovementsModal";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";

export default function StripsInventoryPage() {
  const { role } = useAuth();
  const [strips, setStrips] = useState<StripStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals state
  const [selectedStripForProd, setSelectedStripForProd] = useState<StripStock | null>(null);
  const [selectedWidthForMoves, setSelectedWidthForMoves] = useState<number | null>(null);

  const fetchStrips = async () => {
    setIsLoading(true);
    try {
      const data = await listStripsStock();
      setStrips(data);
    } catch (err) {
      console.error("Error fetching strips stock:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStrips();
  }, []);

  // Table Logic
  const {
    pageItems,
    currentPage,
    setCurrentPage,
    pageSize,
    searchValue,
    setSearchValue,
    filterValues,
    setFilterValue,
    totalFiltered,
  } = useTableData<StripStock>({
    data: strips,
    pageSize: 15,
    searchFields: [(s) => String(s.widthMm)],
    filters: {
      availability: (row, val) => {
        if (val === 'AVAILABLE') return row.totalStrips > 0;
        if (val === 'EMPTY') return row.totalStrips === 0;
        return true;
      }
    }
  });

  // Summary KPIs
  const kpis = useMemo(() => {
    const totalDistinctWidths = strips.length;
    const totalUnits = strips.reduce((acc, s) => acc + s.totalStrips, 0);
    const totalValuation = strips.reduce((acc, s) => acc + (s.totalWeight * (s.avgCostPerKg || 0)), 0);
    return { totalDistinctWidths, totalUnits, totalValuation };
  }, [strips]);

  const columns: ColumnDef<StripStock>[] = [
    {
      key: 'width',
      header: 'Ancho',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 font-black text-sm shadow-inner">
            {row.widthMm}
          </div>
          <span className="font-black text-slate-900 uppercase tracking-tight">Fleje {row.widthMm}mm</span>
        </div>
      )
    },
    {
      key: 'totalStrips',
      header: 'Disponibles',
      align: 'center',
      render: (row) => (
        <div className="flex flex-col items-center">
          <span className={`text-sm font-black ${row.totalStrips > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
            {row.totalStrips} <span className="text-[10px] opacity-60">UND</span>
          </span>
          {row.totalStrips === 0 && <span className="text-[9px] font-black text-red-400 uppercase tracking-widest mt-0.5">Agotado</span>}
        </div>
      )
    },
    {
      key: 'totalWeight',
      header: 'Peso Total',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Scale size={14} className="text-slate-300" />
          <span className="text-sm font-bold text-slate-600">{row.totalWeight.toLocaleString('es-PE')} <span className="text-[10px] text-slate-400 font-medium">kg</span></span>
        </div>
      )
    },
    {
      key: 'avgCost',
      header: 'Costo Prom. (WAC)',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Calculator size={14} className="text-slate-300" />
          <span className="text-sm font-black text-blue-600">S/ {(row.avgCostPerKg || 0).toFixed(2)} <span className="text-[10px] text-blue-400 font-medium lowercase">/kg</span></span>
        </div>
      )
    },
    {
      key: 'valuation',
      header: 'Valorización',
      align: 'right',
      render: (row) => (
        <div className="flex flex-col items-end pr-2">
          <span className="text-sm font-black text-slate-800">S/ {(row.totalWeight * (row.avgCostPerKg || 0)).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Stock PEN</span>
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'center',
      render: (row) => (
        <RowActionsMenu
          items={[
            {
              id: 'produce',
              label: 'Producir',
              icon: <Factory size={16} />,
              variant: 'primary',
              disabled: row.totalStrips <= 0,
              onClick: () => setSelectedStripForProd(row)
            },
            {
              id: 'movements',
              label: 'Ver movimientos',
              icon: <History size={16} />,
              onClick: () => setSelectedWidthForMoves(row.widthMm)
            }
          ]}
        />
      )
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Boxes className="text-blue-600" size={32} /> Inventario de Flejes
          </h1>
          <p className="text-sm text-slate-500 font-medium italic mt-1">Stock tercerizado para producción de perfiles drywall.</p>
        </div>
      </header>

      {/* INDICATORS BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Anchos Distintos</p>
            <p className="text-2xl font-black text-slate-800">{kpis.totalDistinctWidths}</p>
          </div>
        </div>
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500">
            <Package size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Unidades</p>
            <p className="text-2xl font-black text-slate-800">{kpis.totalUnits.toLocaleString('es-PE')} <span className="text-xs">UND</span></p>
          </div>
        </div>
        <div className="bg-blue-600 border border-blue-500 rounded-3xl p-5 shadow-lg shadow-blue-100 flex items-center gap-4 text-white">
          <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-blue-100">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Valorización Total (WAC)</p>
            <p className="text-2xl font-black">S/ {kpis.totalValuation.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="space-y-4">
        <TableFilters 
          search={{ 
            value: searchValue, 
            onChange: setSearchValue,
            placeholder: "Buscar por ancho (mm)..." 
          }}
          filterGroups={[
            {
              id: 'availability',
              label: 'Disponibilidad',
              layout: 'grid',
              value: filterValues.availability || 'TODOS',
              onChange: (v) => setFilterValue('availability', v),
              options: [
                { value: 'TODOS', label: 'Todos' },
                { value: 'AVAILABLE', label: 'Con stock' },
                { value: 'EMPTY', label: 'Agotados' }
              ]
            }
          ]}
          onClearAll={() => {
            setSearchValue('');
            setFilterValue('availability', 'TODOS');
          }}
        />

        <DataTable
          columns={columns}
          data={pageItems}
          getRowKey={(r) => String(r.widthMm)}
          isLoading={isLoading}
          currentPage={currentPage}
          pageSize={pageSize}
          emptyState={{ 
            icon: 'Boxes', 
            title: 'No hay flejes disponibles', 
            description: 'Registra recepción de flejes desde las órdenes de corte externo para poblar este inventario.' 
          }}
        />

        <TablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalFiltered}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* MODALS */}
      {selectedStripForProd && (
        <ProductionModal 
          strip={selectedStripForProd} 
          onClose={(refresh) => {
            setSelectedStripForProd(null);
            if (refresh) fetchStrips();
          }} 
        />
      )}

      {selectedWidthForMoves !== null && (
        <MovementsModal 
          widthMm={selectedWidthForMoves} 
          onClose={() => setSelectedWidthForMoves(null)} 
        />
      )}
    </div>
  );
}

