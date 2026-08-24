import { Sale } from "@/types";
import { isImportedQuotation } from "@/core/import/salesImportLogic";
import { resolveCustomerDoc, canDuplicate } from "@/core/sales/salesDisplayLogic";
import { TableFilters } from "@/components/ui/TableFilters";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";

import { RowActionsMenu, RowAction } from "@/components/ui/RowActionsMenu";
import {
  CheckCircle2,
  FileText,
  TrendingUp,
  Scale,
  AlertCircle,
  Eye,
  Edit,
  XCircle,
  Copy,
  Link as LinkIcon,
  CloudOff,
  Loader2,
  Factory,
} from "lucide-react";

// --- COMPONENTE INTERNO: SUNAT BADGE ---
function SunatBadge({ sunat, onClick }: { sunat: Sale["sunat"]; onClick: () => void }) {
  const estado = sunat?.estado || "NO_EMITIDO";

  const config: Record<string, { label: string; cls: string; icon: any }> = {
    ACEPTADO: {
      label: sunat?.documentId || "ACEPTADO",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
      icon: <CheckCircle2 size={10} />,
    },
    RECHAZADO: {
      label: "RECHAZADO",
      cls: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
      icon: <AlertCircle size={10} />,
    },
    BAJA_PENDIENTE: {
      label: "BAJA PEND.",
      cls: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
      icon: <Loader2 size={10} className="animate-spin" />,
    },
    BAJA_ACEPTADA: {
      label: "ANULADO SUNAT",
      cls: "bg-slate-100 text-slate-500 border-slate-200 line-through opacity-70",
      icon: <XCircle size={10} />,
    },
    PENDIENTE: {
      label: "PENDIENTE",
      cls: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
      icon: <Loader2 size={10} className="animate-spin" />,
    },
    NO_EMITIDO: {
      label: "NO EMITIDO",
      cls: "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100",
      icon: <CloudOff size={10} />,
    },
  };

  const c = config[estado] || config.NO_EMITIDO;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-black border uppercase tracking-tighter transition-all ${c.cls}`}
    >
      {c.icon}
      {c.label}
    </button>
  );
}

interface SalesTableProps {
  displaySales: Sale[];
  isLoading: boolean;
  role: string | null | undefined;
  isProcessing: boolean;
  currentPage: number;
  pageSize: number;
  onDuplicate: (saleId: string, status: Sale["status"]) => void;
  onApprove: (sale: Sale) => void;
  onViewDetails: (sale: Sale) => void;
  onEdit: (saleId: string) => void;
  onCancel: (saleId: string) => void;
}

export function SalesTable({
  displaySales,
  isLoading,
  role,
  isProcessing,
  currentPage,
  pageSize,
  onDuplicate,
  onApprove,
  onViewDetails,
  onEdit,
  onCancel,
}: SalesTableProps) {
  const columns: ColumnDef<Sale>[] = [
    {
      key: "document",
      header: "Documento",
      render: (sale) => (
        <div className="pl-2">
          <p className="text-sm font-black text-blue-900 uppercase tracking-wider mb-1">
            {sale.id}
          </p>
          <p className="text-[10px] font-bold text-slate-400">
            {sale.timestamp?.toDate
              ? sale.timestamp.toDate().toLocaleString("es-PE", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "Reciente"}
          </p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Cliente",
      render: (sale) => {
        const { comprobante } = resolveCustomerDoc(sale);
        return (
          <div>
            <p className="font-bold text-slate-700 uppercase text-sm mb-1">
              {sale.customerName}
            </p>
            {comprobante && (
              <p className="text-xs font-medium text-slate-400">
                Comp: {comprobante}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Estado",
      render: (sale) => (
        <div>
          {sale.status === "COMPLETED" && (
            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-[10px] font-black border border-green-200 uppercase tracking-widest">
              <CheckCircle2 size={12} /> Venta Cerrada
            </span>
          )}
          {sale.status === "QUOTATION" && (
            isImportedQuotation(sale) ? (
              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-[10px] font-black border border-slate-200 uppercase tracking-widest">
                <Factory size={12} /> Producción
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full text-[10px] font-black border border-orange-200 uppercase tracking-widest">
                <FileText size={12} /> Cot. Pendiente
              </span>
            )
          )}
          {sale.status === "CONVERTED" && (
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-[10px] font-black border border-slate-200 uppercase tracking-widest">
              <CheckCircle2 size={12} /> Cot. Aprobada
            </span>
          )}
          {sale.status === "CANCELLED" && (
            <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 px-2.5 py-1 rounded-full text-[10px] font-black border border-red-100 uppercase tracking-widest">
              <XCircle size={12} /> Rechazada
            </span>
          )}
          {sale.status === "VOIDED" && (
            <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2.5 py-1 rounded-full text-[10px] font-black border border-red-200 uppercase tracking-widest">
              <AlertCircle size={12} /> Anulada
            </span>
          )}
          {sale.businessLines && sale.businessLines.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {sale.businessLines.map((line) => {
                const config: Record<string, { label: string; cls: string }> = {
                  drywall: { label: "DRY", cls: "bg-blue-50 text-blue-600 border-blue-100" },
                  roofing: { label: "UPVC", cls: "bg-emerald-50 text-emerald-600 border-emerald-100" },
                  "metallic-roofing": { label: "ALU", cls: "bg-zinc-50 text-zinc-600 border-zinc-100" },
                  trading: { label: "TRD", cls: "bg-amber-50 text-amber-600 border-amber-100" },
                  services: { label: "SRV", cls: "bg-violet-50 text-violet-600 border-violet-100" },
                };
                const c = config[line] || { label: line.substring(0, 3).toUpperCase(), cls: "bg-gray-50 text-gray-600 border-gray-100" };
                return (
                  <span
                    key={line}
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter ${c.cls}`}
                  >
                    {c.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "comprobante",
      header: <span className="text-blue-600">Comprobante</span>,
      render: (sale) => (
        sale.status === "COMPLETED" ? (
          <SunatBadge sunat={sale.sunat} onClick={() => onViewDetails(sale)} />
        ) : null
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (sale) => {
        const saleWeight = (sale as any).totalWeight || 0;
        return (
          <div>
            <p className="font-black text-slate-800 text-base">
              S/{" "}
              {sale.totalAmount?.toLocaleString("es-PE", {
                minimumFractionDigits: 2,
              })}
            </p>
            {saleWeight > 0 && (
              <p className="text-[10px] font-bold text-slate-400 flex items-center justify-end gap-1 mt-0.5">
                <Scale size={10} />{" "}
                {saleWeight.toLocaleString("es-PE")} kg
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "profit",
      header: <span className="text-emerald-600">Ganancia / Rastro</span>,
      align: "right",
      render: (sale) => (
        <div>
          {sale.status === "COMPLETED" && (
            <span
              className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded text-xs ${(sale.totalProfit || 0) < 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}
            >
              <TrendingUp size={12} /> S/{" "}
              {(sale.totalProfit || 0).toLocaleString("es-PE", {
                minimumFractionDigits: 2,
              })}
            </span>
          )}
          {sale.status === "QUOTATION" && (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              En espera
            </span>
          )}
          {sale.status === "CONVERTED" && (
            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center justify-end gap-1">
              <LinkIcon size={10} /> {(sale as any).convertedToId}
            </span>
          )}
          {(sale.status === "CANCELLED" || sale.status === "VOIDED") && (
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
              Sin efecto
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "center",
      width: "w-28",
      render: (sale) => {
        const actions: RowAction[] = [
          {
            id: "duplicate",
            label: "Duplicar Operación",
            icon: <Copy size={16} />,
            onClick: () => onDuplicate(sale.id!, sale.status),
            variant: "primary",
            hidden: !canDuplicate(sale.status),
          },
        ];

        if (sale.status === "QUOTATION") {
          actions.push(
            {
              id: "edit",
              label: "Editar Cotización",
              icon: <Edit size={16} />,
              onClick: () => onEdit(sale.id!),
              variant: "warning",
              section: "quotation",
              // Ruta /admin/sales/[id]/edit inexistente (404) — reactivar en #9-B.2, no antes.
              hidden: true,
            },
            {
              id: "approve",
              label: "Aprobar Venta",
              icon: <CheckCircle2 size={16} />,
              onClick: () => onApprove(sale),
              variant: "primary",
              loading: isProcessing,
              disabled: isProcessing,
              hidden: !(role === "ADMIN" || role === "SUPERVISOR") || isImportedQuotation(sale),

              section: "quotation",
            },
            {
              id: "cancel",
              label: "Rechazar / Cancelar",
              icon: <XCircle size={16} />,
              onClick: () => onCancel(sale.id!),
              variant: "danger",
              section: "quotation",
              // Importada = percha de venta ya facturada; cancelarla sin cascada deja dato
              // inconsistente (bug confirmado en el PASO 0 de #9-B). Bloqueado también en
              // cancelQuotation (backend) — esto es defensa de UI, no el único guard.
              hidden: isImportedQuotation(sale),
            }
          );
        }

        return (
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => onViewDetails(sale)}
              className="p-2 text-slate-400 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition"
              title="Ver Detalles"
            >
              <Eye size={18} />
            </button>
            <RowActionsMenu items={actions} />
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={displaySales}
      getRowKey={(s) => s.id!}
      isLoading={isLoading}
      currentPage={currentPage}
      pageSize={pageSize}
      emptyState={{
        icon: "Receipt",
        title: "No hay resultados",
        description: "No se encontraron operaciones con los filtros actuales.",
      }}
    />
  );
}
