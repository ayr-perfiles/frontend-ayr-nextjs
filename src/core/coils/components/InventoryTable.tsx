"use client";
import React from "react";
import { Eye, AlertTriangle, ExternalLink, Tag, AlertCircle, RotateCcw, Scissors, Edit2, Trash2, Scale } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { Coil } from "@/types";
import { WeightIndicator } from "./WeightIndicator";
import { useFinishes } from "@/core/coils/hooks/useFinishes";
import Link from "next/link";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";
import { RowActionsMenu, RowAction } from "@/components/ui/RowActionsMenu";

interface InventoryTableProps {
  displayCoils: Coil[];
  role: string | null | undefined;
  currentPage: number;
  pageSize: number;
  selectedIds: string[];
  orderMapping?: Record<string, string>; // Mapping coilId -> cutOrderId
  onSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onEdit: (coil: Coil) => void;
  onVoid: (coilId: string) => void;
  onCancelPlan: (coilId: string) => void;
  onDeleteDraft?: (coilId: string) => void;
  onReverseSplit?: (childId: string) => void;
  onToggleClose?: (coil: Coil) => void;
  onSendToCut?: (coil: Coil) => void;
  onSplit?: (coil: Coil) => void;
  onViewDetails: (coil: Coil) => void;
  onAssignFinish?: (coil: Coil) => void;
  onScrap?: (coil: Coil) => void;
  isLoading?: boolean;
}

function StatusBadge({ status, orderId }: { status: string; orderId?: string }) {
  const styles: Record<string, string> = {
    AVAILABLE: "bg-green-100 text-green-700 border-green-200",
    IN_PROGRESS: "bg-orange-100 text-orange-700 border-orange-200",
    PROCESSED: "bg-slate-100 text-slate-600 border-slate-200",
    VOIDED: "bg-red-100 text-red-700 border-red-200 line-through opacity-80",
    EN_TERCERO: "bg-amber-100 text-amber-700 border-amber-200",
    SOLD: "bg-purple-100 text-purple-700 border-purple-200",
    SPLIT_PARENT: "bg-sky-100 text-sky-700 border-sky-200",
  };
  const labels: Record<string, string> = {
    AVAILABLE: "DISPONIBLE",
    IN_PROGRESS: "EN PROCESO",
    PROCESSED: "PROCESADA",
    VOIDED: "ANULADA",
    EN_TERCERO: "EN TERCERO",
    SOLD: "VENDIDA",
    SPLIT_PARENT: "PARTIDA",
  };
  return (
    <div className="flex flex-col gap-1 items-center">
      <span
        className={`px-2.5 py-1 rounded-full text-[10px] font-black border tracking-widest text-center ${styles[status]}`}
      >
        {labels[status] || status}
      </span>
      {status === 'EN_TERCERO' && orderId && (
        <Link 
          href={`/admin/coils/cut-orders`}
          className="flex items-center justify-center gap-1 text-[9px] font-bold text-amber-600 hover:text-amber-800 transition uppercase tracking-tighter"
        >
          ORDEN #{orderId.slice(-6)} <ExternalLink size={8} />
        </Link>
      )}
    </div>
  );
}

function FinishBadge({
  finishId,
  finishes,
  onAssign,
}: {
  finishId?: string;
  finishes: any[];
  onAssign?: () => void;
}) {
  if (!finishId) {
    return (
      <div className="flex flex-col gap-1 items-start">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-black uppercase">
          SIN ACABADO
        </span>
        {onAssign && (
          <button 
            onClick={onAssign}
            className="flex items-center gap-1 text-[9px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-tighter"
          >
            <Tag size={10} /> Asignar
          </button>
        )}
      </div>
    );
  }

  const finish = finishes.find((f) => f.id === finishId);
  return (
    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200 text-[10px] font-black uppercase whitespace-nowrap">
      {finish?.label || finishId}
    </span>
  );
}

