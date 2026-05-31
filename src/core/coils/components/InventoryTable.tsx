"use client";
import React from "react";
import { Search, Eye, AlertTriangle, ExternalLink, Tag, DollarSign } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { Coil } from "@/types";
import { WeightIndicator } from "./WeightIndicator";
import InventoryActions from "./InventoryActions";
import { useFinishes } from "@/core/coils/hooks/useFinishes";
import Link from "next/link";

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
  onSendToCut?: (coil: Coil) => void;
  onViewDetails: (coil: Coil) => void;
  onAssignFinish?: (coil: Coil) => void;
}

function StatusBadge({ status, orderId }: { status: string; orderId?: string }) {
  const styles: Record<string, string> = {
    AVAILABLE: "bg-green-100 text-green-700 border-green-200",
    IN_PROGRESS: "bg-orange-100 text-orange-700 border-orange-200",
    PROCESSED: "bg-slate-100 text-slate-600 border-slate-200",
    VOIDED: "bg-red-100 text-red-700 border-red-200 line-through opacity-80",
    EN_TERCERO: "bg-amber-100 text-amber-700 border-amber-200",
  };
  const labels: Record<string, string> = {
    AVAILABLE: "DISPONIBLE",
    IN_PROGRESS: "EN PROCESO",
    PROCESSED: "PROCESADA",
    VOIDED: "ANULADA",
    EN_TERCERO: "EN TERCERO",
  };
  return (
    <div className="flex flex-col gap-1">
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
    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200 text-[10px] font-black uppercase">
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
  onSendToCut,
  onViewDetails,
  onAssignFinish,
}: InventoryTableProps) {
  const { finishes } = useFinishes(true);

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
      <div className="w-full overflow-x-auto min-h-[250px] custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/80 border-b border-slate-100">
            <tr>
              <th className="p-4 text-center w-10">
                <input 
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  onChange={(e) => {
                    if (e.target.checked) {
                      onSelectAll(displayCoils.filter(c => c.status === 'AVAILABLE').map(c => c.id));
                    } else {
                      onSelectAll([]);
                    }
                  }}
                  checked={displayCoils.length > 0 && displayCoils.filter(c => c.status === 'AVAILABLE').every(c => selectedIds.includes(c.id))}
                />
              </th>
              <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center w-12">
                #
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Serie
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Acabado
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Fecha Ingreso
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Material{" "}
                <span className="text-gray-400 normal-case font-normal">
                  (Ancho x Esp)
                </span>
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Valorización
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap w-60">
                Stock Disponible
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Responsable
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Estado
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap w-32">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {displayCoils.map((coil, index) => {
              const isVoided = coil.status === "VOIDED";
              const creatorEmail = coil.registeredBy || "Sistema";
              const initial = creatorEmail.charAt(0).toUpperCase();
              const rowNumber = (currentPage - 1) * pageSize + index + 1;
              
              const totalValuePEN = (coil.currentWeight || 0) * (coil.pricePerKg || 0);
              const isUSD = coil.metadata?.currency === 'USD';
              const exchangeRate = coil.metadata?.exchangeRate || 1;
              const totalValueUSD = isUSD ? totalValuePEN / exchangeRate : 0;

              return (
                <tr
                  key={coil.id}
                  className={`group transition-colors ${isVoided ? "bg-red-50/10" : "hover:bg-blue-50/20"}`}
                >
                  <td className="p-4 text-center">
                    <input 
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-30"
                      checked={selectedIds.includes(coil.id)}
                      onChange={() => onSelect(coil.id)}
                      disabled={coil.status !== 'AVAILABLE'}
                    />
                  </td>
                  <td className="p-4 text-center">
                    <span className="text-xs font-bold text-gray-400">
                      {rowNumber}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span
                        className={`font-black ${isVoided ? "text-red-400 line-through" : "text-blue-900"}`}
                      >
                        {coil.id}
                      </span>
                      {coil.metadata?.provider && (
                        <span className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                          {coil.metadata.provider}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="p-4">
                    <FinishBadge 
                      finishId={coil.finish} 
                      finishes={finishes} 
                      onAssign={() => onAssignFinish?.(coil)} 
                    />
                  </td>

                  <td className="p-4">
                    <div
                      className={`text-sm font-bold ${isVoided ? "text-gray-400 line-through" : "text-gray-700"}`}
                    >
                      {formatDate(coil.metadata?.invoiceDate || coil.createdAt)}
                    </div>
                  </td>

                  <td
                    className={`p-4 text-sm font-medium ${isVoided ? "text-gray-400 line-through" : "text-gray-600"}`}
                  >
                    {coil.masterWidth}{" "}
                    <span className="text-gray-400 mx-0.5 text-[10px]">mm</span>
                    <span className="text-gray-300 mx-1">x</span>
                    {coil.thickness}{" "}
                    <span className="text-gray-400 mx-0.5 text-[10px]">mm</span>
                  </td>

                  <td className="p-4">
                    <div className="flex flex-col">
                       <span className="text-xs font-black text-slate-700">S/ {totalValuePEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                       {isUSD && (
                         <span className="text-[10px] font-bold text-slate-400 uppercase italic">
                           $ {totalValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} (TC {exchangeRate})
                         </span>
                       )}
                    </div>
                  </td>

                  <td
                    className={`p-4 ${isVoided ? "opacity-50 grayscale" : ""}`}
                  >
                    <WeightIndicator
                      current={coil.currentWeight || 0}
                      initial={coil.initialWeight || 0}
                    />
                  </td>

                  <td
                    className={`p-4 ${isVoided ? "opacity-50 grayscale" : ""}`}
                  >
                    <div className="flex items-center gap-2">
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
                  </td>

                  <td className="p-4">
                    <StatusBadge status={coil.status} orderId={orderMapping[coil.id]} />
                  </td>
                  <td className="p-4 relative">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onViewDetails(coil)}
                        className="p-2 text-gray-400 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition"
                        title="Ver Ficha Técnica"
                      >
                        <Eye size={18} />
                      </button>

                      <InventoryActions
                        coil={coil}
                        role={role}
                        isVoided={isVoided}
                        onEdit={() => onEdit(coil)}
                        onVoid={() => onVoid(coil.id)}
                        onCancelPlan={() => onCancelPlan(coil.id)}
                        onSendToCut={() => onSendToCut?.(coil)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}

            {displayCoils.length === 0 && (
              <tr>
                <td colSpan={11} className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4 text-slate-400">
                    <Search size={24} />
                  </div>
                  <h3 className="text-slate-900 font-bold text-lg">
                    No hay resultados
                  </h3>
                  <p className="text-slate-500 mt-1 font-medium">
                    No se encontraron bobinas con los filtros actuales.
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
