"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAllQuotations } from "@/core/sales/services/salesService";
import { getAllActiveFulfillmentLogs } from "@/modules/metallic-roofing/services/productionService";
import { bucketLogsBySourceId } from "@/core/production/fulfillmentLogic";
import { getTimestampMillis } from "@/core/production/queueLogic";
import {
  buildQuotationRow,
  getProductionStateLabel,
  getQuotationStateLabel,
  QuotationRow,
} from "@/core/sales/quotationsViewLogic";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";
import { TableFilters } from "@/components/ui/TableFilters";
import { TablePagination } from "@/components/ui/TablePagination";
import { useTableData } from "@/hooks/useTableData";
import type { Sale } from "@/types";
import toast from "react-hot-toast";

export default function QuotationsPage() {
  const [rows, setRows] = useState<QuotationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [quotes, allActiveLogs] = await Promise.all([
          fetchAllQuotations(),
          getAllActiveFulfillmentLogs(),
        ]);
        const buckets = bucketLogsBySourceId(allActiveLogs);

        const builtRows = (quotes as Sale[])
          .map((q) => buildQuotationRow(q, buckets.get(q.id!) ?? []))
          .sort((a, b) => getTimestampMillis(b.timestamp) - getTimestampMillis(a.timestamp));

        if (isMounted) setRows(builtRows);
      } catch (err) {
        console.error("Error al cargar cotizaciones:", err);
        toast.error("No se pudieron cargar las cotizaciones.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const {
    pageItems,
    searchValue,
    setSearchValue,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalFiltered,
  } = useTableData({
    data: rows,
    searchFields: [
      (row) => row.customerName ?? "",
      (row) => row.documentNumber ?? "",
      (row) => row.id ?? "",
      (row) => row.linkedDocument ?? "",
    ],
    pageSize: 50,
  });

  const columns: ColumnDef<QuotationRow>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Documento",
        render: (row) => (
          <p className="font-semibold text-slate-800">{row.id}</p>
        ),
      },
      {
        key: "customer",
        header: "Cliente",
        render: (row) => row.customerName,
      },
      {
        key: "timestamp",
        header: "Fecha",
        render: (row) => {
          const millis = getTimestampMillis(row.timestamp);
          if (millis === Infinity) return <span className="text-slate-400">—</span>;
          const d = new Date(millis);
          return d.toLocaleDateString("es-PE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            timeZone: "America/Lima",
          });
        },
      },
      {
        key: "quotationStatus",
        header: "Estado de Cotización",
        render: (row) => {
          const info = getQuotationStateLabel(row.quotationStatus);
          return (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-widest ${info.colorClass}`}
            >
              {info.label}
            </span>
          );
        },
      },
      {
        key: "productionStatus",
        header: "Estado de Producción",
        render: (row) => {
          const info = getProductionStateLabel(row.productionStatus);
          return (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-widest ${info.colorClass}`}
            >
              {info.label}
            </span>
          );
        },
      },
      {
        key: "origin",
        header: "Origen",
        render: (row) => (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-widest ${
              row.origin === "IMPORTADA"
                ? "bg-slate-100 text-slate-600 border-slate-200"
                : "bg-indigo-50 text-indigo-700 border-indigo-200"
            }`}
          >
            {row.origin === "IMPORTADA" ? "Importada" : "Nativa"}
          </span>
        ),
      },
      {
        key: "linkedDocument",
        header: "Comprobante Vinculado",
        render: (row) => row.linkedDocument || <span className="text-slate-400">—</span>,
      },
    ],
    [],
  );

  return (
    <div className="space-y-6 relative pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cotizaciones</h1>
          <p className="text-slate-500 font-medium mt-1">
            Todas las cotizaciones (perchas importadas y nativas), con su estado de producción.
          </p>
        </div>
        <span className="text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
          {totalFiltered} {searchValue.trim() ? "resultados" : "cotizaciones"}
        </span>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
        <TableFilters
          search={{
            value: searchValue,
            onChange: setSearchValue,
            placeholder: "Buscar por cliente, documento o comprobante...",
          }}
        />

        <div className="p-4">
          <DataTable
            columns={columns}
            data={pageItems}
            getRowKey={(row) => row.id}
            isLoading={loading}
            currentPage={currentPage}
            pageSize={pageSize}
            emptyState={{
              icon: "FileText",
              title: "No hay cotizaciones",
              description: "No se encontraron cotizaciones con los filtros actuales.",
            }}
          />
          <TablePagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={totalFiltered}
            onPageChange={setCurrentPage}
            pageSizeOptions={[15, 30, 50, 100]}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>
    </div>
  );
}