const formatDate = (
  dateValue: Timestamp | Date | string | null | undefined,
) => {
  if (!dateValue) return "Sin fecha";
  if (dateValue instanceof Timestamp) {
    return dateValue.toDate().toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export default function InventoryTable({
  displayCoils,
  role,
  currentPage,
  pageSize,
  selectedIds,
  orderMapping = {},
  onSelect,
  onSelectAll,
  onEdit,
  onVoid,
  onCancelPlan,
  onDeleteDraft,
  onReverseSplit,
  onToggleClose,
  onSendToCut,
  onSplit,
  onViewDetails,
  onAssignFinish,
  onScrap,
  isLoading = false,
}: InventoryTableProps) {
  const { finishes } = useFinishes(true);

  const availableCoils = displayCoils.filter(c => c.status === 'AVAILABLE');
  const allAvailableSelected = availableCoils.length > 0 && availableCoils.every(c => selectedIds.includes(c.id));

  const columns: ColumnDef<Coil>[] = [
    {
      key: "selection",
      header: (
        <input 
          type="checkbox"
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          onChange={(e) => {
            if (e.target.checked) {
              onSelectAll(availableCoils.map(c => c.id));
            } else {
              onSelectAll([]);
            }
          }}
          checked={allAvailableSelected}
        />
      ),
      align: "center",
      width: "w-10",
      render: (coil) => (
        <input 
          type="checkbox"
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-30"
          checked={selectedIds.includes(coil.id)}
          onChange={() => onSelect(coil.id)}
          disabled={coil.status !== 'AVAILABLE'}
        />
      )
    },
    {
      key: "id",
      header: "Serie",
      render: (coil) => (
        <div className="flex flex-col">
          <span
            className={`font-black ${coil.status === "VOIDED" ? "text-red-400 line-through" : "text-blue-900"}`}
          >
            {coil.id}
          </span>
          {coil.metadata?.provider && (
            <span className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
              {coil.metadata.provider}
            </span>
          )}
        </div>
      )
    },
    {
      key: "finish",
      header: "Acabado",
      render: (coil) => (
        <FinishBadge 
          finishId={coil.finish} 
          finishes={finishes} 
          onAssign={() => onAssignFinish?.(coil)} 
        />
      )
    },
    {
      key: "date",
      header: "Fecha Ingreso",
      render: (coil) => (
        <div
          className={`text-sm font-bold ${coil.status === "VOIDED" ? "text-gray-400 line-through" : "text-gray-700"}`}
        >
          {formatDate(coil.metadata?.invoiceDate || coil.createdAt)}
        </div>
      )
    },
    {
      key: "material",
      header: (
        <>
          Material <span className="text-gray-400 normal-case font-normal">(Ancho x Esp)</span>
        </>
      ),
      render: (coil) => (
        <div className={`text-sm font-medium ${coil.status === "VOIDED" ? "text-gray-400 line-through" : "text-gray-600"}`}>
          {coil.masterWidth}{" "}
          <span className="text-gray-400 mx-0.5 text-[10px]">mm</span>
          <span className="text-gray-300 mx-1">x</span>
          {coil.thickness}{" "}
          <span className="text-gray-400 mx-0.5 text-[10px]">mm</span>
        </div>
      )
    },
    {
      key: "valuation",
      header: "Valorización",
      render: (coil) => {
        const totalValuePEN = (coil.currentWeight || 0) * (coil.pricePerKg || 0);
        const isUSD = coil.metadata?.currency === 'USD';
        const exchangeRate = coil.metadata?.exchangeRate || 1;
        const totalValueUSD = isUSD ? totalValuePEN / exchangeRate : 0;
        return (
          <div className="flex flex-col">
             <span className="text-xs font-black text-slate-700">S/ {totalValuePEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
             {isUSD && (
               <span className="text-[10px] font-bold text-slate-400 uppercase italic">
                 $ {totalValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} (TC {exchangeRate})
               </span>
             )}
          </div>
        );
      }
    },
    {
      key: "stock",
      header: "Stock Disponible",
      width: "w-60",
      render: (coil) => (
        <div className={coil.status === "VOIDED" ? "opacity-50 grayscale" : ""}>
          <WeightIndicator
            current={coil.currentWeight || 0}
            initial={coil.initialWeight || 0}
          />
        </div>
      )
    },
    {
      key: "responsible",
      header: "Responsable",
      render: (coil) => {
        const creatorEmail = coil.registeredBy || "Sistema";
        const initial = creatorEmail.charAt(0).toUpperCase();
        return (
          <div className={`flex items-center gap-2 ${coil.status === "VOIDED" ? "opacity-50 grayscale" : ""}`}>
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-[10px] shrink-0">
              {initial}
            </div>
            <span
              className="text-xs font-medium text-gray-600 truncate max-w-[120px]"
              title={creatorEmail}
            >
              {creatorEmail.split("@")[0]}
            </span>
          </div>
        );
      }
    },
    {
      key: "status",
      header: "Estado",
      render: (coil) => (
        <div className="flex flex-col gap-1 items-center">
          <StatusBadge status={coil.status} orderId={orderMapping[coil.id]} />
          {coil.isClosed && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black border tracking-widest text-center bg-slate-800 text-white border-slate-900">
              CERRADA
            </span>
          )}
        </div>
      )
    },
    {
      key: "actions",
      header: "Acciones",
      align: "center",
      width: "w-32",
      render: (coil) => {
        if (coil.status === "VOIDED") {
          if (role === "ADMIN") {
            return (
              <div className="flex items-center justify-center gap-1">
                <span className="flex items-center justify-center gap-1 text-[10px] font-black text-red-400 uppercase tracking-widest">
                  <AlertCircle size={14} /> Sin Efecto
                </span>
                <RowActionsMenu
                  items={[
                    {
                      id: "deleteDraft",
                      label: "Eliminar borrador",
                      icon: <Trash2 size={16} />,
                      variant: "danger",
                      section: "danger",
                      onClick: () => onDeleteDraft?.(coil.id),
                    },
                  ]}
                />
              </div>
            );
          }
          return (
            <span className="flex items-center justify-center gap-1 text-[10px] font-black text-red-400 uppercase tracking-widest">
              <AlertCircle size={14} /> Sin Efecto
            </span>
          );
        }

        const actions: RowAction[] = [];

        if (role === "ADMIN" && !["SOLD", "VOIDED"].includes(coil.status)) {
          actions.push({
            id: "toggleClose",
            label: coil.isClosed ? "Abrir bobina" : "Cerrar bobina",
            icon: <AlertCircle size={16} />,
            variant: "warning",
            onClick: () => onToggleClose?.(coil),
          });
        }

        if (role === "ADMIN" && !["SOLD"].includes(coil.status)) {
          actions.push({
            id: "scrap",
            label: "Registrar Merma",
            icon: <Scale size={16} />,
            variant: "warning",
            onClick: () => onScrap?.(coil),
          });
        }

        if (role === "ADMIN" && coil.status === "IN_PROGRESS") {
          actions.push({
            id: "cancelPlan",
            label: "Cancelar Plan",
            icon: <RotateCcw size={16} />,
            variant: "warning",
            onClick: () => onCancelPlan(coil.id),
          });
        }

        if (role === "ADMIN" && coil.status === "EN_TERCERO") {
          actions.push({
            id: "enTerceroInfo",
            label: "En corte externo",
            icon: <AlertCircle size={16} />,
            onClick: () => {},
            disabled: true,
          });
        }

        if (role === "ADMIN" && coil.status === "AVAILABLE") {
          if (coil.parentCoilId) {
            actions.push({
              id: "reverseSplit",
              label: "Revertir split",
              icon: <RotateCcw size={16} />,
              variant: "danger",
              section: "danger",
              onClick: () => onReverseSplit?.(coil.id),
            });
          }
          actions.push(
            {
              id: "sendToCut",
              label: "Enviar a Corte",
              icon: <Scissors size={16} />,
              variant: "primary",
              onClick: () => onSendToCut?.(coil),
            },
            {
              id: "split",
              label: "Partir Bobina",
              icon: <Scissors size={16} />,
              variant: "warning",
              onClick: () => onSplit?.(coil),
            },
            {
              id: "edit",
              label: "Editar",
              icon: <Edit2 size={16} />,
              onClick: () => onEdit(coil),
            },
            {
              id: "void",
              label: "Anular",
              icon: <Trash2 size={16} />,
              variant: "danger",
              section: "danger",
              onClick: () => onVoid(coil.id),
            }
          );
        }

        return (
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => onViewDetails(coil)}
              className="p-2 text-gray-400 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition"
              title="Ver Ficha Técnica"
            >
              <Eye size={18} />
            </button>
            {actions.length > 0 && <RowActionsMenu items={actions} />}
          </div>
        );
      }
    }
  ];

  return (
    <DataTable
      columns={columns}
      data={displayCoils}
      getRowKey={(c) => c.id}
      isLoading={isLoading}
      currentPage={currentPage}
      pageSize={pageSize}
      showRowNumber={true}
      minWidth="min-w-[1200px]"
      emptyState={{
        icon: "Search",
        title: "No hay resultados",
        description: "No se encontraron bobinas con los filtros actuales.",
      }}
    />
  );
}
