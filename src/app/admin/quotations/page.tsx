"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, CheckCircle2 } from "lucide-react";
import { fetchAllQuotations, markQuotationAccepted } from "@/core/sales/services/salesService";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { getAllActiveFulfillmentLogs } from "@/modules/metallic-roofing/services/productionService";
import { bucketLogsBySourceId } from "@/core/production/fulfillmentLogic";
import { getTimestampMillis } from "@/core/production/queueLogic";
import {
  buildQuotationRow,
  getProductionStateLabel,
  getQuotationStateLabel,
  canEditQuotation,
  canAcceptQuotation,
  QuotationRow,
} from "@/core/sales/quotationsViewLogic";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";
import { TableFilters } from "@/components/ui/TableFilters";
import { TablePagination } from "@/components/ui/TablePagination";
import { useTableData } from "@/hooks/useTableData";
import type { Sale } from "@/types";
import toast from "react-hot-toast";

export default function QuotationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [rows, setRows] = useState<QuotationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

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

  // [QUOTATION-APPROVE-UNREACHABLE] (COLA #1). El copy del diálogo dice EXPLÍCITAMENTE
  // que aceptar no mueve stock: confundir "aceptada" con "vendida" es la confusión más
  // cara posible en este ERP — el otro camino (`approveQuotation`) sí descuenta stock,
  // emite kardex y marca la bobina SOLD.
  const handleAccept = async (row: QuotationRow) => {
    const ok = await confirm({
      title: "Marcar aceptación del cliente",
      message: `¿El cliente aceptó la cotización ${row.id}? Esto SOLO deja registrada la aceptación y su fecha. NO descuenta stock, no genera venta y no emite comprobante — el stock se mueve recién cuando la venta se concreta.`,
      variant: "default",
      confirmLabel: "Sí, el cliente aceptó",
    });
    if (!ok) return;

    setAcceptingId(row.id);
    try {
      await markQuotationAccepted(row.id, user?.email || "usuario");
      // Se refleja en memoria en vez de re-fetchear toda la tabla: el único campo
      // que cambió es el flag, y `clientAcceptedAt` no se muestra en esta vista.
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, clientAccepted: true } : r)),
      );
      toast.success(`Aceptación registrada para ${row.id}. No se movió stock.`);
    } catch (err) {
      console.error("Error al marcar la aceptación:", err);
      toast.error(err instanceof Error ? err.message : "No se pudo registrar la aceptación.");
    } finally {
      setAcceptingId(null);
    }
  };

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
      {
        key: "acceptance",
        header: "Aceptación",
        // [QUOTATION-APPROVE-UNREACHABLE] (COLA #1). Eje ADITIVO, independiente del
        // estado: una cotización Vigente puede estar aceptada o no. Aceptar NO es
        // vender — no mueve stock ni cambia `status`.
        render: (row) =>
          row.clientAccepted ? (
            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-[10px] font-black border border-green-200 uppercase tracking-widest">
              <CheckCircle2 size={12} /> Aceptada
            </span>
          ) : (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Sin aceptar
            </span>
          ),
      },
      {
        key: "actions",
        header: "",
        render: (row) => (
          <div className="flex items-center gap-2 justify-end">
            {/* U2.2: el boton solo aparece donde `markQuotationAccepted` aceptaria —
                NATIVA + QUOTATION + no aceptada todavia. Nunca se ofrece algo que el
                escritor va a rechazar (mismo criterio que canEditQuotation). */}
            {canAcceptQuotation(row) ? (
              <button
                onClick={() => handleAccept(row)}
                disabled={acceptingId === row.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 transition disabled:opacity-50"
              >
                <CheckCircle2 size={12} /> {acceptingId === row.id ? "Guardando…" : "Aceptó"}
              </button>
            ) : null}
            {/* E3-2: el boton solo aparece donde el callable aceptaria la edicion
                (NATIVA + QUOTATION). Nunca se ofrece algo que el backend rechazaria. */}
            {canEditQuotation(row) ? (
              <button
                onClick={() => router.push(`/admin/quotations/${row.id}/edit`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition"
              >
                <Pencil size={12} /> Editar
              </button>
            ) : null}
          </div>
        ),
      },
    ],
    // `router` VA en las deps: el render de esta columna cierra sobre el. Sin esto se
    // reintroduce el stale closure de v6.43 que dejo "Ver cotizacion" muerto en la cola.
    // `acceptingId` y `handleAccept` van por el MISMO motivo: la columna de acciones
    // cierra sobre los dos. Sin `acceptingId`, el boton nunca mostraria "Guardando…";
    // sin `handleAccept`, el click quedaria pegado a un `user`/`rows` viejos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, acceptingId, handleAccept],
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
